import { Capacitor } from "@capacitor/core";
import { todayLocalISO } from "../helpers";
import { neutralizeFormulas } from "../excelSafety";

// Excel export for customers and suppliers, extracted out of App.jsx (it
// was one of the larger self-contained chunks in there — pure functions of
// whatever rows are passed in, no dependency on any of App's mutable
// state). Import is NOT included here: it's tangled up with per-screen
// loading-state setters (setImporting/setImportingSuppliers) and stays in
// App.jsx for now.

// Builds a worksheet from row objects. Formula-injection protection lives in
// excelSafety.js: every string cell is forced to a plain string cell, so text
// like "+2010…" or "=SUM(…)" is stored and displayed exactly as typed instead
// of gaining a visible leading apostrophe (see the notes there).
function sheetFromRows(XLSX, rows) {
  return neutralizeFormulas(XLSX.utils.json_to_sheet(rows));
}

export function useExcelExport({ t, canEdit }) {
  const visitsToRows = (rows) =>
    rows.map((v) => ({
      [t.companyLabel.replace(" *", "")]: v.companyName || "",
      [t.contactLabel.replace(" *", "")]: v.contactName || "",
      [t.sectorLabel]: t.sectors[v.sector] || v.sector || "",
      [t.roleLabel]: t.roles[v.role] || v.role || "",
      [t.pipelineLabel]: t.stages[v.stage] || v.stage || "",
      [t.tagsLabel]: (v.tags || []).join(", "),
      [t.phoneLabel]: v.phone || "",
      [t.emailLabel]: v.email || "",
      [t.visitDateLabel]: v.visitDate || "",
      [t.callDateLabel]: v.callDateTime || "",
      [t.notesLabel]: v.notes || "",
    }));

  const writeExcel = async (rows, filenameSuffix) => {
    const XLSX = await import("xlsx");
    const ws = sheetFromRows(XLSX, visitsToRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visits");
    const fileName = `pestco_visits_${filenameSuffix}_${todayLocalISO()}.xlsx`;

    if (Capacitor.isNativePlatform()) {
      // XLSX.writeFile() is a plain browser Blob download under the hood,
      // which has no native handler inside the Android WebView (same issue
      // as the PDF export — see pdfReport.js). Write the bytes to disk via
      // Capacitor Filesystem instead.
      const { saveFileNative } = await import("../nativeFileSave");
      const base64Data = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      await saveFileNative(
        fileName,
        base64Data,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } else {
      XLSX.writeFile(wb, fileName);
    }
  };

  const suppliersToRows = (rows) =>
    rows.map((s) => ({
      [t.supplierNameLabel.replace(" *", "")]: s.name || "",
      [t.supplierContactLabel]: s.contactName || "",
      [t.supplierCategoryLabel]: s.category || "",
      [t.supplierTagsLabel]: (s.tags || []).join(", "),
      [t.phoneLabel]: s.phone || "",
      [t.emailLabel]: s.email || "",
      [t.supplierNotesLabel]: s.notes || "",
    }));

  const writeSuppliersExcel = async (rows, filenameSuffix) => {
    const XLSX = await import("xlsx");
    const ws = sheetFromRows(XLSX, suppliersToRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
    const fileName = `pestco_suppliers_${filenameSuffix}_${todayLocalISO()}.xlsx`;

    if (Capacitor.isNativePlatform()) {
      const { saveFileNative } = await import("../nativeFileSave");
      const base64Data = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      await saveFileNative(
        fileName,
        base64Data,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } else {
      XLSX.writeFile(wb, fileName);
    }
  };

  const exportVisits = async (rows, filenameSuffix) => {
    if (!canEdit) return;
    await writeExcel(rows, filenameSuffix);
  };

  const exportSuppliers = async (rows, filenameSuffix) => {
    if (!canEdit) return;
    await writeSuppliersExcel(rows, filenameSuffix);
  };

  // Builds one workbook with both a Visits and a Suppliers sheet and saves
  // it the same way a manual export does (silently to Downloads on
  // Android, a normal browser/Electron download on Windows/web) — used by
  // the weekly auto-backup (src/hooks/useAutoBackup.js).
  const saveBackupWorkbook = async (visits, suppliers) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, visitsToRows(visits)), "Visits");
    XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, suppliersToRows(suppliers)), "Suppliers");
    const fileName = `pestco_backup_${todayLocalISO()}.xlsx`;

    if (Capacitor.isNativePlatform()) {
      const { saveFileNative } = await import("../nativeFileSave");
      const base64Data = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      await saveFileNative(
        fileName,
        base64Data,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } else {
      XLSX.writeFile(wb, fileName);
    }
  };

  return { exportVisits, exportSuppliers, saveBackupWorkbook };
}
