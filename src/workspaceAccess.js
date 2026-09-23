// ============================================================================
// Pure workspace-access resolution logic, extracted out of
// useWorkspace.js's applyAccessSnap() so it can be unit-tested directly
// (see workspaceAccess.test.js) without mocking Firestore, onAuthStateChanged,
// signOut, or localStorage. useWorkspace.js is the only caller; it still owns
// every actual side effect (setState, signOut, setDoc, localStorage reads/
// writes) in exactly the same order it always did — these functions only
// decide *what* should happen from already-resolved inputs, they never
// perform any I/O themselves. Same split as adminPermissions.js, which this
// mirrors on purpose (see that file's own header comment).
// ============================================================================

// Computes the deduplicated list of workspaces (as {uid, role} pairs, role
// one of "owner"/"editor"/"viewer") this signed-in account can see, from
// the raw `owners` map on its own access_by_email/{email} doc.
//
// - An email with an explicit editor/viewer grant for some owner keeps
//   that grant.
// - The rare case of this account's own uid appearing in its own owners
//   map (as editor/viewer of "itself") is normalized to "owner" instead —
//   editor/viewer of one's own uid-keyed workspace isn't a meaningful
//   state.
// - Self-provisioning into a brand-new "owner" workspace only happens for
//   an account in config/admins (isReviewerEmail), that has no other
//   already-known external access (hasKnownExternalAccess) and no
//   external grant at all in this exact snapshot (externalOwners.length
//   === 0). See useWorkspace.js's own comment on this for why: without
//   the isReviewerEmail gate, any brand-new (or dismissed) signup would
//   silently become owner of its own empty workspace.
export function resolveNextOwners({ ownersMap, userUid, isReviewerEmail, hasKnownExternalAccess }) {
  const externalOwners = Object.entries(ownersMap || {})
    .filter(([, role]) => role === "editor" || role === "viewer")
    .map(([uid, role]) => ({ uid, role }));

  let nextOwners = externalOwners;
  if (externalOwners.some((x) => x.uid === userUid)) {
    nextOwners = externalOwners.map((x) => (x.uid === userUid ? { ...x, role: "owner" } : x));
  } else if (isReviewerEmail && !hasKnownExternalAccess && externalOwners.length === 0) {
    nextOwners = [{ uid: userUid, role: "owner" }, ...externalOwners];
  }

  const seen = new Set();
  return nextOwners.filter((x) => {
    if (seen.has(x.uid)) return false;
    seen.add(x.uid);
    return true;
  });
}

// Picks which workspace should be active out of a non-empty `nextOwners`
// list: keep the currently-resolved one if it's still valid, else fall
// back to the last one saved in localStorage if that's still valid, else
// the first available. Returns null only if nextOwners itself is empty
// (callers only ever reach this with a non-empty list in practice, since
// useWorkspace.js branches on that beforehand — the null fallback here is
// purely defensive so this function never throws on an unexpected input).
export function selectOwner({ nextOwners, currentOwner, savedOwner }) {
  const currentStillValid = nextOwners.some((x) => x.uid === currentOwner);
  if (currentStillValid) return currentOwner;
  const savedStillValid = nextOwners.some((x) => x.uid === savedOwner);
  if (savedStillValid) return savedOwner;
  return nextOwners[0]?.uid ?? null;
}

// Decides what should happen when an account resolves to zero workspaces
// (nextOwners is empty). One of:
//
//  - "wait": nothing to do yet — this was only a provisional cached
//    snapshot (allowSignOut is false), which might just be stale and
//    about to be corrected once the server confirms. Never act on it.
//  - "reviewer_no_owners": an admin/reviewer account genuinely resolved
//    to no owned/granted workspace in this confirmed snapshot. Unlike
//    every other case here, this does NOT sign the account out — a
//    reviewer always has a legitimate reason to be signed in (reviewing
//    pending signups, managing admins) even with no workspace of their
//    own selected.
//  - "needs_email_verification": sign out immediately with the
//    "unverified" auth error; never attempt the signup self-heal write
//    below (firestore.rules requires email_verified on that create, so
//    it would just fail).
//  - "sign_out_and_self_heal": sign out with the generic "not
//    registered" auth error, AND (re)write signups/{uid} first — the
//    account is verified and within the self-heal window (see
//    useWorkspace.js's comment on why 24h and why this exists at all).
//  - "sign_out_only": sign out with the generic "not registered" auth
//    error, no self-heal write — either outside the window, or this is
//    actually a long since dismissed/revoked account retrying, which
//    must not be resurrected into "pending review" again.
export function resolveNoOwnersOutcome({ allowSignOut, isReviewerEmail, emailVerified, accountAgeMs }) {
  if (!allowSignOut) return "wait";
  if (isReviewerEmail) return "reviewer_no_owners";
  if (!emailVerified) return "needs_email_verification";
  return accountAgeMs < 24 * 60 * 60 * 1000 ? "sign_out_and_self_heal" : "sign_out_only";
}
