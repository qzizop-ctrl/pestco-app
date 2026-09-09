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
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);

  useEffect(() => {
    if (!user || !ownerUid) {
      setVisits([]);
      setLoaded(false);
      return;
    }
    setLoaded(false);
    const ref = collection(db, "users", ownerUid, "visits");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setVisits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return () => unsub();
  }, [user, ownerUid]);

  useEffect(() => {
    if (!user || !ownerUid) {
      setSuppliers([]);
      setSuppliersLoaded(false);
      return;
    }
    setSuppliersLoaded(false);
    const ref = collection(db, "users", ownerUid, "suppliers");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setSuppliers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSuppliersLoaded(true);
      },
      () => setSuppliersLoaded(true)
    );
    return () => unsub();
  }, [user, ownerUid]);

  return { visits, loaded, suppliers, suppliersLoaded };
}
