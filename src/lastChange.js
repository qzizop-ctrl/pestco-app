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

// The ONLY fields a rollback may write. `last_change.changes` is client-
// supplied data (an editor writes it), so without an allow-list a crafted
// record could make the owner's "rollback" button overwrite createdAt,
// offers, deleted, etc. These are the customer + supplier fields that go
// through the reviewed edit form (see firestore.rules visitAllowedKeys /
// supplierAllowedKeys, which enforce the same boundary server-side).
export const ROLLBACKABLE_FIELDS = [
  "companyName", "contactName", "sector", "role", "stage", "tags", "phone",
  "email", "visitDate", "notes", "callDateTime", "name", "category",
];

// The edit forms store this literal (Arabic for "empty") as old_value /
// new_value when a field had no value, purely so the review UI has
// something to show. It is a display placeholder, not data — restoring it
// would write the word "فارغ" into the field.
export const EMPTY_PLACEHOLDER = "فارغ";

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
function restorableValue(value) {
  if (value === EMPTY_PLACEHOLDER || value === undefined) return "";
  return value;
}

export function computeRollbackFields(lastChange) {
  const rawChanges = lastChange && (lastChange.changes || lastChange.details || lastChange);
  const rollbackFields = {};

  if (typeof rawChanges !== "object" || rawChanges === null) {
    return rollbackFields;
  }

  Object.entries(rawChanges).forEach(([field, val]) => {
    if (IGNORED_LAST_CHANGE_KEYS.includes(field)) return;
    if (!ROLLBACKABLE_FIELDS.includes(field)) return;

    if (val && typeof val === "object" && "old_value" in val) {
      rollbackFields[field] = restorableValue(val.old_value);
    } else if (typeof val !== "object") {
      rollbackFields[field] = restorableValue(val);
    }
    // else: nested object with no old_value — not enough info to restore,
    // so it's left out rather than writing something guessed.
  });

  return rollbackFields;
}

// Combines a new pending change with one another editor left on the same
// record. last_change is a single slot: the second editor's save used to
// replace the first one's, so the owner could no longer see or roll back the
// first edit. Merging keeps the OLDEST old_value per field (what the record
// looked like before any pending edit) and the newest new_value, and drops a
// field whose net effect is nothing. `next` keeps its own attribution.
// A pending delete (type: "delete") is never merged — it stands alone.
export function mergeLastChange(prev, next) {
  if (!prev || prev.type === "delete" || !prev.changes || typeof prev.changes !== "object") return next;
  if (!next || next.type === "delete") return next;

  const merged = { ...prev.changes };
  Object.entries(next.changes || {}).forEach(([field, val]) => {
    const oldest = field in prev.changes && prev.changes[field] && typeof prev.changes[field] === "object"
      ? prev.changes[field].old_value
      : val.old_value;
    if (oldest === val.new_value) delete merged[field];
    else merged[field] = { old_value: oldest, new_value: val.new_value };
  });

  const { changes: _ignored, ...meta } = next;
  return { ...meta, ...(Object.keys(merged).length > 0 ? { changes: merged } : {}) };
}
