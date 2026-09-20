// ============================================================================
// Pure logic for building a unified Audit Log entry — one record of "who
// changed what, on which customer/supplier, and when", written to
// users/{ownerUid}/auditLog whenever a customer or supplier record is
// created, edited, soft-deleted, restored, or has its pending edit
// approved/rolled back.
//
// This is additive to (not a replacement for) `last_change`: last_change is
// the single "pending edit awaiting owner review" slot on a record itself
// (cleared once approved/rolled back — see lastChange.js), while the audit
// log is an append-only history that survives that clearing, so the owner
// can look back at everything that ever happened, not just what's
// currently pending. Kept free of React/Firebase, same as lastChange.js and
// adminPermissions.js, so it's easy to unit-test in isolation.
// ============================================================================

// Metadata keys on a `changes` diff object that describe the change itself,
// not an actual field — same list as lastChange.js's
// IGNORED_LAST_CHANGE_KEYS, kept separate since the two files are meant to
// stay independent.
const IGNORED_CHANGE_KEYS = [
  "changed_by", "updatedBy", "updatedById", "updated_at", "updatedAt",
  "changes", "details", "type",
];

// Strips metadata keys out of a last_change-shaped `changes` object, so the
// audit entry's `changes` field only ever holds actual field diffs.
function cleanChanges(changes) {
  if (!changes || typeof changes !== "object") return null;
  const cleaned = {};
  Object.entries(changes).forEach(([key, val]) => {
    if (IGNORED_CHANGE_KEYS.includes(key)) return;
    cleaned[key] = val;
  });
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

// Builds one audit-log entry, ready to addDoc() into
// users/{ownerUid}/auditLog. `changes` (optional) is a last_change-style
// { field: { old_value, new_value } } diff map; entries without a
// meaningful diff (create/delete/restore/approve with nothing to show) omit
// the field entirely rather than writing an empty object.
//
// entityType: "customer" | "supplier"
// action: "create" | "update" | "delete" | "restore" | "approve" | "rollback"
export function buildAuditEntry({ entityType, entityId, entityName, action, changes, user, t }) {
  const cleaned = cleanChanges(changes);
  return {
    entityType,
    entityId,
    entityName: entityName || "",
    action,
    ...(cleaned ? { changes: cleaned } : {}),
    changedBy: user?.displayName || user?.email || (t ? t.unknownUser : ""),
    changedById: user?.uid || null,
    at: new Date().toISOString(),
  };
}
