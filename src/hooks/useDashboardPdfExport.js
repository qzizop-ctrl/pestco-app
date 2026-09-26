import { useState } from "react";
import { parseVisitDate } from "../helpers";
import { generateDashboardPdf } from "../pdfReport";
import { reportException } from "../sentry";

// ---------------------------------------------------------------------------
// Extracted from Dashboard.jsx as part of splitting it into smaller files.
// This is business logic (build the offers list, call the PDF generator,
// report failures), not presentation, so — unlike the components/ pieces
// pulled out alongside it — it belongs in hooks/ rather than components/.
// ---------------------------------------------------------------------------
export function useDashboardPdfExport({
  t, stats, resolved, sector,
  avgDealSize, avgDealSizeUSD, winRate, winRateDecidedCount,
  rejectionReport, exchangeRate, unifyCurrency, showAlert,
}) {
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
        exchangeRate, unifyCurrency,
      });
    } catch (e) {
      console.error("PDF export failed:", e);
      reportException(e, { context: "PDF export failed" });
      if (showAlert) showAlert(t.dashPdfError);
    } finally {
      setPdfBusy(false);
    }
  };

  return { pdfBusy, handleExportPdf };
}
