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
  "changes", "details", "type", "addedVisitEntryIds",
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

    if (val && typeof val === "object" && !Array.isArray(val) && "old_value" in val) {
      rollbackFields[field] = restorableValue(val.old_value);
    } else if (typeof val !== "object") {
      rollbackFields[field] = restorableValue(val);
    }
    // else: nested object with no old_value — not enough info to restore,
    // so it's left out rather than writing something guessed.
  });

  // `tags` is always an array in Firestore. A record that had no tags stores
  // the "empty" placeholder as old_value, which restorableValue() turns into
  // "" — writing that back would leave a string where an array belongs.
  if ("tags" in rollbackFields && !Array.isArray(rollbackFields.tags)) {
    rollbackFields.tags = [];
  }

  return rollbackFields;
}

// ---------------------------------------------------------------------------
// Value comparison helpers (used when recording and merging pending changes)
// ---------------------------------------------------------------------------

// Order-insensitive comparison of two tag lists: re-ordering the same tags is
// not a change worth sending to the owner for review.
export function tagsChanged(oldTags, newTags) {
  const norm = (v) => (Array.isArray(v) ? [...v].map(String).sort() : []);
  const a = norm(oldTags);
  const b = norm(newTags);
  return a.length !== b.length || a.some((x, i) => x !== b[i]);
}

// Equality for the values a `changes` diff can hold: scalars, or arrays of
// scalars (tags). Plain === would treat two equal arrays as different.
export function sameChangeValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => x === b[i]);
  }
  return a === b;
}

// Display text for one side of a change: arrays (tags) as a comma-separated
// list, empty values as an em dash. Shared by the pending-change banner and
// the Audit Log screen so both render tag changes the same way.
export function formatChangeValue(v) {
  if (Array.isArray(v)) return v.length > 0 ? v.join(", ") : "—";
  if (v === undefined || v === null || v === "") return "—";
  return String(v);
}

// JSON with sorted keys, so two structurally identical objects stringify the
// same regardless of the order Firestore / the client built their keys in.
function stableStringify(value) {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

// True when `a` and `b` describe the very same pending change. The owner's
// approve / rollback compares the last_change they were LOOKING AT with the
// one currently stored: if they differ, an editor saved something in between
// and the owner would be approving (or rolling back) a change they never saw.
export function sameLastChange(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return stableStringify(a) === stableStringify(b);
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
    if (sameChangeValue(oldest, val.new_value)) delete merged[field];
    else merged[field] = { old_value: oldest, new_value: val.new_value };
  });

  // Visit-history entries added by either edit must all be undone together
  // if the owner rolls the merged change back.
  const entryIds = [
    ...(Array.isArray(prev.addedVisitEntryIds) ? prev.addedVisitEntryIds : []),
    ...(Array.isArray(next.addedVisitEntryIds) ? next.addedVisitEntryIds : []),
  ];

  const { changes: _ignored, addedVisitEntryIds: _ids, ...meta } = next;
  return {
    ...meta,
    ...(Object.keys(merged).length > 0 ? { changes: merged } : {}),
    ...(entryIds.length > 0 ? { addedVisitEntryIds: entryIds } : {}),
  };
}
