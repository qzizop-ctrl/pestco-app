import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { isAdminEmail, isPrimaryAdminEmail } from "../adminPermissions";
import { useAdminConfig } from "./useAdminConfig";
import { useAccessResolution } from "./useAccessResolution";
import { useMembersAccess } from "./useMembersAccess";
import { usePendingSignups } from "./usePendingSignups";

// Handles authentication plus multi-workspace permission resolution
// (owner / editor / viewer) — the "read side" of workspace/access. A
// signed-in user may belong to more than one owner's workspace, so this
// hook keeps track of every workspace they can see and which one is
// currently selected — and takes `screen`/`setScreen`/`setActiveId` so it
// can bounce the UI back to a safe screen when access changes underneath it.
// The "write side" (granting/revoking access, admin management) lives in
// useAccessManagement.js, which takes this hook's output (user,
// isOwnerAccount, isReviewer, etc.) as its input — see that file.
//
// This used to be one 570+ line file. It's now an orchestrator over four
// focused hooks, each independently readable/testable:
//   useAdminConfig       — config/admins listener (adminEmails, primaryAdminEmail)
//   useAccessResolution  — access_by_email listener + owner/role resolution
//   useMembersAccess     — access/{uid} listener (members, dashboardAccess)
//   usePendingSignups    — signups collection listener (reviewer only)
export function useWorkspace({ requireOnline: _requireOnline, reportError: _reportError, screen, setScreen, setActiveId }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  const { adminEmails, primaryAdminEmail } = useAdminConfig(user);

  const {
    ownerUid, myRole, myDashboardAccess, availableOwners, permissionLoading,
    authError, clearAuthError, switchOwnerWorkspace,
  } = useAccessResolution({ user, adminEmails, screen, setScreen, setActiveId });

  const { members, dashboardAccess } = useMembersAccess(user);

  // Permission flags derived from myRole (set from the access_by_email lookup).
  const canEdit = !permissionLoading && (myRole === "owner" || myRole === "editor");
  const isOwnerAccount = !permissionLoading && myRole === "owner";
  // The owner always sees their own Dashboard; everyone else needs to have
  // been individually turned on for it from Settings (off by default).
  const canViewDashboard = isOwnerAccount || myDashboardAccess === true;

  // The primary admin is whoever's email matches config/admins.primaryEmail
  // (see adminPermissions.js for the actual decision logic — kept there so
  // it's unit-tested directly, see adminPermissions.test.js). Every admin
  // added afterwards from inside the app can add further admins, but only
  // this one may remove any admin (including refusing to remove itself) —
  // see removeAdminEmail in useAccessManagement.js and the matching rule in
  // firestore.rules.
  const isPrimaryAdmin = Boolean(user) && isPrimaryAdminEmail(primaryAdminEmail, user?.email);
  const isReviewer = Boolean(user) && isAdminEmail(adminEmails, user?.email);

  const pendingSignups = usePendingSignups({ isReviewer, members });

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
    pendingSignups,
    isReviewer,
    isPrimaryAdmin,
    primaryAdminEmail,
    adminEmails,
    switchOwnerWorkspace,
  };
}
