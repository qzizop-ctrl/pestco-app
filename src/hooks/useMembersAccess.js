import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Subscribes to access/{user.uid} — the owner's own members list and
// per-member dashboard visibility. Only meaningful for an owner account:
// for a member (editor/viewer) the read is expected to be denied by
// firestore.rules, which this hook treats as "no members to show" rather
// than an error. Split out of useWorkspace.js.
export function useMembersAccess(user) {
  const [members, setMembers] = useState({});
  // Per-member Dashboard visibility, keyed by email — { [email]: true }.
  // Owner-only concern: source of truth is access/{ownerUid}.dashboardAccess
  // (mirrored, per-email, onto access_by_email/{email}.dashboardAccess so
  // the grantee's own client can read it — see setMemberDashboardAccess,
  // grantAccess, and revokeAccess in useAccessManagement.js). Off by
  // default for everyone except the owner: an email with no entry here (or
  // `false`) does not see the Dashboard tab at all.
  const [dashboardAccess, setDashboardAccessState] = useState({});

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "access", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setMembers(snap.exists() ? snap.data().members || {} : {});
        setDashboardAccessState(snap.exists() ? snap.data().dashboardAccess || {} : {});
      },
      () => {
        // Only admins may read access/{uid} (firestore.rules) — for a
        // member (editor/viewer) this is expected to be denied and there is
        // simply no members list to show. Not an error worth reporting.
        setMembers({});
        setDashboardAccessState({});
      }
    );
    return () => unsub();
  }, [user]);

  return { members, dashboardAccess };
}
