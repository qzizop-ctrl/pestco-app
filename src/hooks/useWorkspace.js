import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { auth, db } from "../firebase";

// Handles authentication plus multi-workspace permission resolution
// (owner / editor / viewer) and the access-granting/revoking transactions.
// A signed-in user may belong to more than one owner's workspace, so this
// hook keeps track of every workspace they can see and which one is
// currently selected — and takes `screen`/`setScreen`/`setActiveId` so it
// can bounce the UI back to a safe screen when access changes underneath it.
export function useWorkspace({ requireOnline, screen, setScreen, setActiveId }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  const [members, setMembers] = useState({});
  const [ownerUid, setOwnerUid] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [availableOwners, setAvailableOwners] = useState([]);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const previousResolvedOwnerRef = useRef(null);

  // Permission flags derived from myRole (set from the access_by_email lookup).
  const canEdit = !permissionLoading && (myRole === "owner" || myRole === "editor");
  const isOwnerAccount = !permissionLoading && myRole === "owner";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // Live permission/workspace listener. A user may belong to more than one
  // owner/workspace, so we keep all valid owners and remember the last choice.
  useEffect(() => {
    if (!user) {
      setOwnerUid(null);
      setMyRole(null);
      setAvailableOwners([]);
      setPermissionLoading(false);
      previousResolvedOwnerRef.current = null;
      return;
    }

    setPermissionLoading(true);
    const emailKey = (user.email || "").trim().toLowerCase();

    if (!emailKey) {
      setOwnerUid(user.uid);
      setMyRole("owner");
      setAvailableOwners([{ uid: user.uid, role: "owner" }]);
      setPermissionLoading(false);
      previousResolvedOwnerRef.current = user.uid;
      return;
    }

    const lookupRef = doc(db, "access_by_email", emailKey);

    const unsub = onSnapshot(
      lookupRef,
      (snap) => {
        const ownersMap = snap.exists() ? snap.data().owners || {} : {};
        const externalOwners = Object.entries(ownersMap)
          .filter(([, role]) => role === "editor" || role === "viewer")
          .map(([uid, role]) => ({ uid, role }));

        // The signed-in account is always an owner of its own workspace on
        // initial login, but only when they have no other granted access —
        // someone who was invited as a viewer/editor should land straight
        // in the workspace they were granted, never in a phantom empty
        // "Owner" workspace of their own. A revoked external user must also
        // NOT be converted into a new owner workspace.
        const previousOwner = previousResolvedOwnerRef.current;
        const hasKnownExternalAccess = Boolean(previousOwner && previousOwner !== user.uid);

        let nextOwners = externalOwners;
        if (externalOwners.some((x) => x.uid === user.uid)) {
          nextOwners = externalOwners.map((x) => x.uid === user.uid ? { ...x, role: "owner" } : x);
        } else if (!hasKnownExternalAccess && externalOwners.length === 0) {
          nextOwners = [{ uid: user.uid, role: "owner" }, ...externalOwners];
        }

        // Remove duplicates and keep a stable order.
        const seen = new Set();
        nextOwners = nextOwners.filter((x) => {
          if (seen.has(x.uid)) return false;
          seen.add(x.uid);
          return true;
        });

        if (nextOwners.length === 0) {
          setOwnerUid(null);
          setMyRole(null);
          setAvailableOwners([]);
          previousResolvedOwnerRef.current = null;
          setScreen("list");
          setActiveId(null);
          setPermissionLoading(false);
          return;
        }

        setAvailableOwners(nextOwners);

        let savedOwner = null;
        try {
          savedOwner = localStorage.getItem("pestco_selected_owner");
        } catch (e) {}

        const currentOwner = previousResolvedOwnerRef.current;
        const currentStillValid = nextOwners.some((x) => x.uid === currentOwner);
        const savedStillValid = nextOwners.some((x) => x.uid === savedOwner);
        const selected = currentStillValid
          ? currentOwner
          : savedStillValid
            ? savedOwner
            : nextOwners[0].uid;

        const selectedEntry = nextOwners.find((x) => x.uid === selected);
        setOwnerUid(selected);
        setMyRole(selectedEntry?.role || null);
        previousResolvedOwnerRef.current = selected;
        try {
          localStorage.setItem("pestco_selected_owner", selected);
        } catch (e) {}
        setPermissionLoading(false);
      },
      (error) => {
        console.error("Permission listener failed:", error);
        setOwnerUid(null);
        setMyRole(null);
        setAvailableOwners([]);
        previousResolvedOwnerRef.current = null;
        setPermissionLoading(false);
        setScreen("list");
        setActiveId(null);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Keep the selected workspace and role synchronized when the user changes
  // workspace from Settings.
  const switchOwnerWorkspace = (nextOwnerUid) => {
    const selected = availableOwners.find((x) => x.uid === nextOwnerUid);
    if (!selected) return;
    setOwnerUid(selected.uid);
    setMyRole(selected.role);
    previousResolvedOwnerRef.current = selected.uid;
    setActiveId(null);
    setScreen("list");
    try {
      localStorage.setItem("pestco_selected_owner", selected.uid);
    } catch (e) {}
  };

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "access", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setMembers(snap.exists() ? snap.data().members || {} : {});
    });
    return () => unsub();
  }, [user]);

  // Settings is owner-only. If a non-owner ever ends up on this screen
  // (e.g. they switch to a workspace where they're a viewer/editor while
  // already on Settings), bounce them back to the customer list.
  useEffect(() => {
    if (!permissionLoading && screen === "settings" && !isOwnerAccount) {
      setScreen("list");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionLoading, screen, isOwnerAccount]);

  const grantAccess = async (email, role) => {
    if (!isOwnerAccount || !user) return;
    if (!requireOnline()) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !["editor", "viewer"].includes(role)) return;

    const accessRef = doc(db, "access", user.uid);
    const lookupRef = doc(db, "access_by_email", cleanEmail);

    try {
      // Transaction prevents concurrent owner changes from overwriting each
      // other when multiple clients edit the same members/owners maps.
      await runTransaction(db, async (tx) => {
        const [accessSnap, lookupSnap] = await Promise.all([
          tx.get(accessRef),
          tx.get(lookupRef),
        ]);

        const members = accessSnap.exists()
          ? { ...(accessSnap.data().members || {}) }
          : {};
        const owners = lookupSnap.exists()
          ? { ...(lookupSnap.data().owners || {}) }
          : {};

        members[cleanEmail] = role;
        owners[user.uid] = role;

        tx.set(accessRef, { members }, { merge: true });
        tx.set(lookupRef, { owners }, { merge: true });
      });
    } catch (e) {
      console.error("grantAccess failed:", e);
    }
  };

  const revokeAccess = async (email) => {
    if (!isOwnerAccount || !user) return;
    if (!requireOnline()) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    const accessRef = doc(db, "access", user.uid);
    const lookupRef = doc(db, "access_by_email", cleanEmail);

    try {
      await runTransaction(db, async (tx) => {
        const [accessSnap, lookupSnap] = await Promise.all([
          tx.get(accessRef),
          tx.get(lookupRef),
        ]);

        const members = accessSnap.exists()
          ? { ...(accessSnap.data().members || {}) }
          : {};
        const owners = lookupSnap.exists()
          ? { ...(lookupSnap.data().owners || {}) }
          : {};

        delete members[cleanEmail];
        delete owners[user.uid];

        tx.set(accessRef, { members }, { merge: false });
        // Keep the reverse-index document instead of deleting it, because
        // delete is intentionally disallowed by the security rules.
        tx.set(lookupRef, { owners }, { merge: false });
      });
    } catch (e) {
      console.error("revokeAccess failed:", e);
    }
  };

  return {
    authChecked,
    user,
    ownerUid,
    availableOwners,
    permissionLoading,
    canEdit,
    isOwnerAccount,
    members,
    switchOwnerWorkspace,
    grantAccess,
    revokeAccess,
  };
}
