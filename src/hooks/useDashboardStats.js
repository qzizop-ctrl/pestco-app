import { useMemo } from "react";
import { SUCCESS, DASH_NEGATIVE, DASH_PENDING } from "../theme";
import { parseVisitDate, fmtUnifiedOrSplit, sumOffersByCurrency, toJsDate } from "../helpers";
import {
  resolvePeriod, computeAvgDealSizeForCurrency, computeWinRate,
  computeDecidedCount, buildOfferBreakdown, computePeriodStats,
  computeRejectionReasonsReport, computeTopClients, computeSectorBreakdown,
} from "../dashboardCalculations";

// ---------------------------------------------------------------------------
// Extracted from Dashboard.jsx. Every one of these used to be its own
// useMemo sitting directly in the component, in the same order as below —
// nothing about what's computed or when it recomputes changed, only where
// the code lives. Kept as a single hook (not several) because almost every
// value here is derived from `stats`/`resolved`, which are themselves
// derived from `period`/`sector`/`compare` — splitting further would just
// mean passing that same chain across multiple hook boundaries for no
// real gain in readability.
// ---------------------------------------------------------------------------
export function useDashboardStats({
  visits, t, now, period, sector, compare,
  exchangeRate, unifyCurrency, salesTabVisited, staleOffers, offerStatusFilter,
}) {
  const availableYears = useMemo(() => {
    const years = new Set([now.getFullYear()]);
    visits.forEach((v) => {
      const d = parseVisitDate(v.visitDate);
      if (d) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [visits, now]);

  const resolved = useMemo(() => resolvePeriod(period, now, t), [period, now, t]);
  const isSingleMonth = resolved.granularity === "day";

  const stats = useMemo(
    () => computePeriodStats(visits, resolved.start, resolved.end, sector, isSingleMonth),
    [visits, resolved, sector, isSingleMonth]
  );

  const prevStats = useMemo(() => {
    if (!compare) return null;
    return computePeriodStats(visits, resolved.prevStart, resolved.prevEnd, sector, isSingleMonth);
  }, [visits, resolved, sector, isSingleMonth, compare]);

  const avgDealSize = useMemo(() => computeAvgDealSizeForCurrency(stats.offersInRange, "EGP"), [stats]);
  const prevAvgDealSize = useMemo(() => (prevStats ? computeAvgDealSizeForCurrency(prevStats.offersInRange, "EGP") : null), [prevStats]);
  const avgDealSizeUSD = useMemo(() => computeAvgDealSizeForCurrency(stats.offersInRange, "USD"), [stats]);
  const winRate = useMemo(() => computeWinRate(stats.offersByStatus), [stats]);
  const winRateDecidedCount = useMemo(() => computeDecidedCount(stats.offersByStatus), [stats]);
  const prevWinRate = useMemo(() => (prevStats ? computeWinRate(prevStats.offersByStatus) : null), [prevStats]);

  // Offer status breakdown used by the split bars on the Offers cards below.
  const offerBreakdown = useMemo(() => buildOfferBreakdown(stats.offersByStatus), [stats]);

  // Rejection-reasons analytics — see dashboardCalculations.js. Reuses the
  // same period/sector-filtered offersInRange as the rest of the Dashboard,
  // so the report's date range is just the existing period picker above.
  const rejectionReport = useMemo(() => computeRejectionReasonsReport(stats.offersInRange, t), [stats, t]);

  // Same report for the previous period, used only to drive the "compare
  // to previous month" deltas on the Rejection Reasons tab — null whenever
  // compare is off, same convention as prevStats above.
  const prevRejectionReport = useMemo(
    () => (compare && prevStats ? computeRejectionReasonsReport(prevStats.offersInRange, t) : null),
    [compare, prevStats, t]
  );

  // Top clients by offer value in the selected period — see
  // computeTopClients in dashboardCalculations.js.
  const topClients = useMemo(() => computeTopClients(stats.offersInRange, 5), [stats]);

  // Every client (not just the current period's top 5) from the previous
  // period, so a client who's in this period's top 5 can be compared even
  // if they weren't themselves in last period's top 5 — SalesAnalysisCard
  // looks each one up by customerId/customerName.
  const prevTopClients = useMemo(
    () => (compare && prevStats ? computeTopClients(prevStats.offersInRange, Infinity) : null),
    [compare, prevStats]
  );

  // Every sector's numbers side by side, for the same period — only
  // meaningful (and only computed) when no single sector is already
  // selected, since with one sector picked there's nothing to compare.
  // Also skipped entirely until the "sales" tab has actually been opened
  // at least once — this is the priciest of the Dashboard's derived stats
  // on a large visits list, and most sessions land on "overview" and
  // never open "sales" at all.
  const sectorBreakdown = useMemo(
    () => (sector === "all" && salesTabVisited ? computeSectorBreakdown(visits, resolved.start, resolved.end, isSingleMonth) : null),
    [visits, resolved, isSingleMonth, sector, salesTabVisited]
  );

  // Stale (in-progress) offers relevant to the Dashboard's own sector
  // filter — `staleOffers` itself comes from useFilteredData.js at the App
  // level (same source AlertsCenter reads), deliberately NOT re-filtered
  // by the Dashboard's period picker (see StaleOffersCard.jsx for why).
  const staleOffersFiltered = useMemo(
    () => (sector === "all" ? staleOffers : staleOffers.filter((o) => o.customer.sector === sector)),
    [staleOffers, sector]
  );

  const offersCountSegments = useMemo(() => ([
    { key: "converted", label: t.dashOffersConverted, color: SUCCESS, amount: offerBreakdown.convertedCount, display: offerBreakdown.convertedCount },
    { key: "pending", label: t.offerStatuses.pending, color: DASH_PENDING, amount: offerBreakdown.pendingCount, display: offerBreakdown.pendingCount },
    { key: "rejected", label: t.offerStatuses.rejected, color: DASH_NEGATIVE, amount: offerBreakdown.rejectedCount, display: offerBreakdown.rejectedCount },
  ]), [offerBreakdown, t]);

  const offersValueSegments = useMemo(() => ([
    {
      key: "converted", label: t.dashOffersConverted, color: SUCCESS,
      amount: offerBreakdown.convertedCount,
      display: fmtUnifiedOrSplit(offerBreakdown.convertedTotals, t, exchangeRate, unifyCurrency) || `0 ${t.dashCurrency}`,
    },
    {
      key: "pending", label: t.offerStatuses.pending, color: DASH_PENDING,
      amount: offerBreakdown.pendingCount,
      display: fmtUnifiedOrSplit(offerBreakdown.pendingTotals, t, exchangeRate, unifyCurrency) || `0 ${t.dashCurrency}`,
    },
    {
      key: "rejected", label: t.offerStatuses.rejected, color: DASH_NEGATIVE,
      amount: offerBreakdown.rejectedCount,
      display: fmtUnifiedOrSplit(offerBreakdown.rejectedTotals, t, exchangeRate, unifyCurrency) || `0 ${t.dashCurrency}`,
    },
  ]), [offerBreakdown, t, exchangeRate, unifyCurrency]);

  const customersAddedLabel = useMemo(
    () => t.dashCustomersAddedLabel(resolved.rangeLabel),
    [t, resolved]
  );

  // Customers behind the "Customers added" card above: the exact same set
  // (createdAt-based, matching the card's count) rather than a separately
  // computed visitDate-based list, so this list and that number always
  // agree — sorted with the most recently added first.
  const periodCustomersList = useMemo(() => {
    return [...stats.customersAddedList].sort((a, b) => {
      const da = toJsDate(a.createdAt);
      const db = toJsDate(b.createdAt);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });
  }, [stats]);

  const offersList = useMemo(() => {
    return stats.offersInRange
      .filter((o) => offerStatusFilter === "all" || o.status === offerStatusFilter)
      .sort((a, b) => {
        const da = parseVisitDate(a.offerDate);
        const db = parseVisitDate(b.offerDate);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      });
  }, [stats, offerStatusFilter]);

  const offersListValueTotals = sumOffersByCurrency(offersList);

  return {
    availableYears, resolved, isSingleMonth, stats, prevStats,
    avgDealSize, prevAvgDealSize, avgDealSizeUSD, winRate, winRateDecidedCount, prevWinRate,
    offerBreakdown, rejectionReport, prevRejectionReport, topClients, prevTopClients,
    sectorBreakdown, staleOffersFiltered, offersCountSegments, offersValueSegments,
    customersAddedLabel, periodCustomersList, offersList, offersListValueTotals,
  };
}
