import SectorBreakdownCard from "./SectorBreakdownCard";
import SalesAnalysisCard from "./SalesAnalysisCard";

// ---------------------------------------------------------------------------
// Extracted from Dashboard.jsx as part of splitting it into smaller files.
// The "sales" tab's content: the sector breakdown (all sectors side by
// side, only shown when "all sectors" is selected) plus the combined
// Pipeline/Performance/Rejection-reasons card. Pure presentational piece —
// everything comes from useDashboardStats' output via Dashboard.jsx.
// ---------------------------------------------------------------------------
export default function DashboardSalesTab({
  t, sectorBreakdown, stats, prevStats, compare,
  rejectionReport, prevRejectionReport, topClients, prevTopClients,
  visits, onOpenCustomer, exchangeRate, unifyCurrency,
}) {
  return (
    <>
      {sectorBreakdown && (
        <SectorBreakdownCard t={t} breakdown={sectorBreakdown} exchangeRate={exchangeRate} unifyCurrency={unifyCurrency} />
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
        exchangeRate={exchangeRate}
        unifyCurrency={unifyCurrency}
      />
    </>
  );
}
