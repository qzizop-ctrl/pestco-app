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


// Bottom sheet for choosing the dashboard's period. Edits a local draft
// (mode / custom type / picked months) that's only written back to the
// parent's committed `period` state when "Apply" is tapped — matches the
// existing FilterSheet's overlay look so it feels consistent with the rest
// of the app, but with its own apply step since a half-picked custom range
// shouldn't affect the numbers on screen until it's confirmed.
function PeriodSheet({ t, period, availableYears, onApply, onClose }) {
  const [mode, setMode] = useState(period.mode);
  const [customType, setCustomType] = useState(period.customType);
  const [year, setYear] = useState(period.year);
  const [single, setSingle] = useState(period.single);
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);

  const options = [
    { id: "month", label: t.dashPeriodCurrentMonth },
    { id: "q3", label: t.dashPeriodLast3 },
    { id: "q6", label: t.dashPeriodLast6 },
    { id: "year", label: t.dashPeriodWholeYear },
    { id: "custom", label: t.dashPeriodCustom },
  ];

  function apply() {
    onApply({ mode, customType, year, single, from, to });
    onClose();
  }

  return (
    <div
      className="flex items-end justify-center"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 90 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: SURFACE,
          borderRadius: "18px 18px 0 0",
          padding: "16px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
          width: "100%",
          maxWidth: 480,
          maxHeight: "78vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-base" style={{ color: TEXT }}>{t.dashPeriodChoose}</span>
          <button onClick={onClose} className="btn-press flex items-center justify-center" style={{ color: MUTED }} aria-label={t.back}>
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col">
          {options.map((opt) => {
            const isActive = opt.id === mode;
            return (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className="btn-press flex items-center justify-between"
                style={{
                  padding: "12px 4px",
                  borderBottom: `1px solid ${LINE}`,
                  background: "transparent",
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? TEXT : MUTED,
                }}
              >
                <span>{opt.label}</span>
                {isActive && <span style={{ color: PRIMARY, fontWeight: 900 }}>✓</span>}
              </button>
            );
          })}
        </div>

        {mode === "year" && (
          <div style={{ marginTop: 12 }}>
            <label>{t.dashYear}</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {mode === "custom" && (
          <div style={{ marginTop: 12 }}>
            <div className="flex" style={{ gap: 6, marginBottom: 10 }}>
              {[{ id: "single", label: t.dashPeriodCustomSingle }, { id: "range", label: t.dashPeriodCustomRange }].map((m) => {
                const isActive = m.id === customType;
                return (
                  <button
                    key={m.id}
                    onClick={() => setCustomType(m.id)}
                    className="btn-press font-bold"
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 999,
                      fontSize: 12,
                      border: `1.4px solid ${isActive ? PRIMARY : LINE}`,
                      background: isActive ? PRIMARY : SURFACE,
                      color: isActive ? "#fff" : MUTED,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {customType === "single" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <select
                  value={single.month}
                  onChange={(e) => setSingle((s) => ({ ...s, month: Number(e.target.value) }))}
                >
                  {t.months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select
                  value={single.year}
                  onChange={(e) => setSingle((s) => ({ ...s, year: Number(e.target.value) }))}
                >
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex items-center" style={{ gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
                  <select
                    value={from.month}
                    onChange={(e) => setFrom((f) => ({ ...f, month: Number(e.target.value) }))}
                  >
                    {t.months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select
                    value={from.year}
                    onChange={(e) => setFrom((f) => ({ ...f, year: Number(e.target.value) }))}
                  >
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <span style={{ color: MUTED, fontSize: 13, fontWeight: 700 }}>{t.dashPeriodTo}</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
                  <select
                    value={to.month}
                    onChange={(e) => setTo((tt) => ({ ...tt, month: Number(e.target.value) }))}
                  >
                    {t.months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select
                    value={to.year}
                    onChange={(e) => setTo((tt) => ({ ...tt, year: Number(e.target.value) }))}
                  >
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={apply}
          className="btn-press w-full font-bold"
          style={{ marginTop: 16, background: PRIMARY, color: "#fff", borderRadius: 12, padding: "11px 0" }}
        >
          {t.dashPeriodApply}
        </button>
      </div>
    </div>
  );
}

// A thin horizontal bar split into colored segments by proportion, plus a
// small legend row underneath. Used on the Offers cards to show converted
// vs. still-pending vs. rejected at a glance, without adding more cards.
function SplitBar({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.amount, 0);
  return (
    <div style={{ marginTop: 10 }}>
      <div
        className="flex"
        style={{ height: 6, borderRadius: 999, overflow: "hidden", background: SURFACE_SUBTLE }}
      >
        {total > 0 &&
          segments
            .filter((s) => s.amount > 0)
            .map((s) => (
              <div key={s.key} style={{ width: `${(s.amount / total) * 100}%`, background: s.color }} />
            ))}
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 10, marginTop: 6 }}>
        {segments.map((s) => (
          <div key={s.key} className="flex items-center" style={{ gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: s.color, flexShrink: 0 }} />
            <span className="text-xs font-bold" style={{ color: MUTED }}>{s.label}: {s.display}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, delta, subValue, extra, t }) {
  // Longer combined values (e.g. two currencies: "12,000 EG + 500 $")
  // don't fit this card's fixed width at the normal 22px size — whether
  // they end up wrapping onto a second line or just barely fitting on one,
  // scaling the font down by length keeps the card from overflowing or
  // looking cramped either way.
  const valueText = typeof value === "string" ? value : String(value);
  const valueFontSize = valueText.length > 18 ? 15 : valueText.length > 12 ? 18 : 22;

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
      <p className="font-extrabold" style={{ margin: 0, fontSize: valueFontSize, lineHeight: 1.25, color: TEXT }}>{value}</p>
      {subValue && (
        <p className="text-xs font-bold" style={{ margin: "2px 0 0", color: MUTED }}>{subValue}</p>
      )}
      {extra}
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

// Wraps a set of charts (visits performance, offers value trend in EGP,
// offers value trend in USD — whichever apply) in a single card the person
// swipes between horizontally, instead of stacking every chart vertically.
// Only the active chart's title shows up top; dots below mark which page
// you're on. `pages` is an array of { title, node }, already filtered down
// to the charts that actually have data (see hasEGPOffers/hasUSDOffers
// below) so a 1-page case just renders without any swipe chrome.
function SwipeableChartCard({ pages }) {
  const [active, setActive] = useState(0);
  const trackRef = React.useRef(null);

  if (pages.length === 0) return null;

  // scrollLeft's sign flips between browsers under `direction: rtl`
  // (0 → -max in spec-compliant browsers, 0 → +max in older ones), so we
  // only ever look at its magnitude relative to the track's own width —
  // that ratio is direction-agnostic and lands on the right page either way.
  const handleScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    setActive(Math.max(0, Math.min(pages.length - 1, i)));
  };

  return (
    <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
      <p className="font-bold text-sm mb-2" style={{ color: TEXT }}>{pages[active].title}</p>
      <div
        ref={trackRef}
        onScroll={pages.length > 1 ? handleScroll : undefined}
        style={{
          display: "flex",
          overflowX: pages.length > 1 ? "auto" : "hidden",
          scrollSnapType: pages.length > 1 ? "x mandatory" : "none",
          scrollbarWidth: "none",
        }}
      >
        {pages.map((page, i) => (
          <div key={i} style={{ flex: "0 0 100%", scrollSnapAlign: "start", minWidth: 0 }}>
            {page.node}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-1" style={{ marginTop: 6 }}>
          {pages.map((_, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: i === active ? PRIMARY : LINE,
              }}
            />
          ))}
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
                {t.dashOffersTotalValueLabel}: {fmtOffersTotals(offersListValueTotals, t, { showAllIfEmpty: true })}
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
