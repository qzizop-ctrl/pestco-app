import { useState, useEffect } from "react";
import { collection, doc, addDoc, query, orderBy, where, limit, onSnapshot, getDocsFromServer, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { buildAuditEntry } from "../auditLog";
import { reportException } from "../sentry";
import { toJsDate } from "../dateUtils";

// How many recent entries the Audit Log screen loads. The log is
// append-only and can grow indefinitely, so this is a live query, not the
// "load the whole collection" pattern useLiveData.js uses for visits/
// suppliers — an audit trail is read far less often than the data it
// describes, and only the most recent history is usually what's needed.
// Exported so AuditLog.jsx can tell the user when their filters (e.g. a
// "from" date) reach further back than what's actually loaded, instead of
// those filters silently returning an empty/incomplete result.
export const AUDIT_LOG_LIMIT = 500;

// Only the newest AUDIT_LOG_KEEP entries are kept; everything older is
// deleted automatically (see pruneAuditLog / useAuditLogPrune below).
export const AUDIT_LOG_KEEP = 40;

// Fire-and-forget write of one audit-log entry to
// users/{ownerUid}/auditLog. Deliberately never throws into the caller —
// every call site is a secondary effect of a customer/supplier write that
// already succeeded (or a pending-edit review action), so a failure here
// (e.g. rules not yet deployed) shouldn't block or roll back the actual
// data change the user is waiting on. Failures are only logged to the
// console, same spirit as the rest of the app's "don't let a
// nice-to-have write break the primary action" writes (e.g.
// scheduleCallReminder).
export function logAudit(ownerUid, params) {
  if (!ownerUid) return;
  const entry = buildAuditEntry(params);
  // `at` is stamped here (server time), not inside buildAuditEntry — see
  // the comment on that function in auditLog.js. firestore.rules requires
  // this to equal request.time on create, so ordering the Audit Log screen
  // by `at` can no longer be manipulated by a client-supplied timestamp.
  addDoc(collection(db, "users", ownerUid, "auditLog"), { ...entry, at: serverTimestamp() }).catch((e) => {
    console.error("Audit log write failed:", e.code, e.message);
    reportException(e, { context: "Audit log write failed" });
  });
}

// Live feed of the most recent audit-log entries for the current
// workspace — only subscribed while `enabled` (the Audit Log screen is
// actually open, and the viewer is owner/reviewer per firestore.rules), so
// it doesn't cost every session a listener it'll almost never use.
// Adds the audit entry to a Firestore WriteBatch OR Transaction (both have
// .set(ref, data)) so it commits (or fails) together with the record write
// it describes. logAudit() above is
// fire-and-forget: if the connection dropped between the record write and
// the audit write, the change existed but its trail entry never did. Used
// for create / update / delete of customers and suppliers, for Excel
// import, and — passing the transaction — for the owner's approve / rollback /
// confirm-delete / restore steps (useLastChangeActions.js).
export function queueAudit(batchOrTx, ownerUid, params) {
  if (!ownerUid) return;
  const ref = doc(collection(db, "users", ownerUid, "auditLog"));
  batchOrTx.set(ref, { ...buildAuditEntry(params), at: serverTimestamp() });
}

// Firestore orders mixed field types by TYPE first (null < number <
// Timestamp < string), not by the moment they describe. Old audit entries
// were written with `at` as an ISO string; new ones use serverTimestamp()
// (a Timestamp). A single orderBy("at", "desc") therefore put every old
// string entry above all the new Timestamp entries. To fix that without
// migrating data, the feed runs one type-bounded query per format and
// merges + sorts them by the real date on the client.
function normalizeEntry(d) {
  // "estimate" gives a pending serverTimestamp() (a write that hasn't
  // reached the server yet) a usable local time instead of null, so a
  // just-made change shows up at the top right away.
  const data = d.data({ serverTimestamps: "estimate" });
  const atDate = toJsDate(data.at);
  return { id: d.id, ...data, at: atDate ? atDate.toISOString() : null };
}

function sortNewestFirst(list) {
  return [...list].sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : Infinity; // no date yet = newest
    const tb = b.at ? Date.parse(b.at) : Infinity;
    return tb - ta;
  });
}

// The two type-bounded queries described above. Inequality filters are
// type-bounded in Firestore: `> Timestamp(0)` matches only Timestamp
// values, `> ""` matches only strings.
function auditQueries(ownerUid) {
  const col = collection(db, "users", ownerUid, "auditLog");
  return [
    query(col, where("at", ">", Timestamp.fromMillis(0)), orderBy("at", "desc"), limit(AUDIT_LOG_LIMIT)),
    query(col, where("at", ">", ""), orderBy("at", "desc"), limit(AUDIT_LOG_LIMIT)),
  ];
}

// Deletes every entry past the newest AUDIT_LOG_KEEP. `sortedEntries` must
// already be newest-first. Entries with no date yet (pending local writes)
// sort first, so they are never the ones removed.
async function deleteBeyondKeep(ownerUid, sortedEntries) {
  const stale = sortedEntries.slice(AUDIT_LOG_KEEP);
  const commits = [];
  for (let i = 0; i < stale.length; i += 400) {
    const batch = writeBatch(db);
    stale.slice(i, i + 400).forEach((e) => batch.delete(doc(db, "users", ownerUid, "auditLog", e.id)));
    commits.push(batch.commit());
  }
  await Promise.all(commits);
}

// One-shot cleanup (owner only — firestore.rules only lets the owner
// delete audit entries). Reads from the server, not the local cache, so a
// stale offline cache can never cause a wrong delete. If there is a large
// backlog, each run removes up to AUDIT_LOG_LIMIT-AUDIT_LOG_KEEP entries
// per format and the next run continues.
export async function pruneAuditLog(ownerUid) {
  if (!ownerUid) return;
  try {
    const snaps = await Promise.all(auditQueries(ownerUid).map((q) => getDocsFromServer(q)));
    const all = sortNewestFirst(snaps.flatMap((snap) => snap.docs.map(normalizeEntry)));
    await deleteBeyondKeep(ownerUid, all);
  } catch (e) {
    console.error("Audit log prune failed:", e.code, e.message);
  }
}

// Runs the cleanup once when the owner's session is ready.
export function useAuditLogPrune({ ownerUid, enabled }) {
  useEffect(() => {
    if (!enabled || !ownerUid) return;
    void pruneAuditLog(ownerUid);
  }, [ownerUid, enabled]);
}

export function useAuditLogFeed({ ownerUid, enabled }) {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !ownerUid) {
      setEntries([]);
      setLoaded(false);
      setError(null);
      return;
    }
    setLoaded(false);
    setError(null);

    const queries = auditQueries(ownerUid);
    const results = [[], []];
    const ready = [false, false];
    let failed = false;

    const publish = () => {
      if (!ready.every(Boolean)) return;
      const sorted = sortNewestFirst(results.flat());
      setEntries(sorted.slice(0, AUDIT_LOG_KEEP));
      setLoaded(true);
    };

    const unsubs = queries.map((q, i) =>
      onSnapshot(
        q,
        (snap) => {
          results[i] = snap.docs.map(normalizeEntry);
          ready[i] = true;
          publish();
          // Auto-clean while the screen is open too: only from a
          // server-confirmed snapshot, never from the local cache.
          if (!snap.metadata.fromCache && ready.every(Boolean)) {
            deleteBeyondKeep(ownerUid, sortNewestFirst(results.flat())).catch((e) =>
              console.error("Audit log prune failed:", e.code, e.message)
            );
          }
        },
        (err) => {
          if (failed) return;
          failed = true;
          console.error("Failed to load audit log (ownerUid=" + ownerUid + "):", err.code, err.message);
          reportException(err, { context: "Failed to load audit log", ownerUid });
          setError(err);
          setLoaded(true);
        }
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [ownerUid, enabled]);

  return { entries, loaded, error };
}
