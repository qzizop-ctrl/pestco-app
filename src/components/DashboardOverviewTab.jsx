import { Calendar, Users, FileText, Wallet, Percent, DollarSign } from "lucide-react";
import { MUTED, LINE, SURFACE } from "../theme";
import { fmtMoney } from "../formatMoney";
import { fmtUnifiedOrSplit } from "../offerHelpers";
import { pctChange } from "../dashboardCalculations";
import StaleOffersCard from "./StaleOffersCard";
import SummaryCard from "./SummaryCard";
import SplitBar from "./SplitBar";

// ---------------------------------------------------------------------------
// Extracted from Dashboard.jsx as part of splitting it into smaller files.
// The "overview" tab's content: the stale-offers banner, the empty-period
// notice, and the summary-card grid. Pure presentational piece fed entirely
// from useDashboardStats' output (via Dashboard.jsx) — no state of its own.
// ---------------------------------------------------------------------------
export default function DashboardOverviewTab({
  t, staleOffersFiltered, onOpenCustomer,
  stats, prevStats, compare,
  customersAddedLabel, offersCountSegments, offersValueSegments,
  exchangeRate, unifyCurrency,
  avgDealSize, avgDealSizeUSD, prevAvgDealSize,
  winRate, winRateDecidedCount, prevWinRate,
}) {
  return (
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
          value={fmtUnifiedOrSplit(stats.offersValueTotals, t, exchangeRate, unifyCurrency, { showAllIfEmpty: true })}
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
  );
}
