import { useState, useEffect } from "react";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { buildAuditEntry } from "../auditLog";
import { reportException } from "../sentry";
import { toJsDate } from "../helpers";

// How many recent entries the Audit Log screen loads. The log is
// append-only and can grow indefinitely, so this is a live query, not the
// "load the whole collection" pattern useLiveData.js uses for visits/
// suppliers — an audit trail is read far less often than the data it
// describes, and only the most recent history is usually what's needed.
// Exported so AuditLog.jsx can tell the user when their filters (e.g. a
// "from" date) reach further back than what's actually loaded, instead of
// those filters silently returning an empty/incomplete result.
export const AUDIT_LOG_LIMIT = 500;

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
    const ref = query(
      collection(db, "users", ownerUid, "auditLog"),
      orderBy("at", "desc"),
      limit(AUDIT_LOG_LIMIT)
    );
    const unsub = onSnapshot(
      ref,
      (snap) => {
        // `at` now comes back from Firestore as a Timestamp object (it's
        // written with serverTimestamp() — see logAudit above), not the
        // ISO string it used to be. Every consumer of an entry's `at`
        // (AuditLog.jsx's date-range filter, which does e.at.slice(0,10),
        // and fmtActivityDate) still expects a string, so it's normalized
        // back to one right here, in the one place entries enter the app,
        // instead of touching every call site.
        setEntries(
          snap.docs.map((d) => {
            const data = d.data();
            const atDate = toJsDate(data.at);
            return { id: d.id, ...data, at: atDate ? atDate.toISOString() : null };
          })
        );
        setLoaded(true);
      },
      (err) => {
        console.error("Failed to load audit log (ownerUid=" + ownerUid + "):", err.code, err.message);
        reportException(err, { context: "Failed to load audit log", ownerUid });
        setError(err);
        setLoaded(true);
      }
    );
    return () => unsub();
  }, [ownerUid, enabled]);

  return { entries, loaded, error };
}
