import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { reportException, reportWarning } from "../sentry";
import { applySnapshot } from "../snapshotCache";

// Real-time Firestore listeners for the current workspace's customers
// (visits) and suppliers. Both collections load in full (no pagination) —
// the customer count is small enough that this is simpler and safer than
// paging, and it guarantees search/filters and the Dashboard always see
// every record.
//
// NOTE ON FUTURE PAGINATION: this can't be swapped for simple Firestore
// query-limit pagination later without also reworking useReminders (scans
// every visit for due reminders), Dashboard's aggregate stats (need every
// record to be correct), and the search/filter UI (searches the full set)
// — all three currently assume `visits` is the complete dataset. Real
// pagination means splitting "what the list view renders" from "what
// those three need", which is a larger redesign, not a drop-in change.
// The warning below just flags when it's worth actually doing that.
const LARGE_COLLECTION_WARNING_THRESHOLD = 2000;

// Warned once per session per collection (this runs on every snapshot, so an
// unconditional warn would flood the console) and also sent to Sentry, so the
// team finds out the day a workspace crosses the line instead of when phones
// start to struggle.
const warnedLabels = new Set();

function warnIfLarge(label, count) {
  if (count < LARGE_COLLECTION_WARNING_THRESHOLD || warnedLabels.has(label)) return;
  warnedLabels.add(label);
  console.warn(
    `[useLiveData] ${label} collection has ${count} documents (>= ${LARGE_COLLECTION_WARNING_THRESHOLD}). ` +
      "This is still loaded in full on every client — worth revisiting pagination/architecture soon."
  );
  reportWarning(`Large collection loaded in full: ${label}`, {
    count,
    threshold: LARGE_COLLECTION_WARNING_THRESHOLD,
  });
}

export function useLiveData(user, ownerUid) {
  const [visits, setVisits] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [visitsError, setVisitsError] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [suppliersError, setSuppliersError] = useState(null);

  useEffect(() => {
    if (!user || !ownerUid) {
      setVisits([]);
      setLoaded(false);
      setVisitsError(null);
      return;
    }
    setLoaded(false);
    setVisitsError(null);
    const ref = collection(db, "users", ownerUid, "visits");
    // Per-listener cache: unchanged documents keep the same object between
    // snapshots (see snapshotCache.js). Discarded with the effect on
    // workspace change.
    const cache = new Map();
    const unsub = onSnapshot(
      ref,
      (snap) => {
        warnIfLarge("visits", snap.size);
        setVisits(applySnapshot(cache, snap));
        setLoaded(true);
      },
      (error) => {
        // Previously swallowed silently, which made a permissions problem
        // (e.g. this account not actually listed as a member yet) look
        // identical to "there's just no data" — no error, no clue why the
        // list stayed empty. Now it's logged with its real Firestore code
        // (check the browser console for "permission-denied" specifically)
        // and exposed so the UI can tell the difference.
        console.error("Failed to load visits (ownerUid=" + ownerUid + "):", error.code, error.message);
        reportException(error, { context: "Failed to load visits", ownerUid });
        setVisitsError(error);
        setLoaded(true);
      }
    );
    return () => unsub();
  }, [user, ownerUid]);

  useEffect(() => {
    if (!user || !ownerUid) {
      setSuppliers([]);
      setSuppliersLoaded(false);
      setSuppliersError(null);
      return;
    }
    setSuppliersLoaded(false);
    setSuppliersError(null);
    const ref = collection(db, "users", ownerUid, "suppliers");
    const cache = new Map();
    const unsub = onSnapshot(
      ref,
      (snap) => {
        warnIfLarge("suppliers", snap.size);
        setSuppliers(applySnapshot(cache, snap));
        setSuppliersLoaded(true);
      },
      (error) => {
        console.error("Failed to load suppliers (ownerUid=" + ownerUid + "):", error.code, error.message);
        reportException(error, { context: "Failed to load suppliers", ownerUid });
        setSuppliersError(error);
        setSuppliersLoaded(true);
      }
    );
    return () => unsub();
  }, [user, ownerUid]);

  return { visits, loaded, visitsError, suppliers, suppliersLoaded, suppliersError };
}
