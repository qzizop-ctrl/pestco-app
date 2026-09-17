import { Capacitor } from "@capacitor/core";

// Excel export for customers and suppliers, extracted out of App.jsx (it
// was one of the larger self-contained chunks in there — pure functions of
// whatever rows are passed in, no dependency on any of App's mutable
// state). Import is NOT included here: it's tangled up with per-screen
// loading-state setters (setImporting/setImportingSuppliers) and stays in
// App.jsx for now.

// Guards against CSV/Excel "formula injection": any free-text field here
// (company/contact name, notes, tags, ...) is user-entered — including via
// the Excel *import* path (useExcelImport.js), which means a malicious
// value could round-trip from one person's import into another person's
// export. If a cell's text starts with =, +, -, @, or a tab/CR (the
// characters Excel treats as "this cell is a formula"), Excel/Sheets will
// try to evaluate it on open — e.g. a notes field containing something
// like `=HYPERLINK("http://evil","click")` or a DDE payload. Prefixing
// such values with a straight quote keeps Excel from interpreting them as
// formulas while leaving the visible text unchanged (Excel hides a
// leading `'` on text cells). Numbers/booleans/empty values pass through
// untouched — only strings can carry a formula.
function sanitizeCell(value) {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function sanitizeRow(row) {
  const out = {};
  for (const key of Object.keys(row)) {
    out[key] = sanitizeCell(row[key]);
  }
  return out;
}

export function useExcelExport({ t, canEdit }) {
  const visitsToRows = (rows) =>
    rows.map((v) =>
      sanitizeRow({
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
      })
    );

  const writeExcel = async (rows, filenameSuffix) => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(visitsToRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visits");
    const fileName = `pestco_visits_${filenameSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;

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
    rows.map((s) =>
      sanitizeRow({
        [t.supplierNameLabel.replace(" *", "")]: s.name || "",
        [t.supplierContactLabel]: s.contactName || "",
        [t.supplierCategoryLabel]: s.category || "",
        [t.supplierTagsLabel]: (s.tags || []).join(", "),
        [t.phoneLabel]: s.phone || "",
        [t.emailLabel]: s.email || "",
        [t.supplierNotesLabel]: s.notes || "",
      })
    );

  const writeSuppliersExcel = async (rows, filenameSuffix) => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(suppliersToRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
    const fileName = `pestco_suppliers_${filenameSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;

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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(visitsToRows(visits)), "Visits");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppliersToRows(suppliers)), "Suppliers");
    const fileName = `pestco_backup_${new Date().toISOString().slice(0, 10)}.xlsx`;

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
