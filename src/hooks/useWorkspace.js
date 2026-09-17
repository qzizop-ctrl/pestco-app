import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc, collection, onSnapshot, runTransaction, deleteDoc,
  setDoc, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { normalizeEmail, isAdminEmail, resolvePrimaryAdminEmail, isPrimaryAdminEmail, canRemoveAdmin, canGrantAccess, canRevokeAccess } from "../adminPermissions";

// Handles authentication plus multi-workspace permission resolution
// (owner / editor / viewer) and the access-granting/revoking transactions.
// A signed-in user may belong to more than one owner's workspace, so this
// hook keeps track of every workspace they can see and which one is
// currently selected — and takes `screen`/`setScreen`/`setActiveId` so it
// can bounce the UI back to a safe screen when access changes underneath it.
export function useWorkspace({ requireOnline, reportError, screen, setScreen, setActiveId }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  // Mirrors firestore.rules' isReviewer() — replaces the old hardcoded
  // REVIEWER_EMAIL. null means "not loaded yet"; every permission decision
  // below waits for this instead of assuming an empty/no-admin state, since
  // treating "not loaded" as "no admins" would incorrectly sign the real
  // admin back out on every fresh app open before this listener resolves.
  const [adminEmails, setAdminEmails] = useState(null);
  // The primary admin used to be inferred as "whichever email happens to
  // sit first in the emails array" — fragile, since array order depends on
  // exactly how/when the config/admins doc was hand-edited in the Firebase
  // console, and a wrong guess here means the wrong account gets treated as
  // primary (this caused a real bug: a newly added admin ended up seeing
  // the actual primary's email). Now it's read from an explicit
  // `primaryEmail` field on the same document, set by hand once in the
  // console — no more guessing from position. `emails[0]` is kept only as
  // a fallback for a doc that hasn't been migrated to have the field yet.
  const [primaryAdminEmail, setPrimaryAdminEmail] = useState(null);
  useEffect(() => {
    // This must be re-subscribed whenever `user` changes (not just once on
    // mount). A Firestore onSnapshot listener that gets permission-denied
    // is torn down for good — it does not silently retry once auth state
    // later becomes valid. Previously this ran once with an empty
    // dependency array, so it could open *before* sign-in resolved (no
    // request.auth yet), get permission-denied per the rules (correctly,
    // for that unauthenticated moment), and then just sit dead: never
    // re-subscribing after a real, valid sign-in happened moments later.
    // From then on adminEmails was permanently stuck at [] for the rest of
    // the session, which made every admin account look unauthorized and
    // get signed back out — even though the rules and the config/admins
    // document were both completely correct. Keying this off `user` (and
    // skipping entirely while signed out) means a fresh, authenticated
    // subscription is made right after every sign-in.
    if (!user) {
      setAdminEmails(null);
      setPrimaryAdminEmail(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "config", "admins"),
      (snap) => {
        // Same reasoning as the access_by_email listener below: a snapshot
        // can arrive from the local cache before Firestore confirms it with
        // the server. On a device whose cache predates this doc existing
        // (or predates the current admin being added to it), that stale
        // cached read looks like "no admins" and was signing a legitimate
        // admin account back out on every fresh app open. Wait for the
        // confirmed read instead of acting on the cached one.
        if (snap.metadata.fromCache) {
          return;
        }
        const emails = (snap.data()?.emails || [])
          .map((e) => String(e).trim().toLowerCase())
          .filter(Boolean);
        setAdminEmails(emails);
        // See adminPermissions.js — explicit primaryEmail field wins, only
        // falling back to "first in the array" for a doc that predates it.
        setPrimaryAdminEmail(resolvePrimaryAdminEmail(snap.data()?.primaryEmail, emails));
      },
      (error) => {
        setAdminEmails([]);
        setPrimaryAdminEmail(null);
      }
    );
    return () => unsub();
  }, [user]);

  const [members, setMembers] = useState({});
  // Per-member Dashboard visibility, keyed by email — { [email]: true }.
  // Owner-only concern: source of truth is access/{ownerUid}.dashboardAccess
  // (mirrored, per-email, onto access_by_email/{email}.dashboardAccess so
  // the grantee's own client can read it — see setMemberDashboardAccess,
  // grantAccess, and revokeAccess below). Off by default for everyone
  // except the owner: an email with no entry here (or `false`) does not
  // see the Dashboard tab at all.
  const [dashboardAccess, setDashboardAccessState] = useState({});
  const [pendingSignups, setPendingSignups] = useState([]);
  const [ownerUid, setOwnerUid] = useState(null);
  const [myRole, setMyRole] = useState(null);
  // Whether *this* signed-in account (as editor/viewer, not owner) has been
  // individually turned on for Dashboard access by the workspace owner —
  // read from this account's own access_by_email doc (see the permission
  // listener below). Irrelevant for the owner themselves; see
  // canViewDashboard, which always allows the owner regardless of this.
  const [myDashboardAccess, setMyDashboardAccess] = useState(false);
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
  // The owner always sees their own Dashboard; everyone else needs to have
  // been individually turned on for it from Settings (off by default).
  const canViewDashboard = isOwnerAccount || myDashboardAccess === true;

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
      setMyDashboardAccess(false);
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

    // Wait for the admin list before resolving anything — see the comment
    // on adminEmails above. permissionLoading stays true a moment longer
    // instead of risking a wrong (and disruptive) sign-out decision below.
    if (adminEmails === null) return;

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
        // Single-owner app (see the comment in grantAccess below), so this
        // is a flat boolean rather than keyed per-owner — matches how
        // `owners` itself is already treated as "at most one real entry"
        // everywhere else in this file.
        setMyDashboardAccess(snap.exists() && snap.data().dashboardAccess === true);
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
        // to accounts in config/admins (see adminEmails above). This is a
        // single-owner app: anyone else who signs up writes a
        // `signups/{uid}` doc and must be explicitly granted editor/viewer
        // access from Settings first. Without this check, any brand-new
        // registration (or a dismissed/removed one) fell through to "no
        // other access found" and was silently made owner of its own empty
        // workspace — which is exactly what let an un-reviewed or dismissed
        // account see the Settings screen and still use the app.
        const previousOwner = previousResolvedOwnerRef.current;
        const hasKnownExternalAccess = Boolean(previousOwner && previousOwner !== user.uid);
        const isReviewerEmail = adminEmails.includes(emailKey);

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
          setMyDashboardAccess(false);
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
        setMyDashboardAccess(false);
        setAvailableOwners([]);
        previousResolvedOwnerRef.current = null;
        setPermissionLoading(false);
        setScreen("list");
        setActiveId(null);
      }
    );

    return () => unsub();
  }, [user, adminEmails]);

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
      setDashboardAccessState(snap.exists() ? snap.data().dashboardAccess || {} : {});
    });
    return () => unsub();
  }, [user]);

  // The primary admin is whoever's email matches config/admins.primaryEmail
  // (see adminPermissions.js for the actual decision logic — kept there so
  // it's unit-tested directly, see adminPermissions.test.js). Every admin
  // added afterwards from inside the app can add further admins, but only
  // this one may remove any admin (including refusing to remove itself) —
  // see removeAdminEmail below and the matching rule in firestore.rules.
  const isPrimaryAdmin = Boolean(user) && isPrimaryAdminEmail(primaryAdminEmail, user?.email);

  const isReviewer = Boolean(user) && isAdminEmail(adminEmails, user?.email);

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

  // Settings is for the workspace owner (grant/revoke access) or any
  // admin/reviewer (review signups, manage admins) — not plain
  // editors/viewers. If someone outside those two groups ever ends up on
  // this screen (e.g. they switch to a workspace where they're a
  // viewer/editor while already on Settings), bounce them back to the
  // customer list. See the matching gate on the Settings tab itself in
  // BottomNav (Shared.jsx) — missing the isReviewer half of this check was
  // a real bug that hid Settings entirely from an admin who wasn't also an
  // "owner" of some workspace.
  useEffect(() => {
    if (!permissionLoading && screen === "settings" && !isOwnerAccount && !isReviewer) {
      setScreen("list");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionLoading, screen, isOwnerAccount, isReviewer]);

  // Same idea as the Settings redirect above: if someone is sitting on the
  // Dashboard screen and loses (or never had) Dashboard access — e.g. the
  // owner just turned it off for them from Settings, on another device,
  // while they were already looking at it — bounce them back to the
  // customer list instead of leaving a now-unauthorized screen showing.
  useEffect(() => {
    if (!permissionLoading && screen === "dashboard" && !canViewDashboard) {
      setScreen("list");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionLoading, screen, canViewDashboard]);

  const grantAccess = async (email, role) => {
    if (!user) return;
    if (!canGrantAccess({ isOwnerAccount, email, role })) return;
    if (!requireOnline()) return;

    const cleanEmail = normalizeEmail(email);

    const accessRef = doc(db, "access", user.uid);
    const lookupRef = doc(db, "access_by_email", cleanEmail);

    try {
      // Transaction keeps the members-map write atomic with the
      // owners-map write. We deliberately do NOT tx.get(lookupRef) here:
      // access_by_email/{granteeEmail} belongs to the grantee, and the
      // security rules correctly only let a user read their OWN email's
      // lookup doc — reading someone else's, even just to merge in prior
      // data, was being denied and aborting the whole transaction before
      // the write ever ran. Since this app is single-owner only, the
      // grantee can only ever have one owner entry anyway, so we can
      // overwrite it directly instead of reading-then-merging.
      await runTransaction(db, async (tx) => {
        const accessSnap = await tx.get(accessRef);

        const members = accessSnap.exists()
          ? { ...(accessSnap.data().members || {}) }
          : {};

        members[cleanEmail] = role;

        // Preserve any Dashboard-access toggle this email already had
        // (e.g. switching someone from viewer to editor shouldn't quietly
        // reset a Dashboard permission the owner had already granted them,
        // nor grant one they never had) — read from our own
        // access/{ownerUid} doc, since we can't read the grantee's
        // access_by_email doc to check it directly (see the comment above
        // about single-directional reads). Brand-new members default to
        // false (Dashboard access is off until the owner explicitly turns
        // it on from Settings).
        const existingDashboardAccess = accessSnap.exists()
          ? (accessSnap.data().dashboardAccess || {})
          : {};
        const memberDashboardAccess = existingDashboardAccess[cleanEmail] === true;

        tx.set(accessRef, { members }, { merge: true });
        tx.set(lookupRef, { owners: { [user.uid]: role }, dashboardAccess: memberDashboardAccess });
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
    if (!user) return;
    if (!canRevokeAccess({ isOwnerAccount, email })) return;
    if (!requireOnline()) return;

    const cleanEmail = normalizeEmail(email);

    const accessRef = doc(db, "access", user.uid);
    const lookupRef = doc(db, "access_by_email", cleanEmail);

    try {
      // Same reasoning as grantAccess: don't tx.get(lookupRef) for
      // someone else's email — the security rules deny that read and
      // it was aborting the whole transaction. Overwrite directly
      // instead (single-owner app, so an empty owners map is correct
      // once revoked).
      await runTransaction(db, async (tx) => {
        const accessSnap = await tx.get(accessRef);

        const members = accessSnap.exists()
          ? { ...(accessSnap.data().members || {}) }
          : {};

        delete members[cleanEmail];

        // This write uses merge:false (full document replace), so
        // dashboardAccess has to be re-included explicitly here — otherwise
        // revoking any one person's access would silently wipe every other
        // member's Dashboard-access setting too, since it'd just vanish
        // from the document along with `members`.
        const dashboardAccessMap = accessSnap.exists()
          ? { ...(accessSnap.data().dashboardAccess || {}) }
          : {};
        delete dashboardAccessMap[cleanEmail];

        tx.set(accessRef, { members, dashboardAccess: dashboardAccessMap }, { merge: false });
        // Keep the reverse-index document instead of deleting it, because
        // delete is intentionally disallowed by the security rules.
        tx.set(lookupRef, { owners: {}, dashboardAccess: false }, { merge: false });
      });
    } catch (e) {
      console.error("revokeAccess failed:", e);
      reportError && reportError(e);
    }
  };

  // Owner-only: turns Dashboard visibility on/off for one already-granted
  // member, independent of their editor/viewer role. Off by default for
  // everyone but the owner (see canViewDashboard above) — this is the only
  // way it ever becomes true for someone else.
  const setMemberDashboardAccess = async (email, allowed) => {
    if (!user || !isOwnerAccount) return;
    if (!requireOnline()) return;

    const cleanEmail = normalizeEmail(email);
    const accessRef = doc(db, "access", user.uid);
    const lookupRef = doc(db, "access_by_email", cleanEmail);

    try {
      await runTransaction(db, async (tx) => {
        const accessSnap = await tx.get(accessRef);
        const currentMembers = accessSnap.exists() ? (accessSnap.data().members || {}) : {};
        const role = currentMembers[cleanEmail];
        // Not an actual member (already revoked, or never granted) —
        // nothing to toggle.
        if (!role) return;

        const dashboardAccessMap = accessSnap.exists()
          ? { ...(accessSnap.data().dashboardAccess || {}) }
          : {};
        dashboardAccessMap[cleanEmail] = Boolean(allowed);

        tx.set(accessRef, { dashboardAccess: dashboardAccessMap }, { merge: true });
        tx.set(lookupRef, { owners: { [user.uid]: role }, dashboardAccess: Boolean(allowed) });
      });
    } catch (e) {
      console.error("setMemberDashboardAccess failed:", e);
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

  // Lets an existing admin add/remove others from Settings, so a second
  // admin no longer has to be added by editing code and redeploying — only
  // the very first one still has to be created by hand in the Firebase
  // console (config/admins with an `emails` array), since there's no admin
  // yet at that point to grant it from inside the app.
  const addAdminEmail = async (email) => {
    if (!isReviewer) return;
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) return;
    try {
      await setDoc(doc(db, "config", "admins"), { emails: arrayUnion(cleanEmail) }, { merge: true });
    } catch (e) {
      console.error("addAdminEmail failed:", e);
      reportError && reportError(e);
    }
  };

  const removeAdminEmail = async (email) => {
    // See adminPermissions.js: only the primary admin may remove admins at
    // all, the primary itself can never be removed, and the last remaining
    // admin can never be removed. firestore.rules enforces the same thing
    // server-side.
    const cleanEmail = normalizeEmail(email);
    const allowed = canRemoveAdmin({
      requesterIsPrimaryAdmin: isPrimaryAdmin,
      targetEmail: cleanEmail,
      primaryAdminEmail,
      adminEmailsCount: (adminEmails || []).length,
    });
    if (!allowed) return;
    try {
      await setDoc(doc(db, "config", "admins"), { emails: arrayRemove(cleanEmail) }, { merge: true });
    } catch (e) {
      console.error("removeAdminEmail failed:", e);
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
    canViewDashboard,
    members,
    dashboardAccess,
    setMemberDashboardAccess,
    pendingSignups,
    isReviewer,
    isPrimaryAdmin,
    primaryAdminEmail,
    adminEmails,
    addAdminEmail,
    removeAdminEmail,
    reviewSignup,
    dismissSignup,
    switchOwnerWorkspace,
    grantAccess,
    revokeAccess,
  };
}
