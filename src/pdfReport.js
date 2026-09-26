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
// Implementation note on chunking: html2canvas clones the ENTIRE target
// element into a hidden iframe before it rasterizes anything, even when
// you only ask it to capture a small x/y/width/height slice of it. That
// means a single giant off-screen container holding every offer and every
// customer for a report period gets fully laid out and cloned again on
// EVERY page iteration — for a big "all months" report that repeated
// full-height layout is what was exhausting WebView memory and hard
// -crashing the app, even though the same code worked fine for a
// single-month report with few rows. The fix here is to never build one
// container holding the whole report: the fixed-size sections (header,
// summary, pipeline, sales performance) render once in their own small
// container, and the offers/customers tables are split into fixed-size
// row batches (see ROWS_PER_CHUNK), each rendered in its own small
// container and added as its own PDF page(s). No single html2canvas call
// ever has to lay out more than one batch's worth of rows, regardless of
// how long the overall report is.
//
// Implementation note on saving the file: jsPDF's pdf.save() works by
// creating a Blob URL and programmatically clicking a hidden <a download>
// link — a plain browser download. That mechanism has no native handler
// inside the Android WebView that Capacitor renders the app in, so on the
// packaged Android app the export silently does nothing (no error, no
// file) even though the exact same code produces a real download in a
// desktop/mobile browser tab or the Electron build. On a native platform
// this instead writes the PDF bytes straight to disk via a native
// MediaStore-backed plugin method (see nativeFileSave.js) which lands the
// file directly in the public Downloads folder with no dialog on
// Android 10+.
// ============================================================================

import { Capacitor } from "@capacitor/core";
import { stageColor, PRIMARY } from "./theme";
import { STAGE_IDS, OFFER_STATUS_IDS } from "./domain";
import { fmtMoney, fmtUnifiedOrSplit, todayLocalISO } from "./helpers";

// The report always renders on a plain white/light background regardless of
// the app's current theme (dark mode) — a report meant for printing/sharing
// with a manager shouldn't come out dark. These mirror THEME_VARS.light in
// constants.js rather than reusing the CSS-variable exports (TEXT/MUTED/
// LINE/SURFACE), which follow whatever theme is active on screen.
const TEXT_HEX = "#1B241F";
const MUTED_HEX = "#6B7168";
const LINE_HEX = "#E7E2D6";
const SUBTLE_HEX = "#F8F6F0";

// How many table rows go into a single off-screen container / html2canvas
// call. Keeping this fixed and small is what keeps memory use flat no
// matter how many months' worth of offers/customers are in the report.
const ROWS_PER_CHUNK = 25;

const CONTAINER_WIDTH_PX = 800;
const RENDER_SCALE = 1.5;

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

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks.length > 0 ? chunks : [[]];
}

// Rejection-reasons analytics section — mirrors the on-screen "Rejection
// Reasons Analytics" tab (see computeRejectionReasonsReport in
// dashboardCalculations.js / SalesAnalysisCard.jsx). This used to be shown
// on screen only and left out of the exported report entirely, even though
// it's one of the more actionable sections for a manager reading the PDF
// later rather than looking at the live dashboard. Bounded by
// REJECTION_REASON_IDS (a handful of fixed reasons) plus one row per rep
// who has a rejection in the period — small either way, so like the
// pipeline/sales-performance tables above this is safe inside the
// fixed-size front matter rather than needing its own chunked pages.
function buildRejectionSectionHtml({ t, rejectionReport }) {
  const align = t.dir === "rtl" ? "right" : "left";

  if (!rejectionReport || rejectionReport.total === 0) {
    return `
      ${sectionTitle(t.dashRejectionReport)}
      <div style="font-size:12px;color:${MUTED_HEX};padding:4px 0 10px;">${esc(t.dashRejectionReportEmpty)}</div>
    `;
  }

  const reasonRows = rejectionReport.byReason.map((r) => [
    r.label, String(r.count), t.dashRejectionReportPct(r.pct),
  ]);
  const reasonTable = simpleTable({
    headers: [t.dashRejectionReport, "#", "%"],
    rows: reasonRows,
    align,
  });

  const repSection = rejectionReport.byRep.length > 1
    ? `
      <div style="font-size:12px;font-weight:700;color:${MUTED_HEX};margin:10px 0 6px;">${esc(t.dashRejectionReportByRep)}</div>
      ${simpleTable({
        headers: [t.dashRejectionReportByRep, "#"],
        rows: rejectionReport.byRep.map((r) => [r.name, String(r.count)]),
        align,
      })}
    `
    : "";

  return `
    ${sectionTitle(t.dashRejectionReport)}
    ${reasonTable}
    ${repSection}
  `;
}

// Front-matter HTML: header, summary cards, pipeline, sales-performance
// table, rejection-reasons breakdown. Size of this is fixed by the app's
// own fixed set of stages/status/rejection-reason values — it never grows
// with how much data is in the selected period, so it's always safe to
// render as a single container.
function buildFrontMatterHtml({
  t, stats, periodLabel, sectorLabel,
  avgDealSize, avgDealSizeUSD, winRate, winRateDecidedCount,
  rejectionReport, exchangeRate, unifyCurrency,
}) {
  const align = t.dir === "rtl" ? "right" : "left";
  const periodLine = t.dashPdfPeriod(periodLabel);
  const generatedAt = new Date().toLocaleString(t.locale, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", numberingSystem: "latn",
  });

  const summaryItems = [
    [t.dashCardVisits, String(stats.visitsCount)],
    [t.dashPeriodCustomersLabel, String(stats.customersCount)],
    [t.dashCardOffersCount, String(stats.offersCount)],
    [t.dashCardOffersValue, fmtUnifiedOrSplit(stats.offersValueTotals, t, exchangeRate, unifyCurrency) || `0 ${t.dashCurrency}`],
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
    const valueText = fmtUnifiedOrSplit(info.totals, t, exchangeRate, unifyCurrency) || "—";
    return [t.offerStatuses[id], String(info.count), valueText];
  });

  return `
    <div style="width:100%;box-sizing:border-box;padding:28px;background:#FFFFFF;font-family:Tahoma,Arial,sans-serif;color:${TEXT_HEX};">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid ${PRIMARY};padding-bottom:14px;margin-bottom:14px;">
        <div>
          <div style="font-size:20px;font-weight:800;color:${PRIMARY};">PEST</div>
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

      ${buildRejectionSectionHtml({ t, rejectionReport })}
    </div>
  `;
}

// One chunk of the offers list (ROWS_PER_CHUNK rows or fewer), as its own
// small, self-contained container.
function buildOffersChunkHtml({ t, rows, isFirstChunk, isLastChunk: _isLastChunk, trailingHtml = "" }) {
  const align = t.dir === "rtl" ? "right" : "left";
  const title = isFirstChunk ? t.dashPdfOffersListSection : `${t.dashPdfOffersListSection} (${t.dashPdfContinued || "تابع"})`;
  const body = rows.length > 0
    ? simpleTable({
        headers: [t.dashPdfColCompany, t.dashPdfColOffer, t.dashPdfColAmount, t.dashPdfColStatus, t.dashPdfColDate],
        rows,
        align,
      })
    : `<div style="font-size:12px;color:${MUTED_HEX};padding:10px 0;">${esc(t.dashPdfNoOffers)}</div>`;

  return `
    <div style="width:100%;box-sizing:border-box;padding:28px;background:#FFFFFF;font-family:Tahoma,Arial,sans-serif;color:${TEXT_HEX};">
      ${sectionTitle(title)}
      ${body}
      ${trailingHtml}
    </div>
  `;
}

// Small footer fragment — appended to the bottom of whichever chunk turns
// out to be the actual last page of content (see generateDashboardPdf),
// rather than rendered as its own container. Giving it a dedicated
// renderHtmlChunk call used to mean a whole extra A4 page whose only
// content was this one short line — i.e. a page that looked blank.
function footerFragmentHtml(t) {
  return `<div style="padding-top:12px;margin-top:20px;border-top:1px solid ${LINE_HEX};font-size:10px;color:${MUTED_HEX};text-align:center;">${esc(t.dashPdfFooterNote)}</div>`;
}

// Builds and downloads the PDF. `opts` mirrors what the Dashboard already
// computes for the on-screen view (see computePeriodStats/Dashboard.jsx),
// so this never re-derives its own numbers — the report always matches
// exactly what's on screen for the selected year/month/sector.
export async function generateDashboardPdf(opts) {
  const { t, offersList = [] } = opts;

  const [{ default: html2canvas }, jspdfModule] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const { jsPDF } = jspdfModule;

  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  // How many CSS pixels of an 800px-wide off-screen container correspond
  // to one A4 page once that width is scaled up to fill pageWidth.
  const cssPxPerPage = pageHeight * (CONTAINER_WIDTH_PX / pageWidth);

  let anyPageAdded = false;

  // Renders one small, self-contained HTML string as one or more PDF
  // pages. Each call gets its own fresh container that's removed right
  // after — nothing from a previous chunk stays in the DOM, so memory use
  // never accumulates across chunks regardless of total report length.
  async function renderHtmlChunk(html) {
    const container = document.createElement("div");
    container.setAttribute("dir", t.dir);
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "-10000px";
    container.style.width = `${CONTAINER_WIDTH_PX}px`;
    container.style.zIndex = "-1";
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const totalHeightPx = container.scrollHeight;
      const pageCount = Math.max(1, Math.ceil(totalHeightPx / cssPxPerPage));

      for (let page = 0; page < pageCount; page++) {
        const sliceY = page * cssPxPerPage;
        const sliceHeightPx = Math.min(cssPxPerPage, totalHeightPx - sliceY);

        const canvas = await html2canvas(container, {
          scale: RENDER_SCALE,
          backgroundColor: "#FFFFFF",
          useCORS: true,
          x: 0,
          y: sliceY,
          width: CONTAINER_WIDTH_PX,
          height: sliceHeightPx,
          windowWidth: CONTAINER_WIDTH_PX,
          windowHeight: totalHeightPx,
        });

        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL("image/jpeg", 0.85);

        if (anyPageAdded) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
        anyPageAdded = true;
      }
    } finally {
      document.body.removeChild(container);
    }
  }

  // 1) Offers list, split into fixed-size row batches. chunkArray always
  // returns at least one chunk (an empty one, rendered as the "no
  // offers" placeholder, when offersList is empty) — so there's always
  // exactly one true last chunk to attach the footer to below.
  const offerRows = offersList.map((o) => [
    o.customerName || t.noCompanyName,
    o.name || "",
    `${fmtMoney(o.amount)} ${t.currencies[o.currency] || t.currencies.EGP}`,
    t.offerStatuses[o.status] || o.status,
    o.offerDate || "",
  ]);
  const offerChunks = chunkArray(offerRows, ROWS_PER_CHUNK);
  const footerHtml = footerFragmentHtml(t);

  // 2) Fixed-size front matter — always safe as a single container.
  await renderHtmlChunk(buildFrontMatterHtml(opts));

  // 3) Offers list. The footer note is attached to the bottom of the
  // last batch here — not rendered as its own page — so the report
  // never ends on a near-blank page holding only that one line.
  for (let i = 0; i < offerChunks.length; i++) {
    const isLastChunk = i === offerChunks.length - 1;
    await renderHtmlChunk(buildOffersChunkHtml({
      t, rows: offerChunks[i], isFirstChunk: i === 0, isLastChunk,
      trailingHtml: isLastChunk ? footerHtml : "",
    }));
  }

  // 4) Page numbers, stamped onto every page now that the final page
  // count is known — has to happen after all content is in, since
  // chunks upstream (offers) don't know the eventual total while
  // they're being rendered.
  await addPageNumbers({ pdf, t, html2canvas, pageWidth, pageHeight });

  const dateSuffix = todayLocalISO();
  const fileName = `pestco_report_${dateSuffix}.pdf`;

  if (Capacitor.isNativePlatform()) {
    await saveAndSharePdfNative(pdf, fileName);
  } else {
    // Plain browser tab / Electron: the standard Blob-download path
    // works fine here, no native file handoff needed.
    pdf.save(fileName);
  }
}

// Stamps "Page X of Y" (localized — see t.dashPdfPageOf) onto every page of
// the finished PDF, small and centered at the bottom. Same html2canvas
// render-as-image approach as everything else in this file (Arabic needs
// the browser's own text engine, not jsPDF's built-in fonts — see the
// file-level comment at the top), but as a transparent PNG overlay rather
// than a full opaque page image, since this has to sit on top of content
// that's already on each page rather than replacing it. Run once at the
// end, after every content chunk above has already been added, because
// the total page count isn't known until then.
async function addPageNumbers({ pdf, t, html2canvas, pageWidth, pageHeight }) {
  const totalPages = pdf.internal.getNumberOfPages();
  if (totalPages === 0) return;

  for (let page = 1; page <= totalPages; page++) {
    const container = document.createElement("div");
    container.setAttribute("dir", t.dir);
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "-10000px";
    container.style.width = "260px";
    container.style.zIndex = "-1";
    container.style.fontFamily = "Tahoma, Arial, sans-serif";
    container.style.fontSize = "11px";
    container.style.fontWeight = "700";
    container.style.color = MUTED_HEX;
    container.style.textAlign = "center";
    container.style.padding = "2px 0";
    container.textContent = t.dashPdfPageOf(page, totalPages);
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: RENDER_SCALE,
        backgroundColor: null,
        useCORS: true,
      });
      const imgWidth = 120;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL("image/png");

      pdf.setPage(page);
      pdf.addImage(imgData, "PNG", (pageWidth - imgWidth) / 2, pageHeight - imgHeight - 16, imgWidth, imgHeight);
    } finally {
      document.body.removeChild(container);
    }
  }
}

// Writes the PDF to the device (straight into Downloads on Android 10+ via
// MediaStore, no dialog) and, if that fails, falls back to the app cache
// plus the OS share/save sheet — see nativeFileSave.js.
async function saveAndSharePdfNative(pdf, fileName) {
  const { saveFileNative } = await import("./nativeFileSave");

  // Raw base64 (no "data:application/pdf;base64," prefix) — that's what
  // the native save plugin expects.
  const base64Data = pdf.output("datauristring").split(",")[1];

  await saveFileNative(fileName, base64Data);
}
