import { useState, useRef } from "react";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { scheduleCallReminder } from "../notifications";
import { STRINGS } from "../i18n";
import { MAX_IMPORT_ROWS, IMPORT_BATCH_SIZE } from "../domain";
import { buildActivity } from "../activityHelpers";
import { findSectorId, findRoleId, findStageId, normalizeExcelDate, normalizeExcelDateTime, splitImportDuplicates } from "../excelImportHelpers";
import { parseTagsCell } from "../tagsAndLinks";
import { queueAudit } from "./useAuditLog";
import { reportException } from "../sentry";
import { stripFormulaGuard } from "../excelSafety";

// Excel *import* only — export lives in useExcelExport.js (the write side
// uses a very different shape, so keeping them apart avoids one bloated
// "excel stuff" file). Split out of App.jsx.
//
// Writes go through writeBatch() in chunks of IMPORT_BATCH_SIZE instead of
// one addDoc() per row awaited in sequence. The old sequential version made
// a large file (hundreds of rows) noticeably slow with the UI reporting
// nothing beyond a static "Importing..." the whole time — this reports
// (done/total) progress as each chunk commits, and cuts the number of
// network round-trips roughly in half by writing the row's initial
// activityLog entry directly instead of a separate appendActivity()
// updateDoc() call afterward. MAX_IMPORT_ROWS caps a single import so an
// oversized or wrong file fails fast with a clear message rather than
// churning through thousands of rows silently.
export function useExcelImport({ ownerUid, user, visits, suppliers, canEdit, requireOnline, t, showAlert, appendActivity: _appendActivity }) {
  const fileInputRef = useRef(null);
  const supplierFileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importingSuppliers, setImportingSuppliers] = useState(false);
  // null while idle; {done, total} while a batch import is running, so the
  // UI can show "Importing... (120/450)" instead of a static label.
  const [importProgress, setImportProgress] = useState(null);
  const [supplierImportProgress, setSupplierImportProgress] = useState(null);

  const triggerImportPicker = () => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!file || !user || !ownerUid) return;

    setImporting(true);
    // Declared outside the try so a batch failure partway through (see the
    // catch block below) can still report how many rows were committed
    // before it, instead of just "something went wrong" with no way to
    // tell whether 0 rows or 450 rows actually landed in Firestore.
    let count = 0;
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length > MAX_IMPORT_ROWS) {
        showAlert(t.importTooLarge(MAX_IMPORT_ROWS));
        return;
      }

      const headerMap = {
        companyName: [
          STRINGS.ar.companyLabel, STRINGS.en.companyLabel,
          STRINGS.ar.companyLabel.replace(" *", ""), STRINGS.en.companyLabel.replace(" *", ""),
        ],
        contactName: [
          STRINGS.ar.contactLabel, STRINGS.en.contactLabel,
          STRINGS.ar.contactLabel.replace(" *", ""), STRINGS.en.contactLabel.replace(" *", ""),
        ],
        sector: [STRINGS.ar.sectorLabel, STRINGS.en.sectorLabel],
        role: [STRINGS.ar.roleLabel, STRINGS.en.roleLabel],
        stage: [STRINGS.ar.pipelineLabel, STRINGS.en.pipelineLabel],
        tags: [STRINGS.ar.tagsLabel, STRINGS.en.tagsLabel],
        phone: [STRINGS.ar.phoneLabel, STRINGS.en.phoneLabel],
        email: [STRINGS.ar.emailLabel, STRINGS.en.emailLabel],
        visitDate: [STRINGS.ar.visitDateLabel, STRINGS.en.visitDateLabel],
        callDateTime: [STRINGS.ar.callDateLabel, STRINGS.en.callDateLabel],
        notes: [STRINGS.ar.notesLabel, STRINGS.en.notesLabel],
      };

      const getField = (row, key) => {
        for (const candidate of headerMap[key]) {
          if (row[candidate] !== undefined && row[candidate] !== "") return stripFormulaGuard(row[candidate]);
        }
        return "";
      };

      // Build the full list of valid rows up front so the total is known
      // for progress reporting, and so an empty row never counts toward it.
      const visitsCollection = collection(db, "users", ownerUid, "visits");
      const pending = [];
      for (const row of rows) {
        const companyName = String(getField(row, "companyName") || "").trim();
        const contactName = String(getField(row, "contactName") || "").trim();
        if (!companyName && !contactName) continue;

        const callDateTime = normalizeExcelDateTime(getField(row, "callDateTime"));
        const visitData = {
          companyName,
          contactName,
          sector: findSectorId(getField(row, "sector")),
          role: findRoleId(getField(row, "role")),
          stage: findStageId(getField(row, "stage")),
          tags: parseTagsCell(getField(row, "tags")),
          phone: String(getField(row, "phone") || "").trim(),
          email: String(getField(row, "email") || "").trim(),
          visitDate: normalizeExcelDate(getField(row, "visitDate")),
          notes: String(getField(row, "notes") || "").trim(),
          callDateTime,
          notified: false,
          activityLog: [buildActivity("created", t.activityCreated)],
          offers: [],
          createdAt: serverTimestamp(),
        };

        pending.push({ ref: doc(visitsCollection), visitData, companyName, contactName, callDateTime });
      }

      // Skip rows whose phone already belongs to an existing customer (or to
      // an earlier row of this same file). Without this, importing the same
      // sheet twice silently doubled every customer — and it makes it safe to
      // re-run an import that stopped half way: rows already saved are skipped.
      const { kept, skipped } = splitImportDuplicates(pending, visits, (p) => p.visitData.phone);
      pending.length = 0;
      pending.push(...kept);

      setImportProgress({ done: 0, total: pending.length });

      for (let i = 0; i < pending.length; i += IMPORT_BATCH_SIZE) {
        const chunk = pending.slice(i, i + IMPORT_BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(({ ref, visitData, companyName }) => {
          batch.set(ref, visitData);
          // Imported records used to leave no trace in the audit log.
          queueAudit(batch, ownerUid, {
            entityType: "customer", entityId: ref.id, entityName: companyName,
            action: "create", user, t,
          });
        });
        await batch.commit();

        for (const { ref, companyName, contactName, callDateTime } of chunk) {
          if (callDateTime) {
            await scheduleCallReminder(
              ref.id,
              callDateTime,
              `${t.reminderTitle} ${companyName}`,
              t.reminderBody(contactName)
            );
          }
        }
        count += chunk.length;
        setImportProgress({ done: count, total: pending.length });
      }
      showAlert(t.importSuccess(count) + (skipped ? t.importSkipped(skipped) : ""));
    } catch (err) {
      // Was a bare `catch { showAlert(t.importError) }` — swallowed the
      // real error (no console.error, no reportException, unlike every
      // other Firestore write path in this app) and always showed the same
      // generic message even when `count` rows had already committed in
      // earlier batches before this one failed.
      console.error("Excel import failed:", err);
      reportException(err, { context: "Excel import failed", ownerUid, partiallyImported: count });
      showAlert(count > 0 ? t.importPartialError(count) : t.importError);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const triggerSupplierImportPicker = () => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (supplierFileInputRef.current) supplierFileInputRef.current.click();
  };

  const handleImportSupplierFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!file || !user || !ownerUid) return;

    setImportingSuppliers(true);
    let count = 0;
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length > MAX_IMPORT_ROWS) {
        showAlert(t.importSuppliersTooLarge(MAX_IMPORT_ROWS));
        return;
      }

      const headerMap = {
        name: [
          STRINGS.ar.supplierNameLabel, STRINGS.en.supplierNameLabel,
          STRINGS.ar.supplierNameLabel.replace(" *", ""), STRINGS.en.supplierNameLabel.replace(" *", ""),
        ],
        contactName: [STRINGS.ar.supplierContactLabel, STRINGS.en.supplierContactLabel],
        category: [STRINGS.ar.supplierCategoryLabel, STRINGS.en.supplierCategoryLabel],
        tags: [STRINGS.ar.supplierTagsLabel, STRINGS.en.supplierTagsLabel],
        phone: [STRINGS.ar.phoneLabel, STRINGS.en.phoneLabel],
        email: [STRINGS.ar.emailLabel, STRINGS.en.emailLabel],
        notes: [STRINGS.ar.supplierNotesLabel, STRINGS.en.supplierNotesLabel],
      };

      const getField = (row, key) => {
        for (const candidate of headerMap[key]) {
          if (row[candidate] !== undefined && row[candidate] !== "") return stripFormulaGuard(row[candidate]);
        }
        return "";
      };

      const suppliersCollection = collection(db, "users", ownerUid, "suppliers");
      const pending = [];
      for (const row of rows) {
        const name = String(getField(row, "name") || "").trim();
        const contactName = String(getField(row, "contactName") || "").trim();
        if (!name && !contactName) continue;

        const supplierData = {
          name,
          contactName,
          category: String(getField(row, "category") || "").trim(),
          tags: parseTagsCell(getField(row, "tags")),
          phone: String(getField(row, "phone") || "").trim(),
          email: String(getField(row, "email") || "").trim(),
          notes: String(getField(row, "notes") || "").trim(),
          isPinned: false,
          createdAt: serverTimestamp(),
        };

        pending.push({ ref: doc(suppliersCollection), supplierData });
      }

      // Same duplicate-phone skip as the customer import above.
      const { kept, skipped } = splitImportDuplicates(pending, suppliers, (p) => p.supplierData.phone);
      pending.length = 0;
      pending.push(...kept);

      setSupplierImportProgress({ done: 0, total: pending.length });

      for (let i = 0; i < pending.length; i += IMPORT_BATCH_SIZE) {
        const chunk = pending.slice(i, i + IMPORT_BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(({ ref, supplierData }) => {
          batch.set(ref, supplierData);
          queueAudit(batch, ownerUid, {
            entityType: "supplier", entityId: ref.id, entityName: supplierData.name,
            action: "create", user, t,
          });
        });
        await batch.commit();
        count += chunk.length;
        setSupplierImportProgress({ done: count, total: pending.length });
      }
      showAlert(t.importSuppliersSuccess(count) + (skipped ? t.importSkipped(skipped) : ""));
    } catch (err) {
      console.error("Excel supplier import failed:", err);
      reportException(err, { context: "Excel supplier import failed", ownerUid, partiallyImported: count });
      showAlert(count > 0 ? t.importSuppliersPartialError(count) : t.importSuppliersError);
    } finally {
      setImportingSuppliers(false);
      setSupplierImportProgress(null);
    }
  };

  return {
    fileInputRef, supplierFileInputRef, importing, importingSuppliers,
    importProgress, supplierImportProgress,
    triggerImportPicker, handleImportFile, triggerSupplierImportPicker, handleImportSupplierFile,
  };
}
