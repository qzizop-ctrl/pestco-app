import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Real-time Firestore listeners for the current workspace's customers
// (visits) and suppliers. Both collections load in full (no pagination) —
// the customer count is small enough that this is simpler and safer than
// paging, and it guarantees search/filters and the Dashboard always see
// every record.
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
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setVisits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setSuppliers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSuppliersLoaded(true);
      },
      (error) => {
        console.error("Failed to load suppliers (ownerUid=" + ownerUid + "):", error.code, error.message);
        setSuppliersError(error);
        setSuppliersLoaded(true);
      }
    );
    return () => unsub();
  }, [user, ownerUid]);

  return { visits, loaded, visitsError, suppliers, suppliersLoaded, suppliersError };
}
