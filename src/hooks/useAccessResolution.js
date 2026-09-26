import { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { resolveNextOwners, selectOwner, resolveNoOwnersOutcome } from "../workspaceAccess";
import { reportException } from "../sentry";

// Resolves which workspace(s) a signed-in user has access to and as what
// role (owner / editor / viewer), and keeps that selection in sync with
// access_by_email/{email} in real time. Split out of useWorkspace.js, which
// used to hold this alongside the config/admins listener, the members
// listener, and the pending-signups listener all in one 570+ line file —
// this piece is the one that actually does the owner/role resolution and
// the sign-out-on-no-access decisions, so it's kept together as a unit
// rather than split further.
export function useAccessResolution({ user, adminEmails, screen, setScreen, setActiveId }) {
  const [ownerUid, setOwnerUid] = useState(null);
  const [myRole, setMyRole] = useState(null);
  // Whether *this* signed-in account (as editor/viewer, not owner) has been
  // individually turned on for Dashboard access by the workspace owner —
  // read from this account's own access_by_email doc. Irrelevant for the
  // owner themselves; see canViewDashboard in useWorkspace.js, which always
  // allows the owner regardless of this.
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
      } catch {
        // localStorage may be unavailable (e.g. private browsing) — safe to ignore.
      }
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

    // firestore.rules only honors an email once Firebase has VERIFIED it
    // (hasEmail() requires email_verified), for admins, members and owners
    // alike — email/password sign-up lets anyone register any address, so an
    // unverified token must never carry access. An unverified account would
    // just get permission-denied on every read/write, so end the session
    // here with the same "please verify your email" message the no-access
    // path uses. (AuthScreen re-sends the verification email on login.)
    if (!user.emailVerified) {
      setOwnerUid(null);
      setMyRole(null);
      setMyDashboardAccess(false);
      setAvailableOwners([]);
      previousResolvedOwnerRef.current = null;
      setScreen("list");
      setActiveId(null);
      setPermissionLoading(false);
      setAuthError("unverified");
      signOut(auth).catch((e) => {
        console.error("Sign-out for unverified account failed:", e);
        reportException(e, { context: "Sign-out for unverified account failed" });
      });
      return;
    }

    // Wait for the admin list before resolving anything — see useAdminConfig.js.
    // permissionLoading stays true a moment longer instead of risking a
    // wrong (and disruptive) sign-out decision below.
    if (adminEmails === null) return;

    const lookupRef = doc(db, "access_by_email", emailKey);

    // Same bounded-fallback shape as the config/admins listener in
    // useAdminConfig.js, for the same reason: waiting unconditionally for
    // the server-confirmed snapshot is what stops a stale cached role from
    // showing edit controls the server would then reject (see the comment
    // inside applyAccessSnap below) — but with no upper bound, a
    // slow/stuck first round trip after a cold app start leaves
    // ownerUid/permissionLoading stuck forever, which is the "app never
    // finishes loading" bug this hook was reported for. allowSignOut gates
    // the one part of this that is genuinely unsafe to act on from a
    // merely-provisional cached read: signing the account out because it
    // looks like it has no access. That branch only runs once a real
    // server-confirmed snapshot says so — a provisional cached "no access"
    // instead just keeps waiting rather than risking a wrong sign-out.
    // Provisional cached data that DOES show valid access is applied
    // either way, since unblocking the UI with (possibly slightly stale)
    // real access is the whole point, and a later confirmed snapshot still
    // always overrides it.
    let settled = false;
    let staleFallbackTimer = null;

    const applyAccessSnap = (snap, { allowSignOut }) => {
      const ownersMap = snap.exists() ? snap.data().owners || {} : {};
      // Single-owner app (see the comment in grantAccess in
      // useAccessManagement.js), so this is a flat boolean rather than
      // keyed per-owner — matches how `owners` itself is already treated
      // as "at most one real entry" everywhere else in this file.
      setMyDashboardAccess(snap.exists() && snap.data().dashboardAccess === true);

      // The signed-in account is always an owner of its own workspace on
      // initial login, but only when they have no other granted access —
      // someone who was invited as a viewer/editor should land straight
      // in the workspace they were granted, never in a phantom empty
      // "Owner" workspace of their own. A revoked external user must also
      // NOT be converted into a new owner workspace.
      //
      // Self-provisioning into an "owner" workspace is further restricted
      // to accounts in config/admins (see adminEmails). This is a
      // single-owner app: anyone else who signs up writes a
      // `signups/{uid}` doc and must be explicitly granted editor/viewer
      // access from Settings first. Without this check, any brand-new
      // registration (or a dismissed/removed one) fell through to "no
      // other access found" and was silently made owner of its own empty
      // workspace — which is exactly what let an un-reviewed or dismissed
      // account see the Settings screen and still use the app.
      //
      // The actual decision (which owners this account ends up with) now
      // lives in resolveNextOwners() — see workspaceAccess.js — kept pure
      // and unit-tested there rather than inline here.
      const previousOwner = previousResolvedOwnerRef.current;
      const hasKnownExternalAccess = Boolean(previousOwner && previousOwner !== user.uid);
      const isReviewerEmail = adminEmails.includes(emailKey);

      const nextOwners = resolveNextOwners({
        ownersMap, userUid: user.uid, isReviewerEmail, hasKnownExternalAccess,
      });

      if (nextOwners.length === 0) {
        // See resolveNoOwnersOutcome() in workspaceAccess.js for what each
        // outcome means; everything below is just carrying out that
        // decision with the actual side effects (setState/signOut/setDoc)
        // it always performed, in the same order as before.
        const outcome = resolveNoOwnersOutcome({
          allowSignOut,
          isReviewerEmail,
          emailVerified: user.emailVerified,
          accountAgeMs: user.metadata?.creationTime
            ? Date.now() - new Date(user.metadata.creationTime).getTime()
            : Infinity,
        });

        if (outcome === "wait") {
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
        if (outcome === "needs_email_verification") {
          // firestore.rules now requires request.auth.token.email_verified
          // on the signups/{uid} create, so an unverified account can
          // never reach the reviewer's pending list no matter what this
          // client does — closing the gap where anyone could register
          // with an email they don't own and hope to get approved on
          // sight. Tell the person to verify instead of the generic
          // "no account" message, and don't bother attempting the
          // doc write below; it would just fail.
          setAuthError("unverified");
          signOut(auth).catch((e) => {
            console.error("Sign-out for unverified account failed:", e);
            reportException(e, { context: "Sign-out for unverified account failed" });
          });
          return;
        }

        if (outcome === "sign_out_and_self_heal" || outcome === "sign_out_only") {
          setAuthError(true);
          if (outcome === "sign_out_and_self_heal") {
            // Self-heal: AuthScreen's registration flow sends the
            // verification email right after creating the account, but
            // doesn't write signups/{uid} itself anymore (it can't yet —
            // the account isn't verified at that point). Once the person
            // verifies and logs back in, write it here instead, now that
            // the rules' email_verified check can actually pass.
            //
            // Only within a reasonable window of account creation — this
            // branch also covers a *dismissed* or *revoked* account
            // trying to log back in, and those must NOT reappear in
            // "pending review" every time they retry (that's what
            // dismiss/revoke are for). A verified signup retrying after
            // the original write failed and a months-old dismissed
            // account both land here identically; creation-time recency
            // is the only signal available to tell them apart. Widened
            // from the original 15 minutes since verifying an email
            // realistically takes longer than that.
            //
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
        // outcome === "reviewer_no_owners": nothing further to do — a
        // reviewer with no resolved workspace still stays signed in.
        return;
      }

      setAvailableOwners(nextOwners);

      let savedOwner = null;
      try {
        savedOwner = localStorage.getItem("pestco_selected_owner");
      } catch {
        // localStorage may be unavailable (e.g. private browsing) — safe to ignore.
      }

      const selected = selectOwner({
        nextOwners, currentOwner: previousResolvedOwnerRef.current, savedOwner,
      });

      const selectedEntry = nextOwners.find((x) => x.uid === selected);
      setOwnerUid(selected);
      setMyRole(selectedEntry?.role || null);
      previousResolvedOwnerRef.current = selected;
      try {
        localStorage.setItem("pestco_selected_owner", selected);
      } catch {
        // localStorage may be unavailable (e.g. private browsing) — safe to ignore.
      }
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
  }, [user, adminEmails, setActiveId, setScreen]);

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
    } catch {
      // localStorage may be unavailable (e.g. private browsing) — safe to ignore.
    }
  };

  return {
    ownerUid,
    myRole,
    myDashboardAccess,
    availableOwners,
    permissionLoading,
    authError,
    clearAuthError,
    switchOwnerWorkspace,
  };
}
