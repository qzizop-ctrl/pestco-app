import { useState } from "react";
import { STRINGS } from "./i18n";
import { useDashboardContext } from "./hooks/useDashboardContext";
import { useDashboardStats } from "./hooks/useDashboardStats";
import { useDashboardPdfExport } from "./hooks/useDashboardPdfExport";
// This file used to hold ~990 lines, then ~440 after a first round of
// extracting pure presentational pieces into src/components/ (PeriodSheet,
// SplitBar, SummaryCard, etc — see each file). It's now split one level
// further: the filter bar, the tab switcher, and each of the three tabs'
// content are their own components, and the PDF-export logic is its own
// hook. Dashboard.jsx itself is left as just the wiring between
// useDashboardStats/useDashboardPdfExport and whichever tab is active — see
// each extracted file for the reasoning behind that specific piece.
import DashboardFilterBar from "./components/DashboardFilterBar";
import DashboardTabs from "./components/DashboardTabs";
import DashboardOverviewTab from "./components/DashboardOverviewTab";
import DashboardSalesTab from "./components/DashboardSalesTab";
import DashboardCustomersTab from "./components/DashboardCustomersTab";

export default function Dashboard({
  visits, lang, onOpenCustomer, showAlert, staleOffers = [],
  exchangeRate = null, setExchangeRate = () => {}, unifyCurrency = false, setUnifyCurrency = () => {},
}) {
  const t = STRINGS[lang];
  const now = new Date();

  // Which of the three Dashboard tabs (overview / sales / customers) is
  // currently shown below the filter bar, the "customers" tab's own
  // offers/customers sub-toggle, and whether "sales" has ever been opened
  // (gates the pricier sectorBreakdown computation below) — all three live
  // in DashboardContext (see contexts/DashboardContext.jsx) rather than as
  // local useState here, because Dashboard only renders while
  // screen === "dashboard" (see AppScreens.jsx) and fully unmounts the
  // moment a customer's detail screen is opened. Local state here would
  // reset to its default every time a manager opened a customer from the
  // Dashboard and came back.
  const {
    activeTab, setActiveTab, customersSubTab, setCustomersSubTab,
    salesTabVisited, setSalesTabVisited,
  } = useDashboardContext();

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

  // Every derived/computed number the Dashboard shows (period resolution,
  // current vs. previous period stats, breakdowns, top clients, the two
  // customers/offers lists...) lives in useDashboardStats — see that hook
  // for the reasoning behind each individual value.
  const {
    availableYears, resolved, stats, prevStats,
    avgDealSize, prevAvgDealSize, avgDealSizeUSD, winRate, winRateDecidedCount, prevWinRate,
    rejectionReport, prevRejectionReport, topClients, prevTopClients,
    sectorBreakdown, staleOffersFiltered, offersCountSegments, offersValueSegments,
    customersAddedLabel, periodCustomersList, offersList, offersListValueTotals,
  } = useDashboardStats({
    visits, t, now, period, sector, compare,
    exchangeRate, unifyCurrency, salesTabVisited, staleOffers, offerStatusFilter,
  });

  const { pdfBusy, handleExportPdf } = useDashboardPdfExport({
    t, stats, resolved, sector,
    avgDealSize, avgDealSizeUSD, winRate, winRateDecidedCount,
    rejectionReport, exchangeRate, unifyCurrency, showAlert,
  });

  return (
    <div className="px-4 pt-4 pb-24" style={{ direction: t.dir }}>
      <DashboardFilterBar
        t={t}
        resolved={resolved}
        periodSheetOpen={periodSheetOpen}
        setPeriodSheetOpen={setPeriodSheetOpen}
        period={period}
        availableYears={availableYears}
        setPeriod={setPeriod}
        sector={sector}
        setSector={setSector}
        exchangeRate={exchangeRate}
        setExchangeRate={setExchangeRate}
        unifyCurrency={unifyCurrency}
        setUnifyCurrency={setUnifyCurrency}
        compare={compare}
        setCompare={setCompare}
        pdfBusy={pdfBusy}
        handleExportPdf={handleExportPdf}
      />

      <DashboardTabs
        t={t}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setSalesTabVisited={setSalesTabVisited}
      />

      {activeTab === "overview" && (
        <DashboardOverviewTab
          t={t}
          staleOffersFiltered={staleOffersFiltered}
          onOpenCustomer={onOpenCustomer}
          stats={stats}
          prevStats={prevStats}
          compare={compare}
          customersAddedLabel={customersAddedLabel}
          offersCountSegments={offersCountSegments}
          offersValueSegments={offersValueSegments}
          exchangeRate={exchangeRate}
          unifyCurrency={unifyCurrency}
          avgDealSize={avgDealSize}
          avgDealSizeUSD={avgDealSizeUSD}
          prevAvgDealSize={prevAvgDealSize}
          winRate={winRate}
          winRateDecidedCount={winRateDecidedCount}
          prevWinRate={prevWinRate}
        />
      )}

      {activeTab === "sales" && (
        <DashboardSalesTab
          t={t}
          sectorBreakdown={sectorBreakdown}
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
      )}

      {activeTab === "customers" && (
        <DashboardCustomersTab
          t={t}
          customersSubTab={customersSubTab}
          setCustomersSubTab={setCustomersSubTab}
          offersList={offersList}
          offerStatusFilter={offerStatusFilter}
          setOfferStatusFilter={setOfferStatusFilter}
          offersListValueTotals={offersListValueTotals}
          visits={visits}
          onOpenCustomer={onOpenCustomer}
          exchangeRate={exchangeRate}
          unifyCurrency={unifyCurrency}
          customersAddedLabel={customersAddedLabel}
          periodCustomersList={periodCustomersList}
        />
      )}
    </div>
  );
}
