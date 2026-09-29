// ============================================================================
// Pure logic for turning a visit's `last_change` record back into the field
// values it should roll back to. Extracted out of CustomerDetail.jsx's
// handleRollback so it can be unit-tested directly (see
// lastChange.test.js) without rendering the component or mocking Firestore.
//
// This is exactly the kind of logic worth testing in isolation: it decides
// what data an owner's "rollback" button actually writes back over a
// pending edit, so a mistake here silently restores the wrong values
// instead of throwing.
// ============================================================================

// Metadata keys that describe the change itself, never a field to restore.
// Includes "type" (e.g. "delete" on a pending-delete's last_change, set by
// useCustomerRecords.js/useSupplierRecords.js) — without it, calling this on
// a pending-delete's last_change (which has no `changes`/`details` sub-object,
// so it falls through to reading last_change itself) would return
// `{ type: "delete" }` and a caller that then wrote that back would leave a
// stray `type` field on the record. Today's UI never reaches this path (see
// PendingChangeBanner.jsx: a pending delete only offers confirm/restore, no
// rollback), but the pure function itself should never produce that field.
export const IGNORED_LAST_CHANGE_KEYS = [
  "changed_by", "updatedBy", "updatedById", "updated_at", "updatedAt",
  "changes", "details", "type",
];

// Given a visit's `last_change` object, returns the plain field -> value map
// that a rollback should write. Does NOT include `last_change` itself —
// the caller is responsible for clearing that separately (with Firestore's
// deleteField() sentinel on the client), since that's a Firestore-specific
// concern outside this pure function.
//
// Accepts either shape last_change has been stored in: a `changes` or
// `details` sub-object holding the per-field diffs, or the diffs sitting
// directly on last_change itself (older records). A per-field value can
// either be `{ old_value: ... }` (the value to restore) or a bare scalar
// (restored as-is); anything else (nested objects without old_value) is
// skipped rather than guessed at.
export function computeRollbackFields(lastChange) {
  const rawChanges = lastChange && (lastChange.changes || lastChange.details || lastChange);
  const rollbackFields = {};

  if (typeof rawChanges !== "object" || rawChanges === null) {
    return rollbackFields;
  }

  Object.entries(rawChanges).forEach(([field, val]) => {
    if (IGNORED_LAST_CHANGE_KEYS.includes(field)) return;

    if (val && typeof val === "object" && "old_value" in val) {
      rollbackFields[field] = val.old_value;
    } else if (typeof val !== "object") {
      rollbackFields[field] = val;
    }
    // else: nested object with no old_value — not enough info to restore,
    // so it's left out rather than writing something guessed.
  });

  return rollbackFields;
}
