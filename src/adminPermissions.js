// ============================================================================
// Pure admin/reviewer permission logic — deliberately kept free of React and
// Firebase so it can be unit-tested directly (see adminPermissions.test.js)
// without mocking Firestore or rendering a component.
//
// This is exactly the kind of logic that caused a real production bug
// before: "who is the primary admin" was guessed from array position
// (emails[0]), and a newly added admin ended up being treated as primary
// and could see the actual primary admin's email. These functions are now
// the single source of truth for that decision — used by
// src/hooks/useWorkspace.js on the client, and mirrored by
// firestore.rules on the server. If this logic ever needs to change,
// change it here once and both sides stay in sync in spirit.
// ============================================================================

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Is this email one of the admins? (case/whitespace-insensitive)
export function isAdminEmail(adminEmails, userEmail) {
  const emails = (adminEmails || []).map(normalizeEmail);
  const target = normalizeEmail(userEmail);
  return Boolean(target) && emails.includes(target);
}

// Resolves which email is the primary admin. Prefers the explicit
// `primaryEmail` field (set by hand once in the Firebase console — see
// firestore.rules and the README-style comment in useWorkspace.js). Falls
// back to "first entry in the emails array" only for a doc that predates
// the primaryEmail field, so older data doesn't just break outright — but
// that fallback is exactly the fragile guess that caused the original bug,
// so it's a migration aid, not something to rely on going forward.
export function resolvePrimaryAdminEmail(primaryEmailField, adminEmails) {
  const explicit = normalizeEmail(primaryEmailField);
  if (explicit) return explicit;
  const emails = (adminEmails || []).map(normalizeEmail).filter(Boolean);
  return emails[0] || null;
}

// Is this the primary admin? primaryAdminEmail should already be the
// resolved value from resolvePrimaryAdminEmail.
export function isPrimaryAdminEmail(primaryAdminEmail, userEmail) {
  const primary = normalizeEmail(primaryAdminEmail);
  if (!primary) return false;
  return normalizeEmail(userEmail) === primary;
}

// Can the current admin remove `targetEmail` from the admin list?
// Only the primary admin can remove anyone; the primary itself can never
// be removed (by itself or anyone else); and the last remaining admin can
// never be removed (the workspace would be left with no one able to
// review signups or manage admins again without the Firebase console).
export function canRemoveAdmin({ requesterIsPrimaryAdmin, targetEmail, primaryAdminEmail, adminEmailsCount }) {
  if (!requesterIsPrimaryAdmin) return false;
  const target = normalizeEmail(targetEmail);
  if (!target) return false;
  if (target === normalizeEmail(primaryAdminEmail)) return false;
  if ((adminEmailsCount || 0) <= 1) return false;
  return true;
}
