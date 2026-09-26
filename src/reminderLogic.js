// ============================================================================
// Pure decision logic for the in-app call reminders (see useReminders.js).
//
// The old hook re-checked every 15 seconds for visits whose reminder time had
// passed and fired a beep + notification for each, relying on the Firestore
// field `notified` to stop repeating. That field can only be written by an
// editor, so for a viewer it never flipped: every overdue reminder beeped
// again every 15 seconds, forever. And a device that had been closed for a
// few days fired ALL the accumulated reminders at once on the next open.
//
// Fixes, all decided here so they can be unit-tested without React/Firebase:
//   1. Each device remembers which reminders it has already fired (a "seen"
//      set keyed by visit id + reminder time), independent of `notified`.
//   2. A reminder is "fresh" if it came due within FRESH_WINDOW; older ones
//      are "missed" and get collapsed into one summary instead of N alerts
//      (they are still listed in the Alerts Center, which reads callDateTime
//      directly).
// ============================================================================

export const REMINDER_POLL_MS = 15000;

// Long enough that a backgrounded tab / throttled WebView timer still counts a
// reminder as fresh when it wakes up; short enough that "opened the app after
// the weekend" is treated as catching up, not as 40 separate alarms.
export const REMINDER_FRESH_WINDOW_MS = 30 * 60 * 1000;

// Rescheduling a call changes callDateTime, which changes the key — so the
// new time fires again, exactly as it should.
export function reminderKey(visit) {
  return `${visit.id}|${visit.callDateTime}`;
}

// `pending`: visits with a call time that are not yet marked notified.
// `seen`: Set of reminderKey() values this device already fired.
// Returns { fresh, missed } — visits due now that this device hasn't fired.
export function splitDueReminders(pending, { now, seen, freshWindowMs = REMINDER_FRESH_WINDOW_MS }) {
  const fresh = [];
  const missed = [];
  for (const v of pending) {
    if (!v || !v.callDateTime) continue;
    const due = new Date(v.callDateTime).getTime();
    if (Number.isNaN(due) || due > now) continue;
    if (seen.has(reminderKey(v))) continue;
    (now - due <= freshWindowMs ? fresh : missed).push(v);
  }
  return { fresh, missed };
}
