import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, collection, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { isAdminEmail, resolvePrimaryAdminEmail, isPrimaryAdminEmail } from "../adminPermissions";
import { reportException } from "../sentry";

// Handles authentication plus multi-workspace permission resolution
// (owner / editor / viewer) — the "read side" of workspace/access. A
// signed-in user may belong to more than one owner's workspace, so this
// hook keeps track of every workspace they can see and which one is
// currently selected — and takes `screen`/`setScreen`/`setActiveId` so it
// can bounce the UI back to a safe screen when access changes underneath it.
// The "write side" (granting/revoking access, admin management) lives in
// useAccessManagement.js, which takes this hook's output (user,
// isOwnerAccount, isReviewer, etc.) as its input — see that file.
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
    // Waiting unconditionally for the server-confirmed (non-cache) snapshot
    // below is what the comment on it says: it stops a stale cached read
    // from signing a legitimate admin back out. But "wait unconditionally"
    // has no upper bound — if the very first Firestore round trip after a
    // cold app start on Android stalls (a slow-to-establish Watch stream,
    // a flaky connection at that exact moment), this listener sits with
    // adminEmails stuck at null forever. That cascades: the permission
    // effect below refuses to proceed while adminEmails === null, so
    // ownerUid never resolves, permissionLoading never turns false, and
    // the whole app is left sitting on its loading skeletons indefinitely
    // — reported as the app never finishing loading except right after
    // clearing app storage (which, being a truly empty cache, happens not
    // to hit whatever is slow/stuck about that server round trip).
    // staleFallbackTimer gives the server a bounded window (8s) to confirm
    // before falling back to the cached read just to unblock the UI; a
    // real confirmed snapshot, whenever it does arrive, always overrides
    // that fallback below, so the original stale-admin protection still
    // applies in the normal (fast network) case.
    let settled = false;
    let staleFallbackTimer = null;
    const applyAdminsSnap = (snap) => {
      const emails = (snap.data()?.emails || [])
        .map((e) => String(e).trim().toLowerCase())
        .filter(Boolean);
      setAdminEmails(emails);
      // See adminPermissions.js — explicit primaryEmail field wins, only
      // falling back to "first in the array" for a doc that predates it.
      setPrimaryAdminEmail(resolvePrimaryAdminEmail(snap.data()?.primaryEmail, emails));
    };
    const unsub = onSnapshot(
      doc(db, "config", "admins"),
      (snap) => {
        if (snap.metadata.fromCache) {
          if (!settled && !staleFallbackTimer) {
            staleFallbackTimer = setTimeout(() => {
              if (!settled) applyAdminsSnap(snap);
            }, 8000);
          }
          return;
        }
        settled = true;
        if (staleFallbackTimer) {
          clearTimeout(staleFallbackTimer);
          staleFallbackTimer = null;
        }
        applyAdminsSnap(snap);
      },
      (error) => {
        settled = true;
        if (staleFallbackTimer) {
          clearTimeout(staleFallbackTimer);
          staleFallbackTimer = null;
        }
        setAdminEmails([]);
        setPrimaryAdminEmail(null);
      }
    );
    return () => {
      if (staleFallbackTimer) clearTimeout(staleFallbackTimer);
      unsub();
    };
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

    const lookupRef = doc(db, "access_by_email", emailKey);

    // Same bounded-fallback shape as the config/admins listener above, for
    // the same reason: waiting unconditionally for the server-confirmed
    // snapshot is what stops a stale cached role from showing edit
    // controls the server would then reject (see the comment inside
    // applyAccessSnap below) — but with no upper bound, a slow/stuck first
    // round trip after a cold app start leaves ownerUid/permissionLoading
    // stuck forever, which is the "app never finishes loading" bug this
    // hook was reported for. allowSignOut gates the one part of this that
    // is genuinely unsafe to act on from a merely-provisional cached read:
    // signing the account out because it looks like it has no access.
    // That branch only runs once a real server-confirmed snapshot says so
    // — a provisional cached "no access" instead just keeps waiting rather
    // than risking a wrong sign-out. Provisional cached data that DOES
    // show valid access is applied either way, since unblocking the UI
    // with (possibly slightly stale) real access is the whole point, and
    // a later confirmed snapshot still always overrides it.
    let settled = false;
    let staleFallbackTimer = null;

    const applyAccessSnap = (snap, { allowSignOut }) => {
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
        if (!allowSignOut) {
          // Provisional cached read showing no access — could just be
          // stale and about to be corrected once the server confirms, so
          // don't take the destructive sign-out branch on it. Keep
          // waiting for the real confirmed snapshot instead.
          return;
        }
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
          // firestore.rules now requires request.auth.token.email_verified
          // on the signups/{uid} create, so an unverified account can
          // never reach the reviewer's pending list no matter what this
          // client does — closing the gap where anyone could register
          // with an email they don't own and hope to get approved on
          // sight. Tell the person to verify instead of the generic
          // "no account" message, and don't bother attempting the
          // doc write below; it would just fail.
          if (!user.emailVerified) {
            setAuthError("unverified");
            signOut(auth).catch((e) => {
              console.error("Sign-out for unverified account failed:", e);
              reportException(e, { context: "Sign-out for unverified account failed" });
            });
            return;
          }
          setAuthError(true);
          // Self-heal: AuthScreen's registration flow sends the
          // verification email right after creating the account, but
          // doesn't write signups/{uid} itself anymore (it can't yet —
          // the account isn't verified at that point). Once the person
          // verifies and logs back in, write it here instead, now that
          // the rules' email_verified check can actually pass.
          //
          // Only do this within a reasonable window of account creation
          // — this branch also covers a *dismissed* or *revoked* account
          // trying to log back in, and those must NOT reappear in
          // "pending review" every time they retry (that's what
          // dismiss/revoke are for). A verified signup retrying after
          // the original write failed and a months-old dismissed account
          // both land here identically; creation-time recency is the
          // only signal available to tell them apart. Widened from the
          // original 15 minutes since verifying an email realistically
          // takes longer than that.
          const accountAgeMs = user.metadata?.creationTime
            ? Date.now() - new Date(user.metadata.creationTime).getTime()
            : Infinity;
          if (accountAgeMs < 24 * 60 * 60 * 1000) {
            // No existence check first — a plain user can't even read the
            // signups collection (only a reviewer can, see
            // firestore.rules), so a getDoc here would just fail
            // silently and never reach the write. Firestore's own rules
            // already make this safe without one: `allow create` covers
            // a missing doc (the actual repair case), while `allow
            // update: if false` rejects this exact same call as a no-op
            // whenever the doc already exists and is correct.
            setDoc(doc(db, "signups", user.uid), {
              email: emailKey,
              createdAt: serverTimestamp(),
            }).catch((e) => {
              // permission-denied here just means the doc already exists
              // (the "update: if false" case above) — the expected,
              // harmless outcome for a still-pending or already-repaired
              // signup, not a real failure worth logging.
              if (e.code !== "permission-denied") {
                console.error("Signup self-heal failed:", e);
                reportException(e, { context: "Signup self-heal failed" });
              }
            });
          }
          signOut(auth).catch((e) => {
            console.error("Sign-out for unauthorized account failed:", e);
            reportException(e, { context: "Sign-out for unauthorized account failed" });
          });
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
    };

    const unsub = onSnapshot(
      lookupRef,
      (snap) => {
        if (snap.metadata.fromCache) {
          if (!settled && !staleFallbackTimer) {
            staleFallbackTimer = setTimeout(() => {
              if (!settled) applyAccessSnap(snap, { allowSignOut: false });
            }, 8000);
          }
          return;
        }
        settled = true;
        if (staleFallbackTimer) {
          clearTimeout(staleFallbackTimer);
          staleFallbackTimer = null;
        }
        applyAccessSnap(snap, { allowSignOut: true });
      },
      (error) => {
        settled = true;
        if (staleFallbackTimer) {
          clearTimeout(staleFallbackTimer);
          staleFallbackTimer = null;
        }
        console.error("Permission listener failed:", error);
        reportException(error, { context: "Permission listener failed" });
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

    return () => {
      if (staleFallbackTimer) clearTimeout(staleFallbackTimer);
      unsub();
    };
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
      reportException(error, { context: "Failed to load pending signups" });
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
