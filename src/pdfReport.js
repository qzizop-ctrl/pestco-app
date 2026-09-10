// ============================================================================
// Client-side PDF report export for the Dashboard ("تصدير تقرير PDF").
//
// Implementation note on Arabic text: jsPDF's built-in fonts have no Arabic
// glyphs and no RTL shaping, so drawing the report with jsPDF's native
// text() calls would come out as boxes/garbled text in Arabic. Instead this
// renders the report as an ordinary (invisible, off-screen) HTML block using
// the browser's own text engine — which handles Arabic shaping and RTL
// correctly for free — then rasterizes that block with html2canvas and
// slices the resulting image across A4 pages with jsPDF. This is the same
// approach most web apps use to export right-to-left PDFs without shipping
// a custom embedded font.
//
// Both libraries are dynamically imported (see generateDashboardPdf) so
// their weight — html2canvas especially — never lands in the app's initial
// bundle, matching the lazy-loading already used for xlsx and the Dashboard
// screen itself.
// ============================================================================

import {
  fmtMoney, fmtOffersTotals,
  STAGE_IDS, OFFER_STATUS_IDS, stageColor,
  PRIMARY,
} from "./constants";

// The report always renders on a plain white/light background regardless of
// the app's current theme (dark mode) — a report meant for printing/sharing
// with a manager shouldn't come out dark. These mirror THEME_VARS.light in
// constants.js rather than reusing the CSS-variable exports (TEXT/MUTED/
// LINE/SURFACE), which follow whatever theme is active on screen.
const TEXT_HEX = "#1B241F";
const MUTED_HEX = "#6B7168";
const LINE_HEX = "#E7E2D6";
const SUBTLE_HEX = "#F8F6F0";

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function sectionTitle(text) {
  return `<div style="font-size:14px;font-weight:800;color:${TEXT_HEX};border-bottom:2px solid ${PRIMARY};padding-bottom:6px;margin:22px 0 12px;">${esc(text)}</div>`;
}

function simpleTable({ headers, rows, align }) {
  if (rows.length === 0) return "";
  const thStyle = `text-align:${align};font-size:11px;font-weight:700;color:${MUTED_HEX};background:${SUBTLE_HEX};padding:8px 10px;border-bottom:1px solid ${LINE_HEX};`;
  const tdStyle = `text-align:${align};font-size:12px;color:${TEXT_HEX};padding:7px 10px;border-bottom:1px solid ${LINE_HEX};`;
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <thead><tr>${headers.map((h) => `<th style="${thStyle}">${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((r) => `<tr>${r.map((c) => `<td style="${tdStyle}">${esc(c)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function buildReportHtml({
  t, stats, year, month, sectorLabel,
  avgDealSize, avgDealSizeUSD, winRate, winRateDecidedCount,
  offersList, customersList,
}) {
  const align = t.dir === "rtl" ? "right" : "left";
  const periodLine = month === "all" ? t.dashPdfPeriodAll(year) : t.dashPdfPeriodMonth(t.months[month], year);
  const generatedAt = new Date().toLocaleString(t.locale, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", numberingSystem: "latn",
  });

  const summaryItems = [
    [t.dashCardVisits, String(stats.visitsCount)],
    [t.dashPeriodCustomersLabel, String(stats.customersCount)],
    [t.dashCardOffersCount, String(stats.offersCount)],
    [t.dashCardOffersValue, fmtOffersTotals(stats.offersValueTotals, t) || `0 ${t.dashCurrency}`],
    [t.dashAvgDealSize, avgDealSize === null
      ? t.dashNoOffersYet
      : `${fmtMoney(avgDealSize)} ${t.dashCurrency}${avgDealSizeUSD !== null ? ` / ${fmtMoney(avgDealSizeUSD)} ${t.currencies.USD}` : ""}`],
    [t.dashWinRate, winRate === null ? t.dashNoOffersYet : `${winRate.toFixed(0)}% (${t.dashWinRateSample(winRateDecidedCount)})`],
  ];

  const summaryHtml = summaryItems.map(([label, value]) => `
    <div style="flex:1 1 45%;min-width:200px;background:${SUBTLE_HEX};border:1px solid ${LINE_HEX};border-radius:10px;padding:12px 14px;box-sizing:border-box;">
      <div style="font-size:11px;font-weight:700;color:${MUTED_HEX};margin-bottom:4px;">${esc(label)}</div>
      <div style="font-size:17px;font-weight:800;color:${TEXT_HEX};">${esc(value)}</div>
    </div>
  `).join("");

  const pipelineRows = [...STAGE_IDS, "none"].map((id) => {
    const label = id === "none" ? t.stageNone : t.stages[id];
    const count = stats.pipeline[id] || 0;
    const color = id === "none" ? MUTED_HEX : stageColor(id);
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid ${LINE_HEX};">
        <span style="font-size:12px;font-weight:700;color:${TEXT_HEX};">${esc(label)}</span>
        <span style="font-size:12px;font-weight:800;color:${color};">${count}</span>
      </div>
    `;
  }).join("");

  const offersByStatusRows = OFFER_STATUS_IDS.map((id) => {
    const info = stats.offersByStatus[id] || { count: 0, totals: {} };
    const valueText = fmtOffersTotals(info.totals, t) || "—";
    return [t.offerStatuses[id], String(info.count), valueText];
  });

  const offersListRows = offersList.map((o) => [
    o.customerName || t.noCompanyName,
    o.name || "",
    `${fmtMoney(o.amount)} ${t.currencies[o.currency] || t.currencies.EGP}`,
    t.offerStatuses[o.status] || o.status,
    o.offerDate || "",
  ]);

  const customersRows = customersList.map((v) => [
    v.companyName || t.noCompanyName,
    t.sectors[v.sector] || t.sectors.private,
    v.stage ? (t.stages[v.stage] || "") : t.stageNone,
    v.visitDate || t.noVisitYet,
  ]);

  return `
    <div style="width:100%;box-sizing:border-box;padding:28px;background:#FFFFFF;font-family:Tahoma,Arial,sans-serif;color:${TEXT_HEX};">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid ${PRIMARY};padding-bottom:14px;margin-bottom:14px;">
        <div>
          <div style="font-size:20px;font-weight:800;color:${PRIMARY};">Pest.Co</div>
          <div style="font-size:13px;font-weight:700;color:${MUTED_HEX};margin-top:2px;">${esc(t.dashPdfReportTitle)}</div>
        </div>
        <div style="text-align:${align === "right" ? "left" : "right"};font-size:11px;color:${MUTED_HEX};">
          <div>${esc(periodLine)}</div>
          ${sectorLabel ? `<div>${esc(t.dashPdfSectorLine(sectorLabel))}</div>` : ""}
          <div>${esc(t.dashPdfGeneratedAt(generatedAt))}</div>
        </div>
      </div>

      ${sectionTitle(t.dashPdfSummarySection)}
      <div style="display:flex;flex-wrap:wrap;gap:10px;">${summaryHtml}</div>

      ${sectionTitle(t.dashPdfPipelineSection)}
      <div style="border:1px solid ${LINE_HEX};border-radius:10px;overflow:hidden;">${pipelineRows}</div>

      ${sectionTitle(t.dashSalesPerformance)}
      ${simpleTable({ headers: [t.dashOffersTotalLabel, "#", t.dashOffersTotalValueLabel], rows: offersByStatusRows, align })}

      ${sectionTitle(t.dashPdfOffersListSection)}
      ${offersListRows.length > 0
        ? simpleTable({
            headers: [t.dashPdfColCompany, t.dashPdfColOffer, t.dashPdfColAmount, t.dashPdfColStatus, t.dashPdfColDate],
            rows: offersListRows,
            align,
          })
        : `<div style="font-size:12px;color:${MUTED_HEX};padding:10px 0;">${esc(t.dashPdfNoOffers)}</div>`}

      ${sectionTitle(t.dashPdfCustomersSection)}
      ${customersRows.length > 0
        ? simpleTable({
            headers: [t.dashPdfColCompany, t.dashPdfColSector, t.dashPdfColStage, t.visitDateRow],
            rows: customersRows,
            align,
          })
        : `<div style="font-size:12px;color:${MUTED_HEX};padding:10px 0;">${esc(t.dashPdfNoCustomers)}</div>`}

      <div style="margin-top:24px;padding-top:12px;border-top:1px solid ${LINE_HEX};font-size:10px;color:${MUTED_HEX};text-align:center;">
        ${esc(t.dashPdfFooterNote)}
      </div>
    </div>
  `;
}

// Builds and downloads the PDF. `opts` mirrors what the Dashboard already
// computes for the on-screen view (see computePeriodStats/Dashboard.jsx),
// so this never re-derives its own numbers — the report always matches
// exactly what's on screen for the selected year/month/sector.
export async function generateDashboardPdf(opts) {
  const { t } = opts;
  const container = document.createElement("div");
  container.setAttribute("dir", t.dir);
  // Attached to the document (required for html2canvas to read real layout
  // and computed styles) but pushed far off-screen so nothing flashes on
  // screen while it renders.
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-10000px";
  container.style.width = "800px";
  container.style.zIndex = "-1";
  container.innerHTML = buildReportHtml(opts);
  document.body.appendChild(container);

  try {
    const [{ default: html2canvas }, jspdfModule] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const { jsPDF } = jspdfModule;

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#FFFFFF",
      useCORS: true,
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    // Slices the single tall rendered image across as many A4 pages as
    // needed, shifting it up by one page height each time.
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const dateSuffix = new Date().toISOString().slice(0, 10);
    pdf.save(`pestco_report_${dateSuffix}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
