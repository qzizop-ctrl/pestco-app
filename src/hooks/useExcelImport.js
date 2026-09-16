import { useState, useRef } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { scheduleCallReminder } from "../notifications";
import {
  STRINGS, parseTagsCell, findSectorId, findRoleId, findStageId,
  normalizeExcelDate, normalizeExcelDateTime, buildActivity,
} from "../constants";

// Excel *import* only — export lives in useExcelExport.js (the write side
// uses a very different shape, so keeping them apart avoids one bloated
// "excel stuff" file). Split out of App.jsx.
export function useExcelImport({ ownerUid, user, canEdit, requireOnline, t, showAlert, appendActivity }) {
  const fileInputRef = useRef(null);
  const supplierFileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importingSuppliers, setImportingSuppliers] = useState(false);

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

      let count = 0;
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
          activityLog: [],
          offers: [],
          createdAt: serverTimestamp(),
        };

        const ref = await addDoc(collection(db, "users", ownerUid, "visits"), visitData);
        await appendActivity(ref.id, buildActivity("created", t.activityCreated));
        if (callDateTime) {
          await scheduleCallReminder(
            ref.id,
            callDateTime,
            `${t.reminderTitle} ${companyName}`,
            t.reminderBody(contactName)
          );
        }
        count++;
      }
      showAlert(t.importSuccess(count));
    } catch (err) {
      showAlert(t.importError);
    } finally {
      setImporting(false);
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

      let count = 0;
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

        await addDoc(collection(db, "users", ownerUid, "suppliers"), supplierData);
        count++;
      }
      showAlert(t.importSuppliersSuccess(count));
    } catch (err) {
      showAlert(t.importSuppliersError);
    } finally {
      setImportingSuppliers(false);
    }
  };

  return {
    fileInputRef, supplierFileInputRef, importing, importingSuppliers,
    triggerImportPicker, handleImportFile, triggerSupplierImportPicker, handleImportSupplierFile,
  };
}
