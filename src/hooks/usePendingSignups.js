import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { reportException } from "../sentry";

// Subscribes to the `signups` collection for the reviewer account only.
// Split out of useWorkspace.js.
export function usePendingSignups({ isReviewer, members }) {
  const [pendingSignups, setPendingSignups] = useState([]);

  // Only the reviewer account subscribes to this collection at all — for
  // everyone else it would just be a permission-denied listener doing
  // nothing. New signups already granted a role (present in `members`)
  // are filtered out client-side as a second safety net, in case a
  // reviewSignup() call granted access but its signups/{uid} delete
  // didn't finish (e.g. a dropped connection right after).
  useEffect(() => {
    if (!isReviewer) {
      setPendingSignups([]);
      return;
    }
    const unsub = onSnapshot(collection(db, "signups"), (snap) => {
      const rows = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((row) => row.email && !(row.email in members));
      rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPendingSignups(rows);
    }, (error) => {
      console.error("Failed to load pending signups:", error.code, error.message);
      reportException(error, { context: "Failed to load pending signups" });
    });
    return () => unsub();
  }, [isReviewer, members]);

  return pendingSignups;
}
