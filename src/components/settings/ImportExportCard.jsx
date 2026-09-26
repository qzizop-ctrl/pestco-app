import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { TEXT, MUTED, LINE, SURFACE, SURFACE_SUBTLE, PRIMARY_MID } from "../../theme";

export default function ImportExportCard({
  t,
  exportAllToExcel,
  exportFilteredToExcel,
  filteredCount,
  triggerImportPicker,
  importing,
  importProgress,
  fileInputRef,
  handleImportFile,
  exportSuppliersAllToExcel,
  exportSuppliersFilteredToExcel,
  filteredSuppliersCount,
  triggerSupplierImportPicker,
  importingSuppliers,
  supplierImportProgress,
  supplierFileInputRef,
  handleImportSupplierFile,
}) {
  const [exportTab, setExportTab] = useState("customers");

  return (
    <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
      <p className="font-bold text-base mb-3" style={{ color: TEXT }}>{t.excelTitle}</p>

      {/* مفتاح تبديل بدل ما نضيف صف أزرار تاني ثابت — بيبان بس أزرار
          التبويب المختار، فمساحة الكارت بتفضل زي ما هي. */}
      <div className="flex items-center" style={{ background: SURFACE_SUBTLE, borderRadius: 999, padding: 3, marginBottom: 14 }}>
        <button
          onClick={() => setExportTab("customers")}
          className="btn-press font-bold"
          style={{
            flex: 1,
            fontSize: 12,
            padding: "7px 0",
            borderRadius: 999,
            background: exportTab === "customers" ? PRIMARY_MID : "transparent",
            color: exportTab === "customers" ? "#fff" : MUTED,
          }}
        >
          {t.exportTabCustomers}
        </button>
        <button
          onClick={() => setExportTab("suppliers")}
          className="btn-press font-bold"
          style={{
            flex: 1,
            fontSize: 12,
            padding: "7px 0",
            borderRadius: 999,
            background: exportTab === "suppliers" ? PRIMARY_MID : "transparent",
            color: exportTab === "suppliers" ? "#fff" : MUTED,
          }}
        >
          {t.exportTabSuppliers}
        </button>
      </div>

      {exportTab === "customers" ? (
        <>
          <button
            onClick={exportAllToExcel}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: PRIMARY_MID,
              color: "#fff",
              borderRadius: 14,
              padding: "12px 0",
              width: "100%",
              marginBottom: 10,
            }}
          >
            <Download size={16} /> {t.exportAllBtn}
          </button>

          <button
            onClick={exportFilteredToExcel}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: SURFACE,
              border: `1px solid ${PRIMARY_MID}`,
              color: PRIMARY_MID,
              borderRadius: 14,
              padding: "12px 0",
              width: "100%",
              marginBottom: 10,
            }}
          >
            <Download size={16} /> {t.exportFilteredBtn(filteredCount)}
          </button>

          <button
            onClick={triggerImportPicker}
            disabled={importing}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: SURFACE,
              border: `1px solid ${PRIMARY_MID}`,
              color: PRIMARY_MID,
              borderRadius: 14,
              padding: "12px 0",
              width: "100%",
              opacity: importing ? 0.6 : 1,
            }}
          >
            <Upload size={16} />{" "}
            {importing
              ? importProgress && importProgress.total > 0
                ? t.importProgress(importProgress.done, importProgress.total)
                : t.importing
              : t.importBtn}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFile}
            style={{ display: "none" }}
          />
          <p className="text-xs mt-2" style={{ color: MUTED }}>{t.importHint}</p>
        </>
      ) : (
        <>
          <button
            onClick={exportSuppliersAllToExcel}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: PRIMARY_MID,
              color: "#fff",
              borderRadius: 14,
              padding: "12px 0",
              width: "100%",
              marginBottom: 10,
            }}
          >
            <Download size={16} /> {t.exportSuppliersAllBtn}
          </button>

          <button
            onClick={exportSuppliersFilteredToExcel}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: SURFACE,
              border: `1px solid ${PRIMARY_MID}`,
              color: PRIMARY_MID,
              borderRadius: 14,
              padding: "12px 0",
              width: "100%",
              marginBottom: 10,
            }}
          >
            <Download size={16} /> {t.exportSuppliersFilteredBtn(filteredSuppliersCount)}
          </button>

          <button
            onClick={triggerSupplierImportPicker}
            disabled={importingSuppliers}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: SURFACE,
              border: `1px solid ${PRIMARY_MID}`,
              color: PRIMARY_MID,
              borderRadius: 14,
              padding: "12px 0",
              width: "100%",
              opacity: importingSuppliers ? 0.6 : 1,
            }}
          >
            <Upload size={16} />{" "}
            {importingSuppliers
              ? supplierImportProgress && supplierImportProgress.total > 0
                ? t.importSuppliersProgress(supplierImportProgress.done, supplierImportProgress.total)
                : t.importingSuppliers
              : t.importSuppliersBtn}
          </button>
          <input
            ref={supplierFileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportSupplierFile}
            style={{ display: "none" }}
          />
          <p className="text-xs mt-2" style={{ color: MUTED }}>{t.importSuppliersHint}</p>
        </>
      )}
    </div>
  );
}
