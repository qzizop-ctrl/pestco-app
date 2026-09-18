import { STAGE_IDS, OFFER_STATUS_IDS, CURRENCY_IDS } from "./domain";
import { parseVisitDate, sumOffersByCurrency, getVisitEvents, toJsDate } from "./helpers";

// Pure calculation logic for the Dashboard screen — period resolution
// (turning a { mode, year, ... } selection into a concrete date range),
// and the stats/chart-bucket math derived from it. Deliberately kept free
// of React/JSX (same "pure logic in its own file, tested independently"
// pattern as adminPermissions.js) so Dashboard.jsx itself only has to hold
// the actual screen — components, layout, and state.

// ---- Period resolution ----
// The dashboard period used to be just (year, month). Now it can be one of
// five modes: the current month, a rolling "last N months" window, a whole
// year, or a custom single month / custom month range. All of them resolve
// down to the same shape — a concrete [start, end] date range, the
// equivalent previous range (for the compare toggle), a chart bucketing
// granularity, and display labels — so everything downstream (stats,
// charts, PDF export) only ever deals with dates, never with the mode.

// Adds `delta` months to (year, month), wrapping the year as needed.
function addMonths(year, month, delta) {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

function monthsBetweenInclusive(fromY, fromM, toY, toM) {
  return (toY * 12 + toM) - (fromY * 12 + fromM) + 1;
}

function monthRange(year, month) {
  return [new Date(year, month, 1, 0, 0, 0), new Date(year, month + 1, 0, 23, 59, 59)];
}

// "أغسطس 2026" for a single month, "يونيو - أغسطس 2026" for a same-year
// range, "نوفمبر 2025 - فبراير 2026" when the range crosses a year end.
function formatMonthRangeLabel(fromY, fromM, toY, toM, t) {
  if (fromY === toY && fromM === toM) return `${t.months[fromM]} ${fromY}`;
  if (fromY === toY) return `${t.months[fromM]} - ${t.months[toM]} ${fromY}`;
  return `${t.months[fromM]} ${fromY} - ${t.months[toM]} ${toY}`;
}

// period: { mode: "month"|"q3"|"q6"|"year"|"custom", year, customType: "single"|"range",
//           single: {year, month}, from: {year, month}, to: {year, month} }
export function resolvePeriod(period, now, t) {
  const nowY = now.getFullYear();
  const nowM = now.getMonth();

  if (period.mode === "q3" || period.mode === "q6") {
    const span = period.mode === "q3" ? 3 : 6;
    const from = addMonths(nowY, nowM, -(span - 1));
    const [start] = monthRange(from.year, from.month);
    const [, end] = monthRange(nowY, nowM);
    const prevTo = addMonths(from.year, from.month, -1);
    const prevFrom = addMonths(prevTo.year, prevTo.month, -(span - 1));
    const [pStart] = monthRange(prevFrom.year, prevFrom.month);
    const [, pEnd] = monthRange(prevTo.year, prevTo.month);
    return {
      start, end, prevStart: pStart, prevEnd: pEnd, granularity: "month",
      pillLabel: span === 3 ? t.dashPeriodLast3 : t.dashPeriodLast6,
      rangeLabel: formatMonthRangeLabel(from.year, from.month, nowY, nowM, t),
    };
  }

  if (period.mode === "year") {
    const y = period.year;
    const start = new Date(y, 0, 1, 0, 0, 0);
    const end = new Date(y, 11, 31, 23, 59, 59);
    const pStart = new Date(y - 1, 0, 1, 0, 0, 0);
    const pEnd = new Date(y - 1, 11, 31, 23, 59, 59);
    return {
      start, end, prevStart: pStart, prevEnd: pEnd, granularity: "month",
      pillLabel: String(y), rangeLabel: String(y),
    };
  }

  if (period.mode === "custom" && period.customType === "range") {
    const { year: fy, month: fm } = period.from;
    const { year: ty, month: tm } = period.to;
    const fromIdx = fy * 12 + fm;
    const toIdx = ty * 12 + tm;
    const [lowY, lowM, highY, highM] = fromIdx <= toIdx ? [fy, fm, ty, tm] : [ty, tm, fy, fm];
    const [start] = monthRange(lowY, lowM);
    const [, end] = monthRange(highY, highM);
    const span = monthsBetweenInclusive(lowY, lowM, highY, highM);
    const prevHigh = addMonths(lowY, lowM, -1);
    const prevLow = addMonths(prevHigh.year, prevHigh.month, -(span - 1));
    const [pStart] = monthRange(prevLow.year, prevLow.month);
    const [, pEnd] = monthRange(prevHigh.year, prevHigh.month);
    const label = formatMonthRangeLabel(lowY, lowM, highY, highM, t);
    return {
      start, end, prevStart: pStart, prevEnd: pEnd,
      granularity: span > 1 ? "month" : "day",
      pillLabel: label, rangeLabel: label,
    };
  }

  if (period.mode === "custom") {
    const { year: y, month: m } = period.single;
    const [start, end] = monthRange(y, m);
    const prev = addMonths(y, m, -1);
    const [pStart, pEnd] = monthRange(prev.year, prev.month);
    const label = `${t.months[m]} ${y}`;
    return {
      start, end, prevStart: pStart, prevEnd: pEnd, granularity: "day",
      pillLabel: label, rangeLabel: label,
    };
  }

  // Default / "month": the current calendar month.
  const [start, end] = monthRange(nowY, nowM);
  const prev = addMonths(nowY, nowM, -1);
  const [pStart, pEnd] = monthRange(prev.year, prev.month);
  return {
    start, end, prevStart: pStart, prevEnd: pEnd, granularity: "day",
    pillLabel: t.dashPeriodCurrentMonth, rangeLabel: `${t.months[nowM]} ${nowY}`,
  };
}

export function pctChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

// Average deal size, computed from EGP-denominated offers only — mixing
// currencies into one "average" number would be misleading, so this is
// intentionally scoped to the dominant currency.
// Average deal size for a specific currency. Kept per-currency rather than
// blended across currencies — averaging EGP and USD amounts together would
// be meaningless (they're different units, not just different numbers).
export function computeAvgDealSizeForCurrency(offersInRange, currency) {
  const offers = (offersInRange || []).filter((o) => (o.currency || "EGP") === currency);
  if (offers.length === 0) return null;
  const total = offers.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  return total / offers.length;
}

// Win rate: won / (won + rejected). "Won" = purchased OR installed — an
// installed offer was necessarily bought first (same reasoning as
// buildOfferBreakdown's "convertedCount" below), so excluding it here would
// silently undercount the win rate for exactly the cases that succeeded the
// most. Offers still pending aren't "decided" yet, so they're excluded from
// the denominator entirely.
export function computeWinRate(offersByStatus) {
  const won = ((offersByStatus.purchased || {}).count || 0) + ((offersByStatus.installed || {}).count || 0);
  const rejected = (offersByStatus.rejected || {}).count || 0;
  const decided = won + rejected;
  return decided > 0 ? (won / decided) * 100 : null;
}

// Sample size behind the win rate — shown alongside the percentage so a
// rate computed from very few deals (e.g. 100% from 2 deals) isn't read
// with the same confidence as one computed from a large sample.
export function computeDecidedCount(offersByStatus) {
  const won = ((offersByStatus.purchased || {}).count || 0) + ((offersByStatus.installed || {}).count || 0);
  const rejected = (offersByStatus.rejected || {}).count || 0;
  return won + rejected;
}

// Groups per-status offer stats into the three buckets shown by the split
// bars on the Offers summary cards: converted, still pending, and rejected.
// "Converted to sale" = purchased AND installed — an installed offer was
// necessarily bought first, so excluding it would silently undercount
// actual sales. Pending and rejected are kept as their own segments since
// "still open" and "lost" mean very different things for follow-up.
//
// Totals are merged per currency (not just EGP) — an earlier version only
// looked at the EGP total, so a pending offer priced in USD showed up as
// "0 جنيه" in the legend even though the card above correctly listed it
// under the "+ ... دولار" line.
function mergeTotals(...totalsList) {
  const merged = {};
  CURRENCY_IDS.forEach((id) => {
    merged[id] = totalsList.reduce((sum, t) => sum + ((t && t[id]) || 0), 0);
  });
  return merged;
}
export function buildOfferBreakdown(offersByStatus) {
  const pending = offersByStatus.pending || { count: 0, totals: {} };
  const rejected = offersByStatus.rejected || { count: 0, totals: {} };
  const purchased = offersByStatus.purchased || { count: 0, totals: {} };
  const installed = offersByStatus.installed || { count: 0, totals: {} };
  return {
    convertedCount: purchased.count + installed.count,
    convertedTotals: mergeTotals(purchased.totals, installed.totals),
    pendingCount: pending.count,
    pendingTotals: mergeTotals(pending.totals),
    rejectedCount: rejected.count,
    rejectedTotals: mergeTotals(rejected.totals),
  };
}

// Builds a per-day (single month) or per-month (multi-month range) bucket
// array of offer values for one currency, used to feed a value-trend
// BarChart.
// Rejection-reasons analytics report — groups the rejected offers already
// in `offersInRange` (same period-filtered set the Sales Performance
// section uses, filtered by offerDate like everything else on the
// Dashboard) by their rejectionReasonId, plus a by-rep breakdown for
// comparing reps. Offers rejected before this feature existed (or ones
// where the picker somehow left reasonId unset) fall back to the "other"
// bucket via rejectionReasonId || "other", so old data still counts
// instead of silently disappearing from the report.
export function computeRejectionReasonsReport(offersInRange, t) {
  const rejected = (offersInRange || []).filter((o) => o.status === "rejected");
  const total = rejected.length;

  const reasonCounts = {};
  rejected.forEach((o) => {
    // Any id Firestore has that isn't (or is no longer) one of the known
    // reasons collapses into the same "other" bucket as offers with no
    // reasonId at all, so they show up as one row instead of one per
    // unrecognized id that happen to share the same "other" label.
    const rawId = o.rejectionReasonId || "other";
    const id = t.rejectionReasons[rawId] ? rawId : "other";
    reasonCounts[id] = (reasonCounts[id] || 0) + 1;
  });

  // Round each share down first, then hand the leftover percentage points
  // (one each) to the entries with the largest fractional remainder, so
  // the displayed percentages always add up to exactly 100.
  const entries = Object.entries(reasonCounts).map(([id, count]) => {
    const rawPct = total > 0 ? (count / total) * 100 : 0;
    return { id, count, floor: Math.floor(rawPct), remainder: rawPct - Math.floor(rawPct) };
  });
  let leftover = total > 0 ? 100 - entries.reduce((sum, e) => sum + e.floor, 0) : 0;
  entries
    .slice()
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((e) => {
      if (leftover > 0) {
        e.floor += 1;
        leftover -= 1;
      }
    });

  const byReason = entries
    .map(({ id, count, floor }) => ({
      id,
      label: t.rejectionReasons[id] || t.rejectionReasons.other,
      count,
      pct: floor,
    }))
    .sort((a, b) => b.count - a.count);

  const repCounts = {};
  rejected.forEach((o) => {
    const name = o.rejectedBy || t.unknownUser;
    repCounts[name] = (repCounts[name] || 0) + 1;
  });
  const byRep = Object.entries(repCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { total, byReason, byRep };
}

export function buildOffersChartData(offersInRange, currency, granularity, start, end, months) {
  const inCurrency = (o) => (o.currency || "EGP") === currency;

  if (granularity === "day") {
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const buckets = Array.from({ length: daysInMonth }, (_, i) => ({ label: String(i + 1), value: 0 }));
    offersInRange.filter(inCurrency).forEach((o) => {
      const d = parseVisitDate(o.offerDate);
      if (d) buckets[d.getDate() - 1].value += Number(o.amount) || 0;
    });
    return buckets;
  }

  const spansMultipleYears = start.getFullYear() !== end.getFullYear();
  const buckets = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endCursor) {
    buckets.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
      label: spansMultipleYears
        ? `${months[cursor.getMonth()].slice(0, 3)} ${String(cursor.getFullYear()).slice(2)}`
        : months[cursor.getMonth()].slice(0, 3),
      value: 0,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  offersInRange.filter(inCurrency).forEach((o) => {
    const d = parseVisitDate(o.offerDate);
    if (!d) return;
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
    if (bucket) bucket.value += Number(o.amount) || 0;
  });
  return buckets;
}

export function computePeriodStats(visits, start, end, sector, isSingleMonth) {
  const inSector = (v) => sector === "all" || v.sector === sector;
  const inRange = (dateStr) => {
    const d = parseVisitDate(dateStr);
    return d && d >= start && d <= end;
  };

  // Every individual logged visit event within the period (a customer
  // visited 3 times in the period contributes 3 here).
  const visitEventsInRange = visits
    .filter(inSector)
    .flatMap((v) => getVisitEvents(v).filter((e) => inRange(e.date)).map((e) => ({ ...e, customer: v })));

  // Distinct customers who had at least one visit event in the period.
  const customerIdsInRange = new Set(visitEventsInRange.map((e) => e.customer.id));
  const filteredVisits = visits.filter((v) => customerIdsInRange.has(v.id));

  // Customers added during the period (by createdAt), regardless of whether
  // a visit has been logged for them yet — this is what "Total Customers"
  // on the dashboard reflects, not just customers who were visited.
  // Records with no createdAt (legacy/imported data missing the field, or
  // a brand-new record whose serverTimestamp hasn't finished syncing yet)
  // fall back to visit status: if the customer has never been visited
  // either, there's no reliable date to exclude them by, so they're always
  // counted rather than disappearing whenever a specific single month is
  // selected. A dateless record that HAS been visited is still only
  // counted in multi-month views, since we can't confirm which single
  // month it belongs to.
  const customersAddedInRange = visits.filter((v) => {
    if (!inSector(v)) return false;
    const d = toJsDate(v.createdAt);
    if (!d) return !isSingleMonth || getVisitEvents(v).length === 0;
    return d >= start && d <= end;
  });

  const offersInRange = visits
    .filter(inSector)
    .flatMap((v) =>
      (v.offers || [])
        .filter((o) => inRange(o.offerDate))
        .map((o) => ({
          ...o,
          customerId: v.id,
          customerName: v.companyName,
          sector: v.sector,
        }))
    );

  const offersValueTotals = sumOffersByCurrency(offersInRange);

  // Sales performance: how many offers landed in each outcome, and their
  // value per currency, within the selected period.
  const offersByStatus = {};
  OFFER_STATUS_IDS.forEach((id) => {
    const group = offersInRange.filter((o) => o.status === id);
    offersByStatus[id] = { count: group.length, totals: sumOffersByCurrency(group) };
  });

  const pipeline = {};
  STAGE_IDS.forEach((id) => (pipeline[id] = 0));
  pipeline.none = 0;
  filteredVisits.forEach((v) => {
    const s = v.stage && STAGE_IDS.includes(v.stage) ? v.stage : "none";
    pipeline[s] += 1;
  });

  return {
    start,
    end,
    filteredVisits,
    visitEventsInRange,
    offersInRange,
    visitsCount: visitEventsInRange.length,
    customersCount: customerIdsInRange.size,
    customersAddedCount: customersAddedInRange.length,
    // Exposed so the "customers in this period" list on the dashboard can
    // show exactly the same set of customers the card above counts —
    // previously it used a different rule (visitDate-based, always
    // including no-visitDate customers regardless of month) and could
    // show a different, larger set than what the count reflected.
    customersAddedList: customersAddedInRange,
    offersCount: offersInRange.length,
    offersValueTotals,
    offersByStatus,
    pipeline,
  };
}
