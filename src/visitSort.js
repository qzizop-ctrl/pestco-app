// ============================================================================
// Customer-list ordering: pinned first, then by call status (overdue → today →
// upcoming → none), then newest visit date first, records without a valid
// visit date last. Same order the list has always had.
//
// This used to be an inline comparator in useFilteredData.js that called
// visitStatus() (a `new Date()` + field comparisons) and parseVisitDate()
// (regex + `new Date`) for BOTH sides of EVERY comparison — O(N log N)
// parses per sort, and the sort re-runs on every Firestore snapshot. The keys
// are now computed once per record (O(N)) and the comparator only compares
// numbers. Array.prototype.sort is stable, so records that tie keep their
// incoming order exactly as before.
// ============================================================================
import { visitStatus } from "./activityHelpers";
import { parseVisitDate } from "./dateUtils";

const STATUS_ORDER = { overdue: 0, today: 1, upcoming: 2, none: 3 };

export function sortVisitsForList(visits) {
  const keyed = visits.map((v) => {
    const d = parseVisitDate(v.visitDate);
    return {
      v,
      pinned: !!v.isPinned,
      status: STATUS_ORDER[visitStatus(v)],
      time: d ? d.getTime() : null,
    };
  });

  keyed.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.status !== b.status) return a.status - b.status;
    if (a.time === null && b.time === null) return 0;
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return b.time - a.time;
  });

  return keyed.map((k) => k.v);
}
