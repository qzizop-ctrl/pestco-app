import {
  doc, runTransaction, deleteDoc, setDoc, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "../firebase";
import { normalizeEmail, canRemoveAdmin, canGrantAccess, canRevokeAccess } from "../adminPermissions";

// Split out of useWorkspace.js: that hook resolves *who the current user is*
// and *which workspace/role they have* (auth, admin listener, permission
// resolution, workspace switching). This hook is the "write side" —
// everything that mutates access/admin state from Settings — and takes the
// already-resolved identity/role values as plain inputs instead of
// re-deriving them, so there is exactly one source of truth for each.
export function useAccessManagement({
  user, isOwnerAccount, isReviewer, isPrimaryAdmin, primaryAdminEmail, adminEmails,
  requireOnline, reportError,
}) {
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
  // everyone but the owner (see canViewDashboard in useWorkspace) — this is
  // the only way it ever becomes true for someone else.
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
  // in useWorkspace still hides it next time `members` updates.
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
    grantAccess,
    revokeAccess,
    setMemberDashboardAccess,
    reviewSignup,
    dismissSignup,
    addAdminEmail,
    removeAdminEmail,
  };
}
