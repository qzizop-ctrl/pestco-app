import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { TEXT, MUTED, LINE, SURFACE, SURFACE_SUBTLE, PRIMARY_MID } from "../../theme";

const BTN_BASE = { borderRadius: 14, padding: "12px 0", width: "100%" };
const FILLED_BTN = { ...BTN_BASE, background: PRIMARY_MID, color: "#fff", marginBottom: 10 };
const OUTLINE_BTN = { ...BTN_BASE, background: SURFACE, border: `1px solid ${PRIMARY_MID}`, color: PRIMARY_MID };
const BTN_CLASS = "btn-press flex items-center justify-center gap-2 font-bold";

// نص زر الاستيراد: العادي / "جاري..." / التقدم (done/total)
function getImportLabel({ busy, progress, idleLabel, busyLabel, progressLabel }) {
  if (!busy) return idleLabel;
  if (progress?.total > 0) return progressLabel(progress.done, progress.total);
  return busyLabel;
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="btn-press font-bold"
      style={{
        flex: 1,
        fontSize: 12,
        padding: "7px 0",
        borderRadius: 999,
        background: active ? PRIMARY_MID : "transparent",
        color: active ? "#fff" : MUTED,
      }}
    >
      {children}
    </button>
  );
}

// لوحة واحدة (عملاء أو موردين): تصدير الكل، تصدير المفلتر، استيراد
function ExportImportPanel({
  t, onExportAll, exportAllLabel, onExportFiltered, exportFilteredLabel,
  onImport, importing, importLabel, fileInputRef, onFile, hint,
}) {
  return (
    <>
      <button onClick={onExportAll} className={BTN_CLASS} style={FILLED_BTN}>
        <Download size={16} /> {exportAllLabel}
      </button>

      <button
        onClick={onExportFiltered}
        className={BTN_CLASS}
        style={{ ...OUTLINE_BTN, marginBottom: 10 }}
      >
        <Download size={16} /> {exportFilteredLabel}
      </button>

      <button
        onClick={onImport}
        disabled={importing}
        className={BTN_CLASS}
        style={{ ...OUTLINE_BTN, opacity: importing ? 0.6 : 1 }}
      >
        <Upload size={16} />{" "}
        {importLabel}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={onFile}
        style={{ display: "none" }}
      />
      <p className="text-xs mt-2" style={{ color: MUTED }}>{hint}</p>
    </>
  );
}

// لوحة تأكيد الاستعادة بعد اختيار الملف
function RestorePendingPanel({ t, restoreBackup, confirmAction }) {
  const { restorePending, restoring } = restoreBackup;
  const dim = { opacity: restoring ? 0.6 : 1 };
  const exportedDate = restorePending.exportedAt?.slice(0, 10) ?? "";

  return (
    <div style={{ background: SURFACE_SUBTLE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, marginTop: 12 }}>
      <p className="font-bold text-sm mb-1" style={{ color: TEXT }}>{t.restorePanelTitle}</p>
      <p className="text-xs mb-3" style={{ color: MUTED, wordBreak: "break-word" }}>
        {t.restoreFileSummary(restorePending.fileName, restorePending.counts, exportedDate)}
      </p>

      <button
        onClick={() => restoreBackup.runRestore("merge")}
        disabled={restoring}
        className="btn-press font-bold"
        style={{ background: PRIMARY_MID, color: "#fff", borderRadius: 12, padding: "10px 0", width: "100%", ...dim }}
      >
        {t.restoreMergeBtn}
      </button>
      <p className="text-xs mt-1 mb-3" style={{ color: MUTED }}>{t.restoreMergeHint}</p>

      <button
        onClick={() => confirmAction(t.restoreReplaceConfirm, () => restoreBackup.runRestore("replace"), { danger: true })}
        disabled={restoring}
        className="btn-press font-bold"
        style={{ background: SURFACE, border: "1px solid #c0392b", color: "#c0392b", borderRadius: 12, padding: "10px 0", width: "100%", ...dim }}
      >
        {t.restoreReplaceBtn}
      </button>
      <p className="text-xs mt-1 mb-3" style={{ color: MUTED }}>{t.restoreReplaceHint}</p>

      <button
        onClick={restoreBackup.cancelRestore}
        disabled={restoring}
        className="btn-press text-sm font-bold"
        style={{ color: MUTED, width: "100%", padding: "6px 0" }}
      >
        {t.restoreCancelBtn}
      </button>
    </div>
  );
}

// زر الاستعادة + اختيار الملف + اللوحة المعلّقة (للمالك فقط)
function RestoreSection({ t, restoreBackup, confirmAction }) {
  const { restoring, restoreProgress } = restoreBackup;
  const showProgress = restoring && restoreProgress;
  const label = showProgress
    ? t.restoreProgress(restoreProgress.done, restoreProgress.total)
    : t.restoreBtn;

  return (
    <>
      <button
        onClick={restoreBackup.triggerRestorePicker}
        disabled={restoring}
        className={BTN_CLASS}
        style={{ ...OUTLINE_BTN, marginTop: 12, opacity: restoring ? 0.6 : 1 }}
      >
        <Upload size={16} />{" "}
        {label}
      </button>
      <input
        ref={restoreBackup.restoreFileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={restoreBackup.handleRestoreFile}
        style={{ display: "none" }}
      />
      <p className="text-xs mt-2" style={{ color: MUTED }}>{t.restoreHint}</p>

      {restoreBackup.restorePending && (
        <RestorePendingPanel t={t} restoreBackup={restoreBackup} confirmAction={confirmAction} />
      )}
    </>
  );
}

// النسخة الاحتياطية الكاملة — للمالك فقط (الـ prop بيتمرر للمالك بس)
function FullBackupSection({ t, exportFullBackupJson, restoreBackup, confirmAction }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <button onClick={exportFullBackupJson} className={BTN_CLASS} style={OUTLINE_BTN}>
        <Download size={16} /> {t.fullBackupBtn}
      </button>
      <p className="text-xs mt-2" style={{ color: MUTED }}>{t.fullBackupHint}</p>

      {restoreBackup && (
        <RestoreSection t={t} restoreBackup={restoreBackup} confirmAction={confirmAction} />
      )}
    </div>
  );
}

export default function ImportExportCard({
  t,
  exportAllToExcel,
  exportFullBackupJson,
  restoreBackup,
  confirmAction,
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

  const importLabel = getImportLabel({
    busy: importing,
    progress: importProgress,
    idleLabel: t.importBtn,
    busyLabel: t.importing,
    progressLabel: t.importProgress,
  });
  const supplierImportLabel = getImportLabel({
    busy: importingSuppliers,
    progress: supplierImportProgress,
    idleLabel: t.importSuppliersBtn,
    busyLabel: t.importingSuppliers,
    progressLabel: t.importSuppliersProgress,
  });

  return (
    <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
      <p className="font-bold text-base mb-3" style={{ color: TEXT }}>{t.excelTitle}</p>

      {/* مفتاح تبديل بدل ما نضيف صف أزرار تاني ثابت — بيبان بس أزرار
          التبويب المختار، فمساحة الكارت بتفضل زي ما هي. */}
      <div className="flex items-center" style={{ background: SURFACE_SUBTLE, borderRadius: 999, padding: 3, marginBottom: 14 }}>
        <TabButton active={exportTab === "customers"} onClick={() => setExportTab("customers")}>
          {t.exportTabCustomers}
        </TabButton>
        <TabButton active={exportTab === "suppliers"} onClick={() => setExportTab("suppliers")}>
          {t.exportTabSuppliers}
        </TabButton>
      </div>

      {/* Full lossless backup — owner only. Sits above the tabs: it covers
          customers AND suppliers. */}
      {exportFullBackupJson && (
        <FullBackupSection
          t={t}
          exportFullBackupJson={exportFullBackupJson}
          restoreBackup={restoreBackup}
          confirmAction={confirmAction}
        />
      )}

      {exportTab === "customers" ? (
        <ExportImportPanel
          t={t}
          onExportAll={exportAllToExcel}
          exportAllLabel={t.exportAllBtn}
          onExportFiltered={exportFilteredToExcel}
          exportFilteredLabel={t.exportFilteredBtn(filteredCount)}
          onImport={triggerImportPicker}
          importing={importing}
          importLabel={importLabel}
          fileInputRef={fileInputRef}
          onFile={handleImportFile}
          hint={t.importHint}
        />
      ) : (
        <ExportImportPanel
          t={t}
          onExportAll={exportSuppliersAllToExcel}
          exportAllLabel={t.exportSuppliersAllBtn}
          onExportFiltered={exportSuppliersFilteredToExcel}
          exportFilteredLabel={t.exportSuppliersFilteredBtn(filteredSuppliersCount)}
          onImport={triggerSupplierImportPicker}
          importing={importingSuppliers}
          importLabel={supplierImportLabel}
          fileInputRef={supplierFileInputRef}
          onFile={handleImportSupplierFile}
          hint={t.importSuppliersHint}
        />
      )}
    </div>
  );
}
