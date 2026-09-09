import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, collection, onSnapshot, runTransaction, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

// Matches firestore.rules' isReviewer() — the single hardcoded account
// that can see and act on the "pending accounts" list in Settings. This
// mirrors the app's current single-company/single-team usage, not a
// general multi-tenant admin model.
const REVIEWER_EMAIL = "qzizop@gmail.com";

// Handles authentication plus multi-workspace permission resolution
// (owner / editor / viewer) and the access-granting/revoking transactions.
// A signed-in user may belong to more than one owner's workspace, so this
// hook keeps track of every workspace they can see and which one is
// currently selected — and takes `screen`/`setScreen`/`setActiveId` so it
// can bounce the UI back to a safe screen when access changes underneath it.
export function useWorkspace({ requireOnline, reportError, screen, setScreen, setActiveId }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  const [members, setMembers] = useState({});
  const [pendingSignups, setPendingSignups] = useState([]);
  const [ownerUid, setOwnerUid] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [availableOwners, setAvailableOwners] = useState([]);
  const [permissionLoading, setPermissionLoading] = useState(true);
  // Set when a signed-in account turns out to have no usable access at all
  // (never granted, still pending review, or a dismissed/removed signup) —
  // AuthScreen surfaces this as an "email not registered" style message
  // once we've signed the account back out. Cleared by clearAuthError().
  const [authError, setAuthError] = useState(false);
  const previousResolvedOwnerRef = useRef(null);
  const clearAuthError = () => setAuthError(false);

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
      try {
        localStorage.removeItem("pestco_selected_owner");
      } catch (e) {}
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
        // A snapshot can arrive from the local cache before Firestore has
        // confirmed the real answer with the server — e.g. right after
        // reopening the app, the cache may still hold whatever role this
        // account had *before* the owner's last change (say "editor" from
        // before it was switched to "viewer"). Acting on that stale cached
        // value made the UI show edit controls that the server would then
        // correctly reject, which looked like "it lets me try, then says
        // I'm not allowed." So: nothing is committed — role, ownerUid, or
        // localStorage — until Firestore confirms the read with the server.
        if (snap.metadata.fromCache) {
          return;
        }

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
        //
        // Self-provisioning into an "owner" workspace is further restricted
        // to REVIEWER_EMAIL only. This is a single-owner app: anyone else
        // who signs up writes a `signups/{uid}` doc and must be explicitly
        // granted editor/viewer access from Settings first. Without this
        // check, any brand-new registration (or a dismissed/removed one)
        // fell through to "no other access found" and was silently made
        // owner of its own empty workspace — which is exactly what let an
        // un-reviewed or dismissed account see the Settings screen and
        // still use the app.
        const previousOwner = previousResolvedOwnerRef.current;
        const hasKnownExternalAccess = Boolean(previousOwner && previousOwner !== user.uid);
        const isReviewerEmail = emailKey === REVIEWER_EMAIL;

        let nextOwners = externalOwners;
        if (externalOwners.some((x) => x.uid === user.uid)) {
          nextOwners = externalOwners.map((x) => x.uid === user.uid ? { ...x, role: "owner" } : x);
        } else if (isReviewerEmail && !hasKnownExternalAccess && externalOwners.length === 0) {
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
          // Not the reviewer and not granted access by anyone: this account
          // has nothing to do in the app (still pending review, dismissed,
          // or revoked). Sign it back out and let AuthScreen show an
          // "email not registered" style message instead of leaving it
          // signed in with no data and no way forward.
          if (!isReviewerEmail) {
            setAuthError(true);
            signOut(auth).catch((e) => console.error("Sign-out for unauthorized account failed:", e));
          }
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

  const isReviewer = Boolean(user && (user.email || "").trim().toLowerCase() === REVIEWER_EMAIL);

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
    });
    return () => unsub();
  }, [isReviewer, members]);

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
      // This used to fail silently — the owner would see the Settings UI
      // close/complete normally with no indication anything went wrong,
      // while the invited person still couldn't get in (their lookup finds
      // no grant, since none was actually written). Most common real cause:
      // the Firestore security rules deployed on the live project don't
      // match firestore.rules in the repo (the file has to be deployed
      // separately — having it in the project doesn't apply it).
      reportError && reportError(e);
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
      reportError && reportError(e);
    }
  };

  // Grants the chosen role in one step, then removes the entry from the
  // pending-review list. Grant and cleanup are two separate requests (the
  // signups doc lives outside the access/access_by_email transaction), so
  // if the delete fails after a successful grant, the client-side filter
  // above still hides it next time `members` updates.
  const reviewSignup = async (uid, email, role) => {
    if (!isReviewer) return;
    await grantAccess(email, role);
    try {
      await deleteDoc(doc(db, "signups", uid));
    } catch (e) {
      console.error("Failed to clear reviewed signup:", e);
      reportError && reportError(e);
    }
  };

  const dismissSignup = async (uid) => {
    if (!isReviewer) return;
    try {
      await deleteDoc(doc(db, "signups", uid));
    } catch (e) {
      console.error("Failed to dismiss signup:", e);
      reportError && reportError(e);
    }
  };

  return {
    authChecked,
    user,
    authError,
    clearAuthError,
    ownerUid,
    availableOwners,
    permissionLoading,
    canEdit,
    isOwnerAccount,
    members,
    pendingSignups,
    isReviewer,
    reviewSignup,
    dismissSignup,
    switchOwnerWorkspace,
    grantAccess,
    revokeAccess,
  };
}
