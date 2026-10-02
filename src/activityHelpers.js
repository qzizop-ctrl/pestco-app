// ============================================================================
// Activity-log and visit-history entry builders, and call/visit status.
// Split out of the old helpers.js.
// ============================================================================
import { todayLocalISO } from "./dateUtils";
import { randomSuffix } from "./randomId";

// Builds a unique activity-log entry for a visit's timeline
export function buildActivity(type, text) {
  return {
    id: `${Date.now()}-${randomSuffix()}`,
    type,
    text,
    at: new Date().toISOString(),
  };
}

// Builds a unique visit-history entry, used to track that an actual visit
// happened on a given date (as opposed to just "the current visitDate"),
// so the Dashboard can count real visit events per customer over time.
export function buildVisitEntry(date) {
  return {
    id: `${Date.now()}-${randomSuffix()}`,
    date: date || todayLocalISO(),
    at: new Date().toISOString(),
  };
}

// Returns the list of visit events for a customer. Falls back to a single
// event built from visitDate for customers that predate visit-history
// tracking, so old data still counts correctly.
export function getVisitEvents(visit) {
  if (visit.visitHistory?.length) return visit.visitHistory;
  if (visit.visitDate) return [{ id: "legacy", date: visit.visitDate, at: null }];
  return [];
}

export function visitStatus(visit) {
  if (!visit.callDateTime) return "none";
  const call = new Date(visit.callDateTime);
  const now = new Date();
  if (call.getTime() < now.getTime()) return "overdue";
  const sameDay =
    call.getFullYear() === now.getFullYear() &&
    call.getMonth() === now.getMonth() &&
    call.getDate() === now.getDate();
  if (sameDay) return "today";
  return "upcoming";
}
