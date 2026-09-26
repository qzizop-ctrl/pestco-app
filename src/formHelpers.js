// ============================================================================
// Edit-form diffing helpers. Split out of the old helpers.js.
// ============================================================================

function sameFieldValue(a, b) {
  if (a === b) return true;
  if (a && b && typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

// Returns only the fields of `data` whose value differs from `baseline`.
// A missing/null/"" value on either side counts as empty; `defaults` (optional)
// fills in a field the baseline object has never had.
//
// Why this exists: the edit form used to write the WHOLE document back on
// save. If someone else pinned the customer, changed its stage, or
// rescheduled a call while the form was open, saving silently put the
// form's stale copy of those fields back. The right baseline is therefore
// the form as it was when it was OPENED (not the live record, which may
// already contain the other person's change): comparing against it yields
// exactly the fields THIS person edited, and only those are sent.
export function diffVisitFields(baseline, data, defaults = {}) {
  const changed = {};
  Object.keys(data).forEach((key) => {
    const oldVal = baseline[key] !== undefined ? baseline[key] : defaults[key];
    const newVal = data[key];
    if (!sameFieldValue(oldVal ?? "", newVal ?? "")) changed[key] = newVal;
  });
  return changed;
}

// The fields to send when saving an EDIT of an existing customer: what the
// person changed relative to the form as opened (see diffVisitFields), or
// everything when there is no baseline. Rescheduling the follow-up call also
// re-arms the in-app reminder — without resetting `notified`, a call that was
// already reminded once would never fire again for its new date/time.
export function buildVisitEditFields(baseline, data) {
  if (!baseline) return { ...data };
  const fields = diffVisitFields(baseline, data);
  if (fields.callDateTime) fields.notified = false;
  return fields;
}
