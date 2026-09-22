import { useState, useRef } from "react";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { scheduleCallReminder } from "../notifications";
import { STRINGS } from "../i18n";
import { MAX_IMPORT_ROWS, IMPORT_BATCH_SIZE } from "../domain";
import { parseTagsCell, findSectorId, findRoleId, findStageId, normalizeExcelDate, normalizeExcelDateTime, buildActivity } from "../helpers";

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
export function useExcelImport({ ownerUid, user, canEdit, requireOnline, t, showAlert, appendActivity: _appendActivity }) {
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
          if (row[candidate] !== undefined && row[candidate] !== "") return row[candidate];
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

      setImportProgress({ done: 0, total: pending.length });

      let count = 0;
      for (let i = 0; i < pending.length; i += IMPORT_BATCH_SIZE) {
        const chunk = pending.slice(i, i + IMPORT_BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(({ ref, visitData }) => batch.set(ref, visitData));
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
      showAlert(t.importSuccess(count));
    } catch {
      showAlert(t.importError);
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
          if (row[candidate] !== undefined && row[candidate] !== "") return row[candidate];
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

      setSupplierImportProgress({ done: 0, total: pending.length });

      let count = 0;
      for (let i = 0; i < pending.length; i += IMPORT_BATCH_SIZE) {
        const chunk = pending.slice(i, i + IMPORT_BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(({ ref, supplierData }) => batch.set(ref, supplierData));
        await batch.commit();
        count += chunk.length;
        setSupplierImportProgress({ done: count, total: pending.length });
      }
      showAlert(t.importSuppliersSuccess(count));
    } catch {
      showAlert(t.importSuppliersError);
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
