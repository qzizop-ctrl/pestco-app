import React, { useMemo, useState } from "react";
import { Calendar, Users, FileText, Wallet, TrendingUp, TrendingDown, ChevronLeft } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  STRINGS, SECTOR_IDS, STAGE_IDS, OFFER_STATUS_IDS,
  stageColor, offerStatusColor,
  parseVisitDate, fmtMoney, getVisitEvents, toJsDate,
  PRIMARY, PRIMARY_MID, TEXT, MUTED, LINE, GOLD, GOLD_SOFT, SURFACE,
} from "./constants";

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
  // Records with no createdAt (legacy/imported data missing the field) are
  // always counted rather than silently dropped from every period.
  const customersAddedInRange = visits.filter((v) => {
    if (!inSector(v)) return false;
    const d = toJsDate(v.createdAt);
    if (!d) return true;
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

  const offersValue = offersInRange.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

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
    offersCount: offersInRange.length,
    offersValue,
    pipeline,
  };
}

function SummaryCard({ icon: Icon, label, value, delta, t }) {
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
      {delta !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          {delta === null ? (
            <span className="text-xs" style={{ color: MUTED }}>{t.dashNoComparisonData}</span>
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

export default function Dashboard({ visits, lang, onOpenCustomer }) {
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

  // Customers filtered by the selected period (their visitDate must fall in
  // range) and sector. Customers with no visitDate yet are always kept —
  // there's no date to match against, and dropping them would hide "still
  // needs a first visit" customers from every period.
  const periodCustomersList = useMemo(() => {
    return visits
      .filter((v) => sector === "all" || v.sector === sector)
      .filter((v) => {
        const d = parseVisitDate(v.visitDate);
        if (!d) return true;
        return d >= stats.start && d <= stats.end;
      })
      .sort((a, b) => {
        const da = parseVisitDate(a.visitDate);
        const db = parseVisitDate(b.visitDate);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      });
  }, [visits, sector, stats]);

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

  const offersListValue = offersList.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const maxChartCount = Math.max(1, ...chartData.map((b) => b.count));

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

        <button
          onClick={() => setCompare((c) => !c)}
          className="btn-press flex items-center justify-center gap-2 font-bold text-xs"
          style={{
            border: `1.4px solid ${compare ? PRIMARY : LINE}`,
            background: compare ? PRIMARY : SURFACE,
            color: compare ? "#fff" : MUTED,
            borderRadius: 12,
            padding: "9px 0",
          }}
        >
          <TrendingUp size={14} /> {t.dashCompareToggle}
        </button>
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
          label={t.totalCustomersLabel}
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
          value={`${fmtMoney(stats.offersValue, t.locale)} ${t.dashCurrency}`}
          delta={compare ? (prevStats ? pctChange(stats.offersValue, prevStats.offersValue) : null) : undefined}
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

      {/* Sales pipeline */}
      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
        <p className="font-bold text-sm mb-3" style={{ color: TEXT }}>{t.dashPipeline}</p>
        <div className="flex items-center" style={{ gap: 4, overflowX: "auto" }}>
          {[...STAGE_IDS, "none"].map((id, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const label = id === "none" ? t.stageNone : t.stages[id];
            const color = id === "none" ? MUTED : stageColor(id);
            return (
              <React.Fragment key={id}>
                <div className="flex flex-col items-center" style={{ flexShrink: 0, minWidth: 66 }}>
                  <div
                    className="flex items-center justify-center font-extrabold"
                    style={{ width: 44, height: 44, borderRadius: "50%", background: color, color: "#fff", fontSize: 15 }}
                  >
                    {stats.pipeline[id] || 0}
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

      {/* Offers */}
      <div style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-sm" style={{ color: TEXT }}>{t.dashOffersSection}</p>
        </div>
        <div className="flex items-center gap-2 mb-3" style={{ overflowX: "auto" }}>
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
                    {fmtMoney(o.amount, t.locale)} {t.dashCurrency}
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
                {t.dashOffersTotalValueLabel}: {fmtMoney(offersListValue, t.locale)} {t.dashCurrency}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Total customers (independent of the selected period) */}
      <div>
        <p className="font-bold text-sm mb-2" style={{ color: TEXT }}>{t.totalCustomersLabel}</p>
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
