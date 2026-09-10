import React, { useMemo, useState } from "react";
import { Calendar, Users, FileText, Wallet, TrendingUp, TrendingDown, ChevronLeft, Percent, DollarSign, FileDown, CheckCircle2, BadgeDollarSign } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  STRINGS, SECTOR_IDS, STAGE_IDS, OFFER_STATUS_IDS,
  stageColor, offerStatusColor,
  parseVisitDate, fmtMoney, fmtOffersTotals, sumOffersByCurrency, getVisitEvents, toJsDate,
  PRIMARY, PRIMARY_MID, TEXT, MUTED, LINE, GOLD, GOLD_SOFT, SURFACE, SURFACE_SUBTLE,
} from "./constants";
import { generateDashboardPdf } from "./pdfReport";

// Builds the [start, end] Date range for a given year + month filter.
// month === "all" covers the whole year.
function getRange(year, month) {
  if (month === "all") {
    return [new Date(year, 0, 1, 0, 0, 0), new Date(year, 11, 31, 23, 59, 59)];
  }
  const start = new Date(year, month, 1, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  return [start, end];
}

// Returns the [year, month] pair for "the period right before this one",
// used for the previous-month/previous-year comparison toggle.
function getPreviousPeriod(year, month) {
  if (month === "all") return [year - 1, "all"];
  if (month === 0) return [year - 1, 11];
  return [year, month - 1];
}

function pctChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

// Average deal size, computed from EGP-denominated offers only — mixing
// currencies into one "average" number would be misleading, so this is
// intentionally scoped to the dominant currency.
// Average deal size for a specific currency. Kept per-currency rather than
// blended across currencies — averaging EGP and USD amounts together would
// be meaningless (they're different units, not just different numbers).
function computeAvgDealSizeForCurrency(offersInRange, currency) {
  const offers = (offersInRange || []).filter((o) => (o.currency || "EGP") === currency);
  if (offers.length === 0) return null;
  const total = offers.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  return total / offers.length;
}

// Win rate: purchased / (purchased + rejected). Offers still pending or
// installed aren't "decided" yet, so they're excluded from the denominator.
function computeWinRate(offersByStatus) {
  const purchased = (offersByStatus.purchased || {}).count || 0;
  const rejected = (offersByStatus.rejected || {}).count || 0;
  const decided = purchased + rejected;
  return decided > 0 ? (purchased / decided) * 100 : null;
}

// Sample size behind the win rate — shown alongside the percentage so a
// rate computed from very few deals (e.g. 100% from 2 deals) isn't read
// with the same confidence as one computed from a large sample.
function computeDecidedCount(offersByStatus) {
  const purchased = (offersByStatus.purchased || {}).count || 0;
  const rejected = (offersByStatus.rejected || {}).count || 0;
  return purchased + rejected;
}

// Builds a per-day (specific month) or per-month ("all") bucket array of
// offer values for one currency, used to feed a value-trend BarChart.
function buildOffersChartData(offersInRange, currency, month, year, months) {
  const inCurrency = (o) => (o.currency || "EGP") === currency;
  if (month === "all") {
    const buckets = Array.from({ length: 12 }, (_, i) => ({ label: months[i].slice(0, 3), value: 0 }));
    offersInRange.filter(inCurrency).forEach((o) => {
      const d = parseVisitDate(o.offerDate);
      if (d) buckets[d.getMonth()].value += Number(o.amount) || 0;
    });
    return buckets;
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const buckets = Array.from({ length: daysInMonth }, (_, i) => ({ label: String(i + 1), value: 0 }));
  offersInRange.filter(inCurrency).forEach((o) => {
    const d = parseVisitDate(o.offerDate);
    if (d) buckets[d.getDate() - 1].value += Number(o.amount) || 0;
  });
  return buckets;
}

function computePeriodStats(visits, year, month, sector) {
  const [start, end] = getRange(year, month);
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
  // counted rather than disappearing whenever a specific month is
  // selected. A dateless record that HAS been visited is still only
  // counted in the "all months" view, since we can't confirm which month
  // it belongs to.
  const customersAddedInRange = visits.filter((v) => {
    if (!inSector(v)) return false;
    const d = toJsDate(v.createdAt);
    if (!d) return month === "all" || getVisitEvents(v).length === 0;
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

function SummaryCard({ icon: Icon, label, value, delta, subValue, t }) {
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${LINE}`,
        borderRadius: 16,
        padding: 14,
        flex: "1 1 45%",
        minWidth: 140,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: 9, background: GOLD_SOFT, color: "#7A5420" }}
        >
          <Icon size={15} />
        </div>
        <span className="text-xs font-bold" style={{ color: MUTED }}>{label}</span>
      </div>
      <p className="font-extrabold" style={{ margin: 0, fontSize: 22, color: TEXT }}>{value}</p>
      {subValue && (
        <p className="text-xs font-bold" style={{ margin: "2px 0 0", color: MUTED }}>{subValue}</p>
      )}
      {delta !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          {delta === null ? (
            <span className="text-xs" style={{ color: MUTED }}>{t.dashNoComparisonData}</span>
          ) : typeof delta === "object" ? (
            <span
              className="flex items-center gap-1 text-xs font-bold"
              style={{ color: delta.points >= 0 ? "#2F9E58" : "#C4443A" }}
            >
              {delta.points >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {delta.points >= 0 ? "+" : ""}{delta.points.toFixed(0)} {t.dashPointsSuffix}
            </span>
          ) : (
            <span
              className="flex items-center gap-1 text-xs font-bold"
              style={{ color: delta >= 0 ? "#2F9E58" : "#C4443A" }}
            >
              {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

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

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState("all"); // number 0-11, or "all"
  const [sector, setSector] = useState("all");
  const [compare, setCompare] = useState(false);
  const [offerStatusFilter, setOfferStatusFilter] = useState("all");

  const stats = useMemo(() => computePeriodStats(visits, year, month, sector), [visits, year, month, sector]);

  const prevStats = useMemo(() => {
    if (!compare) return null;
    const [py, pm] = getPreviousPeriod(year, month);
    return computePeriodStats(visits, py, pm, sector);
  }, [visits, year, month, sector, compare]);

  const avgDealSize = useMemo(() => computeAvgDealSizeForCurrency(stats.offersInRange, "EGP"), [stats]);
  const prevAvgDealSize = useMemo(() => (prevStats ? computeAvgDealSizeForCurrency(prevStats.offersInRange, "EGP") : null), [prevStats]);
  const avgDealSizeUSD = useMemo(() => computeAvgDealSizeForCurrency(stats.offersInRange, "USD"), [stats]);
  const hasEGPOffers = useMemo(() => stats.offersInRange.some((o) => (o.currency || "EGP") === "EGP"), [stats]);
  const hasUSDOffers = useMemo(() => stats.offersInRange.some((o) => o.currency === "USD"), [stats]);
  const winRate = useMemo(() => computeWinRate(stats.offersByStatus), [stats]);
  const winRateDecidedCount = useMemo(() => computeDecidedCount(stats.offersByStatus), [stats]);
  const prevWinRate = useMemo(() => (prevStats ? computeWinRate(prevStats.offersByStatus) : null), [prevStats]);

  // Offers that actually converted into a sale ("purchased"), kept separate
  // from the total offers count/value above — those totals blend pending,
  // rejected, and installed offers together, which overstates how much was
  // actually sold. These two feed a dedicated "converted to sale" card.
  const salesInfo = stats.offersByStatus.purchased || { count: 0, totals: {} };
  const prevSalesInfo = prevStats ? (prevStats.offersByStatus.purchased || { count: 0, totals: {} }) : null;

  const customersAddedLabel = useMemo(() => {
    return month === "all"
      ? t.dashCustomersAddedAllLabel(year)
      : t.dashCustomersAddedMonthLabel(t.months[month]);
  }, [t, year, month]);

  const chartData = useMemo(() => {
    if (month === "all") {
      const buckets = Array.from({ length: 12 }, (_, i) => ({ label: t.months[i].slice(0, 3), count: 0 }));
      stats.visitEventsInRange.forEach((e) => {
        const d = parseVisitDate(e.date);
        if (d) buckets[d.getMonth()].count += 1;
      });
      return buckets;
    }
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const buckets = Array.from({ length: daysInMonth }, (_, i) => ({ label: String(i + 1), count: 0 }));
    stats.visitEventsInRange.forEach((e) => {
      const d = parseVisitDate(e.date);
      if (d) buckets[d.getDate() - 1].count += 1;
    });
    return buckets;
  }, [stats, month, year, t]);

  // Offers value trend, one chart per currency (mixing currencies into one
  // bar height would be misleading). The USD chart only renders below if
  // there's actually USD data in the selected period.
  const offersChartData = useMemo(
    () => buildOffersChartData(stats.offersInRange, "EGP", month, year, t.months),
    [stats, month, year, t]
  );
  const offersChartDataUSD = useMemo(
    () => buildOffersChartData(stats.offersInRange, "USD", month, year, t.months),
    [stats, month, year, t]
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
        t, stats, year, month,
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label>{t.dashYear}</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label>{t.dashMonth}</label>
            <select value={month} onChange={(e) => setMonth(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">{t.dashAllMonths}</option>
              {t.months.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>
        </div>
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
          t={t}
        />
        <SummaryCard
          icon={Wallet}
          label={t.dashCardOffersValue}
          value={fmtOffersTotals(stats.offersValueTotals, t) || `0 ${t.dashCurrency}`}
          delta={compare ? (prevStats ? pctChange(stats.offersValueTotals.EGP, prevStats.offersValueTotals.EGP) : null) : undefined}
          t={t}
        />
        <SummaryCard
          icon={CheckCircle2}
          label={t.dashCardSalesCount}
          value={salesInfo.count}
          delta={compare ? (prevSalesInfo ? pctChange(salesInfo.count, prevSalesInfo.count) : null) : undefined}
          t={t}
        />
        <SummaryCard
          icon={BadgeDollarSign}
          label={t.dashCardSalesValue}
          value={fmtOffersTotals(salesInfo.totals, t) || `0 ${t.dashCurrency}`}
          delta={compare ? (prevSalesInfo ? pctChange(salesInfo.totals.EGP || 0, prevSalesInfo.totals.EGP || 0) : null) : undefined}
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

      {/* Visits performance chart */}
      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
        <p className="font-bold text-sm mb-2" style={{ color: TEXT }}>{t.dashVisitsPerformance}</p>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} interval={month === "all" ? 0 : "preserveStartEnd"} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: MUTED }} domain={[0, maxChartCount]} />
              <Tooltip
                formatter={(v) => [v, t.dashCardVisits]}
                contentStyle={{ direction: t.dir, borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 12 }}
              />
              <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Offers value trend (EGP) — hidden entirely when there are no EGP
          offers in the selected period, same as the USD chart below,
          instead of rendering an empty/flat chart with nothing to show. */}
      {hasEGPOffers && (
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
          <p className="font-bold text-sm mb-2" style={{ color: TEXT }}>{t.dashOffersValueTrend}</p>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={offersChartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} interval={month === "all" ? 0 : "preserveStartEnd"} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: MUTED }} domain={[0, maxOffersChartValue]} />
                <Tooltip
                  formatter={(v) => [`${fmtMoney(v, t.locale)} ${t.dashCurrency}`, t.dashCardOffersValue]}
                  contentStyle={{ direction: t.dir, borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 12 }}
                />
                <Bar dataKey="value" fill={PRIMARY_MID} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {hasUSDOffers && (
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
          <p className="font-bold text-sm mb-2" style={{ color: TEXT }}>{t.dashOffersValueTrendUSD}</p>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={offersChartDataUSD} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} interval={month === "all" ? 0 : "preserveStartEnd"} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: MUTED }} domain={[0, maxOffersChartValueUSD]} />
                <Tooltip
                  formatter={(v) => [`${fmtMoney(v, t.locale)} ${t.currencies.USD}`, t.dashCardOffersValue]}
                  contentStyle={{ direction: t.dir, borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 12 }}
                />
                <Bar dataKey="value" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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

      {/* Offers */}
      <div style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-sm" style={{ color: TEXT }}>{t.dashOffersSection}</p>
        </div>
        <div
          className="flex items-center gap-2 mb-3"
          style={{
            overflowX: "auto",
            // Fades the two edges so a partially-visible tab reads as
            // "more to scroll" instead of looking like a cut-off layout bug.
            WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)",
            maskImage: "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)",
          }}
        >
          {["all", ...OFFER_STATUS_IDS].map((id) => {
            const isActive = offerStatusFilter === id;
            const label = id === "all" ? t.dashOfferFilterAll : t.offerStatuses[id];
            const bg = id === "all" ? PRIMARY : offerStatusColor(id);
            return (
              <button
                key={id}
                onClick={() => setOfferStatusFilter(id)}
                className="btn-press font-bold text-xs"
                style={{
                  flexShrink: 0,
                  padding: "7px 14px",
                  borderRadius: 999,
                  border: `1.4px solid ${isActive ? bg : LINE}`,
                  background: isActive ? bg : SURFACE,
                  color: isActive ? "#fff" : MUTED,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {offersList.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noOffers}</p>
        ) : (
          <>
            {offersList.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  const parent = visits.find((v) => v.id === o.customerId);
                  if (parent) onOpenCustomer(parent);
                }}
                className={`btn-press w-full ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                style={{
                  display: "block",
                  background: SURFACE,
                  border: `1px solid ${LINE}`,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm" style={{ color: TEXT }}>{o.customerName}</span>
                  <span
                    className="text-xs font-bold"
                    style={{ background: offerStatusColor(o.status), color: "#fff", borderRadius: 999, padding: "3px 9px" }}
                  >
                    {t.offerStatuses[o.status] || o.status}
                  </span>
                </div>
                <p className="text-sm mt-1" style={{ color: MUTED, margin: "4px 0 0" }}>
                  {o.name}{o.offerNumber ? ` — ${o.offerNumber}` : ""}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs" style={{ color: MUTED }}>{o.offerDate}</span>
                  <span className="text-sm font-extrabold" style={{ color: PRIMARY_MID }}>
                    {fmtMoney(o.amount, t.locale)} {t.currencies[o.currency] || t.currencies.EGP}
                  </span>
                </div>
              </button>
            ))}
            <div
              className="flex items-center justify-between"
              style={{ padding: "10px 4px", borderTop: `1px dashed ${LINE}`, marginTop: 4 }}
            >
              <span className="text-xs font-bold" style={{ color: MUTED }}>
                {t.dashOffersTotalLabel}: {offersList.length}
              </span>
              <span className="text-sm font-extrabold" style={{ color: TEXT }}>
                {t.dashOffersTotalValueLabel}: {fmtOffersTotals(offersListValueTotals, t) || `0 ${t.dashCurrency}`}
              </span>
            </div>
          </>
        )}
      </div>

      {/* The individual customers behind the "Customers added" count above */}
      <div>
        <p className="font-bold text-sm mb-2" style={{ color: TEXT }}>{customersAddedLabel}</p>
        {periodCustomersList.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noVisits}</p>
        ) : (
          periodCustomersList.map((v) => {
            const stageId = v.stage || "";
            return (
              <button
                key={v.id}
                onClick={() => onOpenCustomer(v)}
                className={`btn-press w-full ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                style={{
                  display: "block",
                  background: SURFACE,
                  border: `1px solid ${LINE}`,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm" style={{ color: TEXT }}>{v.companyName || t.noCompanyName}</span>
                  {stageId && (
                    <span
                      className="text-xs font-bold"
                      style={{ background: stageColor(stageId), color: "#fff", borderRadius: 999, padding: "3px 9px" }}
                    >
                      {t.stages[stageId]}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-bold" style={{ color: GOLD }}>
                    {t.sectors[v.sector] || t.sectors.private}
                  </span>
                  <span className="text-xs" style={{ color: MUTED }}>
                    {v.visitDate ? `${t.dashLastVisit} ${v.visitDate}` : t.noVisitYet}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
