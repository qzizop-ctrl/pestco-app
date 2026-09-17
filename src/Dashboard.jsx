import React, { useMemo, useState } from "react";
import { Calendar, Users, FileText, Wallet, TrendingUp, TrendingDown, ChevronLeft, ChevronDown, Percent, DollarSign, FileDown, X } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { stageColor, offerStatusColor, PRIMARY, PRIMARY_MID, TEXT, MUTED, LINE, GOLD, GOLD_SOFT, SURFACE, SURFACE_SUBTLE } from "./theme";
import { STRINGS } from "./i18n";
import { SECTOR_IDS, STAGE_IDS, OFFER_STATUS_IDS } from "./domain";
import { parseVisitDate, fmtMoney, fmtOffersTotals, sumOffersByCurrency, toJsDate } from "./helpers";
import { generateDashboardPdf } from "./pdfReport";
import {
  resolvePeriod, pctChange, computeAvgDealSizeForCurrency, computeWinRate,
  computeDecidedCount, buildOfferBreakdown, buildOffersChartData, computePeriodStats,
} from "./dashboardCalculations";
// The four components below used to be defined inline in this file (which
// had grown past 990 lines). They're pure presentational pieces with no
// dependency on Dashboard's internal state, so they were split out into
// src/components/ — see each file for details.
import PeriodSheet from "./components/PeriodSheet";
import SplitBar from "./components/SplitBar";
import SummaryCard from "./components/SummaryCard";
import SwipeableChartCard from "./components/SwipeableChartCard";
import OffersListSection from "./components/OffersListSection";
import CustomersAddedSection from "./components/CustomersAddedSection";

export default function Dashboard({ visits, lang, onOpenCustomer, showAlert }) {
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
  const hasEGPOffers = useMemo(() => stats.offersInRange.some((o) => (o.currency || "EGP") === "EGP"), [stats]);
  const hasUSDOffers = useMemo(() => stats.offersInRange.some((o) => o.currency === "USD"), [stats]);
  const winRate = useMemo(() => computeWinRate(stats.offersByStatus), [stats]);
  const winRateDecidedCount = useMemo(() => computeDecidedCount(stats.offersByStatus), [stats]);
  const prevWinRate = useMemo(() => (prevStats ? computeWinRate(prevStats.offersByStatus) : null), [prevStats]);

  // Offer status breakdown used by the split bars on the Offers cards below.
  const offerBreakdown = useMemo(() => buildOfferBreakdown(stats.offersByStatus), [stats]);

  const offersCountSegments = useMemo(() => ([
    { key: "converted", label: t.dashOffersConverted, color: "#2F9E58", amount: offerBreakdown.convertedCount, display: offerBreakdown.convertedCount },
    { key: "pending", label: t.offerStatuses.pending, color: "#C7A24A", amount: offerBreakdown.pendingCount, display: offerBreakdown.pendingCount },
    { key: "rejected", label: t.offerStatuses.rejected, color: "#C4443A", amount: offerBreakdown.rejectedCount, display: offerBreakdown.rejectedCount },
  ]), [offerBreakdown, t]);

  const offersValueSegments = useMemo(() => ([
    {
      key: "converted", label: t.dashOffersConverted, color: "#2F9E58",
      amount: offerBreakdown.convertedCount,
      display: fmtOffersTotals(offerBreakdown.convertedTotals, t) || `0 ${t.dashCurrency}`,
    },
    {
      key: "pending", label: t.offerStatuses.pending, color: "#C7A24A",
      amount: offerBreakdown.pendingCount,
      display: fmtOffersTotals(offerBreakdown.pendingTotals, t) || `0 ${t.dashCurrency}`,
    },
    {
      key: "rejected", label: t.offerStatuses.rejected, color: "#C4443A",
      amount: offerBreakdown.rejectedCount,
      display: fmtOffersTotals(offerBreakdown.rejectedTotals, t) || `0 ${t.dashCurrency}`,
    },
  ]), [offerBreakdown, t]);

  const customersAddedLabel = useMemo(
    () => t.dashCustomersAddedLabel(resolved.rangeLabel),
    [t, resolved]
  );

  const chartData = useMemo(() => {
    if (resolved.granularity === "month") {
      const spansMultipleYears = resolved.start.getFullYear() !== resolved.end.getFullYear();
      const buckets = [];
      let cursor = new Date(resolved.start.getFullYear(), resolved.start.getMonth(), 1);
      const endCursor = new Date(resolved.end.getFullYear(), resolved.end.getMonth(), 1);
      while (cursor <= endCursor) {
        buckets.push({
          year: cursor.getFullYear(),
          month: cursor.getMonth(),
          label: spansMultipleYears
            ? `${t.months[cursor.getMonth()].slice(0, 3)} ${String(cursor.getFullYear()).slice(2)}`
            : t.months[cursor.getMonth()].slice(0, 3),
          count: 0,
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
      stats.visitEventsInRange.forEach((e) => {
        const d = parseVisitDate(e.date);
        if (!d) return;
        const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
        if (bucket) bucket.count += 1;
      });
      return buckets;
    }
    const daysInMonth = new Date(resolved.start.getFullYear(), resolved.start.getMonth() + 1, 0).getDate();
    const buckets = Array.from({ length: daysInMonth }, (_, i) => ({ label: String(i + 1), count: 0 }));
    stats.visitEventsInRange.forEach((e) => {
      const d = parseVisitDate(e.date);
      if (d) buckets[d.getDate() - 1].count += 1;
    });
    return buckets;
  }, [stats, resolved, t]);

  // Offers value trend, one chart per currency (mixing currencies into one
  // bar height would be misleading). The USD chart only renders below if
  // there's actually USD data in the selected period.
  const offersChartData = useMemo(
    () => buildOffersChartData(stats.offersInRange, "EGP", resolved.granularity, resolved.start, resolved.end, t.months),
    [stats, resolved, t]
  );
  const offersChartDataUSD = useMemo(
    () => buildOffersChartData(stats.offersInRange, "USD", resolved.granularity, resolved.start, resolved.end, t.months),
    [stats, resolved, t]
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
  const maxChartCount = Math.max(1, ...chartData.map((b) => b.count));
  const maxOffersChartValue = Math.max(1, ...offersChartData.map((b) => b.value));
  const maxOffersChartValueUSD = Math.max(1, ...offersChartDataUSD.map((b) => b.value));

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
        customersList: periodCustomersList,
      });
    } catch (e) {
      console.error("PDF export failed:", e);
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
          value={fmtOffersTotals(stats.offersValueTotals, t, { showAllIfEmpty: true })}
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

      {/* Visits performance + offers value trend(s), swiped between in one
          card instead of stacked as separate cards — see
          SwipeableChartCard above. Only pages with actual data are
          included, so this still collapses to a single non-swipeable
          chart when there are no offers in the selected period. */}
      <SwipeableChartCard
        pages={[
          {
            title: t.dashVisitsPerformance,
            node: (
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} interval={resolved.granularity === "month" ? 0 : "preserveStartEnd"} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: MUTED }} domain={[0, maxChartCount]} />
                    <Tooltip
                      formatter={(v) => [v, t.dashCardVisits]}
                      contentStyle={{ direction: t.dir, borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ),
          },
          ...(hasEGPOffers
            ? [{
                title: t.dashOffersValueTrend,
                node: (
                  <div style={{ width: "100%", height: 180 }}>
                    <ResponsiveContainer>
                      <BarChart data={offersChartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} interval={resolved.granularity === "month" ? 0 : "preserveStartEnd"} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: MUTED }} domain={[0, maxOffersChartValue]} />
                        <Tooltip
                          formatter={(v) => [`${fmtMoney(v, t.locale)} ${t.dashCurrency}`, t.dashCardOffersValue]}
                          contentStyle={{ direction: t.dir, borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 12 }}
                        />
                        <Bar dataKey="value" fill={PRIMARY_MID} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ),
              }]
            : []),
          ...(hasUSDOffers
            ? [{
                title: t.dashOffersValueTrendUSD,
                node: (
                  <div style={{ width: "100%", height: 180 }}>
                    <ResponsiveContainer>
                      <BarChart data={offersChartDataUSD} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} interval={resolved.granularity === "month" ? 0 : "preserveStartEnd"} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: MUTED }} domain={[0, maxOffersChartValueUSD]} />
                        <Tooltip
                          formatter={(v) => [`${fmtMoney(v, t.locale)} ${t.currencies.USD}`, t.dashCardOffersValue]}
                          contentStyle={{ direction: t.dir, borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 12 }}
                        />
                        <Bar dataKey="value" fill={GOLD} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ),
              }]
            : []),
        ]}
      />

      {/* Sales pipeline */}
      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
        <p className="font-bold text-sm mb-3" style={{ color: TEXT }}>{t.dashPipeline}</p>
        <div className="flex items-center" style={{ gap: 4, overflowX: "auto" }}>
          {[...STAGE_IDS, "none"].map((id, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const label = id === "none" ? t.stageNone : t.stages[id];
            const color = id === "none" ? MUTED : stageColor(id);
            const count = stats.pipeline[id] || 0;
            const isEmpty = count === 0;
            return (
              <React.Fragment key={id}>
                <div className="flex flex-col items-center" style={{ flexShrink: 0, minWidth: 66, opacity: isEmpty ? 0.45 : 1 }}>
                  <div
                    className="flex items-center justify-center font-extrabold"
                    style={{
                      width: isEmpty ? 36 : 44,
                      height: isEmpty ? 36 : 44,
                      borderRadius: "50%",
                      background: isEmpty ? SURFACE_SUBTLE : color,
                      color: isEmpty ? MUTED : "#fff",
                      border: isEmpty ? `1.4px solid ${LINE}` : "none",
                      fontSize: isEmpty ? 13 : 15,
                      transition: "width .15s, height .15s",
                    }}
                  >
                    {count}
                  </div>
                  <span className="text-xs font-bold mt-1 text-center" style={{ color: MUTED }}>{label}</span>
                </div>
                {!isLast && (
                  <ChevronLeft
                    size={16}
                    color={LINE}
                    style={{ flexShrink: 0, transform: t.dir === "rtl" ? "none" : "rotate(180deg)" }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Sales performance: what got purchased, rejected, or is still pending */}
      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
        <p className="font-bold text-sm mb-3" style={{ color: TEXT }}>{t.dashSalesPerformance}</p>
        <div className="flex flex-wrap" style={{ gap: 10 }}>
          {OFFER_STATUS_IDS.map((id) => {
            const info = stats.offersByStatus[id] || { count: 0, totals: {} };
            const valueText = fmtOffersTotals(info.totals, t);
            const prevCount = prevStats ? (prevStats.offersByStatus[id] || { count: 0 }).count : null;
            const delta = compare ? (prevStats ? pctChange(info.count, prevCount) : null) : undefined;
            return (
              <div
                key={id}
                style={{
                  flex: "1 1 45%",
                  minWidth: 140,
                  background: SURFACE_SUBTLE,
                  borderRadius: 12,
                  padding: 10,
                  borderTop: `3px solid ${offerStatusColor(id)}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: MUTED }}>{t.offerStatuses[id]}</span>
                  <span className="font-extrabold" style={{ fontSize: 20, color: offerStatusColor(id) }}>{info.count}</span>
                </div>
                {valueText && (
                  <p className="text-xs font-bold mt-1" style={{ color: TEXT, margin: "4px 0 0" }}>{valueText}</p>
                )}
                {delta !== undefined && (
                  <div className="flex items-center gap-1 mt-1">
                    {delta === null ? (
                      <span className="text-xs" style={{ color: MUTED }}>{t.dashNoComparisonData}</span>
                    ) : (
                      <span
                        className="flex items-center gap-1 text-xs font-bold"
                        style={{ color: delta >= 0 ? "#2F9E58" : "#C4443A" }}
                      >
                        {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {Math.abs(delta).toFixed(0)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <OffersListSection
        t={t}
        offersList={offersList}
        offerStatusFilter={offerStatusFilter}
        setOfferStatusFilter={setOfferStatusFilter}
        offersListValueTotals={offersListValueTotals}
        visits={visits}
        onOpenCustomer={onOpenCustomer}
      />

      <CustomersAddedSection
        t={t}
        customersAddedLabel={customersAddedLabel}
        periodCustomersList={periodCustomersList}
        onOpenCustomer={onOpenCustomer}
      />
    </div>
  );
}
