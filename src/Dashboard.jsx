import { useMemo, useState } from "react";
import { Calendar, Users, FileText, Wallet, TrendingUp, ChevronDown, Percent, DollarSign, FileDown } from "lucide-react";
import { PRIMARY, TEXT, MUTED, LINE, GOLD, SURFACE, SURFACE_SUBTLE, SUCCESS, DASH_NEGATIVE, DASH_PENDING } from "./theme";
import { STRINGS } from "./i18n";
import { SECTOR_IDS } from "./domain";
import { parseVisitDate, fmtMoney, fmtOffersTotals, sumOffersByCurrency, unifyOffersTotal, toJsDate } from "./helpers";
import { generateDashboardPdf } from "./pdfReport";
import { reportException } from "./sentry";
import {
  resolvePeriod, pctChange, computeAvgDealSizeForCurrency, computeWinRate,
  computeDecidedCount, buildOfferBreakdown, computePeriodStats,
  computeRejectionReasonsReport, computeTopClients, computeSectorBreakdown,
} from "./dashboardCalculations";
// The four components below used to be defined inline in this file (which
// had grown past 990 lines). They're pure presentational pieces with no
// dependency on Dashboard's internal state, so they were split out into
// src/components/ — see each file for details.
import PeriodSheet from "./components/PeriodSheet";
import SplitBar from "./components/SplitBar";
import SummaryCard from "./components/SummaryCard";
import OffersListSection from "./components/OffersListSection";
import CustomersAddedSection from "./components/CustomersAddedSection";
import SalesAnalysisCard from "./components/SalesAnalysisCard";
import StaleOffersCard from "./components/StaleOffersCard";
import SectorBreakdownCard from "./components/SectorBreakdownCard";


export default function Dashboard({
  visits, lang, onOpenCustomer, showAlert, staleOffers = [],
  exchangeRate = null, unifyCurrency = false, setUnifyCurrency = () => {},
}) {
  const t = STRINGS[lang];
  const now = new Date();

  const availableYears = useMemo(() => {
    const years = new Set([now.getFullYear()]);
    visits.forEach((v) => {
      const d = parseVisitDate(v.visitDate);
      if (d) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [visits]);

  // The committed period selection — the sheet edits a draft copy of this
  // and only overwrites it when "Apply" is tapped.
  const [period, setPeriod] = useState({
    mode: "month",
    year: now.getFullYear(),
    customType: "single",
    single: { year: now.getFullYear(), month: now.getMonth() },
    from: { year: now.getFullYear(), month: now.getMonth() },
    to: { year: now.getFullYear(), month: now.getMonth() },
  });
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [sector, setSector] = useState("all");
  const [compare, setCompare] = useState(false);
  const [offerStatusFilter, setOfferStatusFilter] = useState("all");
  // Which of the three Dashboard tabs (overview / sales / customers) is
  // currently shown below the filter bar — see the tab bar in the render
  // below. Kept as simple local UI state, not persisted.
  const [activeTab, setActiveTab] = useState("overview");
  // Within the "customers" tab, a second-level toggle between the offers
  // list and the customers-added list — both used to be stacked one after
  // the other, which made that tab long to scroll on an active month.
  const [customersSubTab, setCustomersSubTab] = useState("offers");

  const resolved = useMemo(() => resolvePeriod(period, now, t), [period, t]);
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
  const [salesTabVisited, setSalesTabVisited] = useState(false);
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
      display: fmtOffersTotals(offerBreakdown.convertedTotals, t) || `0 ${t.dashCurrency}`,
    },
    {
      key: "pending", label: t.offerStatuses.pending, color: DASH_PENDING,
      amount: offerBreakdown.pendingCount,
      display: fmtOffersTotals(offerBreakdown.pendingTotals, t) || `0 ${t.dashCurrency}`,
    },
    {
      key: "rejected", label: t.offerStatuses.rejected, color: DASH_NEGATIVE,
      amount: offerBreakdown.rejectedCount,
      display: fmtOffersTotals(offerBreakdown.rejectedTotals, t) || `0 ${t.dashCurrency}`,
    },
  ]), [offerBreakdown, t]);

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

  // ---- PDF report export ----
  const [pdfBusy, setPdfBusy] = useState(false);
  const handleExportPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      // Full offers list for the period (not limited by the on-screen
      // status-filter tabs — a manager report should show everything),
      // sorted the same way the on-screen list is.
      const allOffersInPeriod = [...stats.offersInRange].sort((a, b) => {
        const da = parseVisitDate(a.offerDate);
        const db = parseVisitDate(b.offerDate);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      });
      await generateDashboardPdf({
        t, stats, periodLabel: resolved.rangeLabel,
        sectorLabel: sector === "all" ? null : t.sectors[sector],
        avgDealSize, avgDealSizeUSD, winRate, winRateDecidedCount,
        offersList: allOffersInPeriod,
        rejectionReport,
      });
    } catch (e) {
      console.error("PDF export failed:", e);
      reportException(e, { context: "PDF export failed" });
      if (showAlert) showAlert(t.dashPdfError);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-24" style={{ direction: t.dir }}>
      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4">
        <button
          onClick={() => setPeriodSheetOpen(true)}
          className="btn-press flex items-center justify-between"
          style={{
            background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12,
            padding: "12px 14px", width: "100%",
          }}
        >
          <span className="font-bold text-sm" style={{ color: TEXT }}>
            {t.dashPeriodLabel}: {resolved.pillLabel}
          </span>
          <ChevronDown size={18} color={MUTED} />
        </button>

        {periodSheetOpen && (
          <PeriodSheet
            t={t}
            period={period}
            availableYears={availableYears}
            onApply={setPeriod}
            onClose={() => setPeriodSheetOpen(false)}
          />
        )}

        <div>
          <label>{t.dashSector}</label>
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="all">{t.dashAllSectors}</option>
            {SECTOR_IDS.map((id) => (
              <option key={id} value={id}>{t.sectors[id]}</option>
            ))}
          </select>
        </div>

        <div
          className="flex items-center justify-between"
          style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12, padding: "10px 12px" }}
        >
          <div>
            <p className="text-xs font-bold" style={{ color: TEXT }}>{t.unifyCurrencyToggle}</p>
            {!exchangeRate && (
              <p className="text-xs" style={{ color: MUTED }}>{t.unifyCurrencyNeedsRate}</p>
            )}
          </div>
          <button
            onClick={() => exchangeRate && setUnifyCurrency((v) => !v)}
            aria-label={t.unifyCurrencyToggle}
            aria-pressed={unifyCurrency && !!exchangeRate}
            disabled={!exchangeRate}
            className="btn-press"
            style={{
              width: 40, height: 22, borderRadius: 11, position: "relative",
              background: unifyCurrency && exchangeRate ? GOLD : LINE,
              border: "none", opacity: exchangeRate ? 1 : 0.5,
              cursor: exchangeRate ? "pointer" : "not-allowed",
            }}
          >
            <span
              style={{
                position: "absolute", top: 2,
                left: unifyCurrency && exchangeRate ? 20 : 2,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "left .15s",
              }}
            />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCompare((c) => !c)}
            className="btn-press flex items-center justify-center gap-2 font-bold text-xs"
            style={{
              flex: 1,
              border: `1.4px solid ${compare ? PRIMARY : LINE}`,
              background: compare ? PRIMARY : SURFACE,
              color: compare ? "#fff" : MUTED,
              borderRadius: 12,
              padding: "9px 0",
            }}
          >
            <TrendingUp size={14} /> {t.dashCompareToggle}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={pdfBusy}
            className="btn-press flex items-center justify-center gap-2 font-bold text-xs"
            style={{
              flex: 1,
              border: `1.4px solid ${GOLD}`,
              background: pdfBusy ? SURFACE_SUBTLE : GOLD,
              color: pdfBusy ? MUTED : "#fff",
              borderRadius: 12,
              padding: "9px 0",
              opacity: pdfBusy ? 0.7 : 1,
            }}
          >
            <FileDown size={14} /> {pdfBusy ? t.dashPdfGenerating : t.dashExportPdfBtn}
          </button>
        </div>
      </div>

      {/* Section tabs — the rest of the Dashboard below the filter bar is
          split into three panes (overview / sales / customers) instead of
          one long stack, so a manager sees one focused group at a time.
          The filter bar above (period/sector/compare/export) stays shared
          across all three since it drives every tab's data. */}
      <div
        className="flex items-center gap-1 mb-4"
        style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12, padding: 3 }}
      >
        {[
          { key: "overview", label: t.dashTabOverview },
          { key: "sales", label: t.dashTabSales },
          { key: "customers", label: t.dashTabCustomers },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === "sales") setSalesTabVisited(true);
            }}
            className="btn-press flex-1 font-bold text-xs"
            style={{
              borderRadius: 9,
              padding: "8px 0",
              background: activeTab === tab.key ? PRIMARY : "transparent",
              color: activeTab === tab.key ? "#fff" : MUTED,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          {/* Offers open for a while with no update — same list/threshold the
              Alerts Center uses, surfaced here too since a manager reading the
              Dashboard shouldn't have to switch screens to see it. */}
          <StaleOffersCard t={t} staleOffers={staleOffersFiltered} onOpenCustomer={onOpenCustomer} />

          {stats.visitsCount === 0 && (
            <div
              className="text-center"
              style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginBottom: 14 }}
            >
              <p className="text-sm font-bold" style={{ color: MUTED }}>{t.dashNoVisitsInPeriod}</p>
            </div>
          )}

          {/* Summary cards */}
          <div className="flex flex-wrap gap-3 mb-5">
            <SummaryCard
              icon={Calendar}
              label={t.dashCardVisits}
              value={stats.visitsCount}
              delta={compare ? (prevStats ? pctChange(stats.visitsCount, prevStats.visitsCount) : null) : undefined}
              t={t}
            />
            <SummaryCard
              icon={Users}
              label={customersAddedLabel}
              value={stats.customersAddedCount}
              delta={compare ? (prevStats ? pctChange(stats.customersAddedCount, prevStats.customersAddedCount) : null) : undefined}
              t={t}
            />
            <SummaryCard
              icon={FileText}
              label={t.dashCardOffersCount}
              value={stats.offersCount}
              delta={compare ? (prevStats ? pctChange(stats.offersCount, prevStats.offersCount) : null) : undefined}
              extra={<SplitBar segments={offersCountSegments} />}
              t={t}
            />
            <SummaryCard
              icon={Wallet}
              label={t.dashCardOffersValue}
              value={
                unifyCurrency && exchangeRate
                  ? `${fmtMoney(unifyOffersTotal(stats.offersValueTotals, exchangeRate), `${t.locale}-u-nu-latn`)} ${t.currencies.EGP}`
                  : fmtOffersTotals(stats.offersValueTotals, t, { showAllIfEmpty: true })
              }
              delta={compare ? (prevStats ? pctChange(stats.offersValueTotals.EGP, prevStats.offersValueTotals.EGP) : null) : undefined}
              extra={<SplitBar segments={offersValueSegments} />}
              t={t}
            />
            <SummaryCard
              icon={DollarSign}
              label={t.dashAvgDealSize}
              value={
      avgDealSize === null
        ? t.dashNoOffersYet
        : `${fmtMoney(avgDealSize, `${t.locale}-u-nu-latn`)} ${t.dashCurrency}`
    }
    subValue={
      avgDealSizeUSD !== null
        ? `${fmtMoney(avgDealSizeUSD, `${t.locale}-u-nu-latn`)} ${t.currencies.USD}`
        : undefined
    }
              delta={compare ? (prevStats ? pctChange(avgDealSize, prevAvgDealSize) : null) : undefined}
              t={t}
            />
            <SummaryCard
              icon={Percent}
              label={t.dashWinRate}
              value={winRate === null ? t.dashNoOffersYet : `${winRate.toFixed(0)}%`}
              subValue={winRate !== null ? t.dashWinRateSample(winRateDecidedCount) : undefined}
              delta={
                compare
                  ? (prevStats && winRate !== null && prevWinRate !== null
                      ? { points: winRate - prevWinRate }
                      : null)
                  : undefined
              }
              t={t}
            />
          </div>
        </>
      )}

      {activeTab === "sales" && (
        <>
          {/* Every sector side by side for the same period — only shown when
              "all sectors" is selected (see sectorBreakdown above). */}
          {sectorBreakdown && (
            <SectorBreakdownCard t={t} breakdown={sectorBreakdown} />
          )}

          {/* Pipeline + Sales Performance + Rejection Reasons, combined into one
              tabbed card — see SalesAnalysisCard.jsx for why these three used
              to be separate cards and no longer are. */}
          <SalesAnalysisCard
            t={t}
            stats={stats}
            prevStats={prevStats}
            compare={compare}
            rejectionReport={rejectionReport}
            prevRejectionReport={prevRejectionReport}
            topClients={topClients}
            prevTopClients={prevTopClients}
            visits={visits}
            onOpenCustomer={onOpenCustomer}
          />
        </>
      )}

      {activeTab === "customers" && (
        <>
          {/* Second-level toggle — this tab used to show the offers list
              and the customers-added list stacked one after another,
              which meant a lot of scrolling once either list had more
              than a handful of rows. */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setCustomersSubTab("offers")}
              className="btn-press font-bold text-xs"
              style={{
                flex: 1,
                borderRadius: 10,
                padding: "7px 0",
                border: `1.4px solid ${customersSubTab === "offers" ? PRIMARY : LINE}`,
                background: customersSubTab === "offers" ? PRIMARY : SURFACE,
                color: customersSubTab === "offers" ? "#fff" : MUTED,
              }}
            >
              {t.dashOffersSection}
            </button>
            <button
              onClick={() => setCustomersSubTab("customers")}
              className="btn-press font-bold text-xs"
              style={{
                flex: 1,
                borderRadius: 10,
                padding: "7px 0",
                border: `1.4px solid ${customersSubTab === "customers" ? PRIMARY : LINE}`,
                background: customersSubTab === "customers" ? PRIMARY : SURFACE,
                color: customersSubTab === "customers" ? "#fff" : MUTED,
              }}
            >
              {t.navCustomers}
            </button>
          </div>

          {customersSubTab === "offers" && (
            <OffersListSection
              t={t}
              offersList={offersList}
              offerStatusFilter={offerStatusFilter}
              setOfferStatusFilter={setOfferStatusFilter}
              offersListValueTotals={offersListValueTotals}
              visits={visits}
              onOpenCustomer={onOpenCustomer}
            />
          )}

          {customersSubTab === "customers" && (
            <CustomersAddedSection
              t={t}
              customersAddedLabel={customersAddedLabel}
              periodCustomersList={periodCustomersList}
              onOpenCustomer={onOpenCustomer}
            />
          )}
        </>
      )}
    </div>
  );
}
