import { useState, useEffect } from "react";
import { collection, addDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { buildAuditEntry } from "../auditLog";

// How many recent entries the Audit Log screen loads. The log is
// append-only and can grow indefinitely, so this is a live query, not the
// "load the whole collection" pattern useLiveData.js uses for visits/
// suppliers — an audit trail is read far less often than the data it
// describes, and only the most recent history is usually what's needed.
const AUDIT_LOG_LIMIT = 500;

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
  addDoc(collection(db, "users", ownerUid, "auditLog"), entry).catch((e) => {
    console.error("Audit log write failed:", e.code, e.message);
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
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoaded(true);
      },
      (err) => {
        console.error("Failed to load audit log (ownerUid=" + ownerUid + "):", err.code, err.message);
        setError(err);
        setLoaded(true);
      }
    );
    return () => unsub();
  }, [ownerUid, enabled]);

  return { entries, loaded, error };
}
