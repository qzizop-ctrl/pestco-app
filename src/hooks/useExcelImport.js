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
// ---------------------------------------------------------------------------
// Helpers shared by the customer and supplier imports. They used to be
// copy-pasted inside both handlers (getField was byte-for-byte identical),
// which also made each handler far longer than it needed to be.
// ---------------------------------------------------------------------------

// Both languages' header labels (with and without the " *" required marker)
// are accepted, so a sheet exported from either UI language re-imports.
const bothLangs = (key) => [STRINGS.ar[key], STRINGS.en[key]];
const bothLangsOptional = (key) => [
  STRINGS.ar[key], STRINGS.en[key],
  STRINGS.ar[key].replace(" *", ""), STRINGS.en[key].replace(" *", ""),
];

function visitHeaderMap() {
  return {
    companyName: bothLangsOptional("companyLabel"),
    contactName: bothLangsOptional("contactLabel"),
    sector: bothLangs("sectorLabel"),
    role: bothLangs("roleLabel"),
    stage: bothLangs("pipelineLabel"),
    tags: bothLangs("tagsLabel"),
    phone: bothLangs("phoneLabel"),
    email: bothLangs("emailLabel"),
    visitDate: bothLangs("visitDateLabel"),
    callDateTime: bothLangs("callDateLabel"),
    notes: bothLangs("notesLabel"),
  };
}

function supplierHeaderMap() {
  return {
    name: bothLangsOptional("supplierNameLabel"),
    contactName: bothLangs("supplierContactLabel"),
    category: bothLangs("supplierCategoryLabel"),
    tags: bothLangs("supplierTagsLabel"),
    phone: bothLangs("phoneLabel"),
    email: bothLangs("emailLabel"),
    notes: bothLangs("supplierNotesLabel"),
  };
}

// First non-empty cell among a field's accepted header names, with any
// formula-injection guard stripped.
function makeFieldReader(headerMap) {
  return (row, key) => {
    const header = headerMap[key].find((candidate) => row[candidate] !== undefined && row[candidate] !== "");
    return header === undefined ? "" : stripFormulaGuard(row[header]);
  };
}

const cellText = (getField, row, key) => String(getField(row, key) || "").trim();

async function readFirstSheetRows(file) {
  const XLSX = await import("xlsx");
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

// Builds the full list of valid rows up front so the total is known for
// progress reporting, and so an empty row never counts toward it.
function buildPendingVisits(rows, getField, visitsCollection, t) {
  const pending = [];
  for (const row of rows) {
    const companyName = cellText(getField, row, "companyName");
    const contactName = cellText(getField, row, "contactName");
    if (!companyName && !contactName) continue;

    const callDateTime = normalizeExcelDateTime(getField(row, "callDateTime"));
    const visitData = {
      companyName,
      contactName,
      sector: findSectorId(getField(row, "sector")),
      role: findRoleId(getField(row, "role")),
      stage: findStageId(getField(row, "stage")),
      tags: parseTagsCell(getField(row, "tags")),
      phone: cellText(getField, row, "phone"),
      email: cellText(getField, row, "email"),
      visitDate: normalizeExcelDate(getField(row, "visitDate")),
      notes: cellText(getField, row, "notes"),
      callDateTime,
      notified: false,
      activityLog: [buildActivity("created", t.activityCreated)],
      offers: [],
      createdAt: serverTimestamp(),
    };
    pending.push({ ref: doc(visitsCollection), visitData, companyName, contactName, callDateTime });
  }
  return pending;
}

function buildPendingSuppliers(rows, getField, suppliersCollection) {
  const pending = [];
  for (const row of rows) {
    const name = cellText(getField, row, "name");
    const contactName = cellText(getField, row, "contactName");
    if (!name && !contactName) continue;

    const supplierData = {
      name,
      contactName,
      category: cellText(getField, row, "category"),
      tags: parseTagsCell(getField(row, "tags")),
      phone: cellText(getField, row, "phone"),
      email: cellText(getField, row, "email"),
      notes: cellText(getField, row, "notes"),
      isPinned: false,
      createdAt: serverTimestamp(),
    };
    pending.push({ ref: doc(suppliersCollection), supplierData });
  }
  return pending;
}

// Writes `items` in chunks of IMPORT_BATCH_SIZE, one chunk at a time.
//
// The chunks are deliberately committed one after another, not with
// Promise.all: the caller reports how many rows are already saved if a later
// chunk fails ("N rows were imported before the error"), and that number is
// only meaningful if chunks commit strictly in order. It also keeps us to one
// in-flight Firestore batch instead of hundreds.
async function commitInChunks(items, writeChunk, onChunkCommitted) {
  for (let i = 0; i < items.length; i += IMPORT_BATCH_SIZE) {
    const chunk = items.slice(i, i + IMPORT_BATCH_SIZE);
    await writeChunk(chunk); // NOSONAR — sequential on purpose, see above
    onChunkCommitted(chunk.length);
  }
}

export function useExcelImport({ ownerUid, user, visits, suppliers, canEdit, requireOnline, t, showAlert, appendActivity: _appendActivity }) {
  const fileInputRef = useRef(null);
  const supplierFileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importingSuppliers, setImportingSuppliers] = useState(false);
  // null while idle; {done, total} while a batch import is running, so the
  // UI can show "Importing... (120/450)" instead of a static label.
  const [importProgress, setImportProgress] = useState(null);
  const [supplierImportProgress, setSupplierImportProgress] = useState(null);

  const openPicker = (inputRef) => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (inputRef.current) inputRef.current.click();
  };
  const triggerImportPicker = () => openPicker(fileInputRef);
  const triggerSupplierImportPicker = () => openPicker(supplierFileInputRef);

  // Shared pre-flight for both import handlers. Order matters: requireOnline()
  // may show an alert, so it only runs for people who can edit.
  const canStartImport = (file) => {
    if (!canEdit) return false;
    if (!requireOnline()) return false;
    return Boolean(file && user && ownerUid);
  };

  // One chunk of customers: the batch (record + audit entry), then the call
  // reminders for the rows that have one. Reminders are independent of each
  // other (and scheduleCallReminder never throws), so they run together.
  const writeVisitChunk = async (chunk) => {
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

    await Promise.all(
      chunk
        .filter(({ callDateTime }) => callDateTime)
        .map(({ ref, companyName, contactName, callDateTime }) =>
          scheduleCallReminder(
            ref.id,
            callDateTime,
            `${t.reminderTitle} ${companyName}`,
            t.reminderBody(contactName)
          )
        )
    );
  };

  const writeSupplierChunk = async (chunk) => {
    const batch = writeBatch(db);
    chunk.forEach(({ ref, supplierData }) => {
      batch.set(ref, supplierData);
      queueAudit(batch, ownerUid, {
        entityType: "supplier", entityId: ref.id, entityName: supplierData.name,
        action: "create", user, t,
      });
    });
    await batch.commit();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!canStartImport(file)) return;

    setImporting(true);
    // Declared outside the try so a batch failure partway through (see the
    // catch block below) can still report how many rows were committed
    // before it, instead of just "something went wrong" with no way to
    // tell whether 0 rows or 450 rows actually landed in Firestore.
    let count = 0;
    try {
      const rows = await readFirstSheetRows(file);
      if (rows.length > MAX_IMPORT_ROWS) {
        showAlert(t.importTooLarge(MAX_IMPORT_ROWS));
        return;
      }

      const getField = makeFieldReader(visitHeaderMap());
      const visitsCollection = collection(db, "users", ownerUid, "visits");
      const parsed = buildPendingVisits(rows, getField, visitsCollection, t);

      // Skip rows whose phone already belongs to an existing customer (or to
      // an earlier row of this same file). Without this, importing the same
      // sheet twice silently doubled every customer — and it makes it safe to
      // re-run an import that stopped half way: rows already saved are skipped.
      const { kept: pending, skipped } = splitImportDuplicates(parsed, visits, (p) => p.visitData.phone);

      setImportProgress({ done: 0, total: pending.length });
      await commitInChunks(pending, writeVisitChunk, (n) => {
        count += n;
        setImportProgress({ done: count, total: pending.length });
      });
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

  const handleImportSupplierFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!canStartImport(file)) return;

    setImportingSuppliers(true);
    let count = 0;
    try {
      const rows = await readFirstSheetRows(file);
      if (rows.length > MAX_IMPORT_ROWS) {
        showAlert(t.importSuppliersTooLarge(MAX_IMPORT_ROWS));
        return;
      }

      const getField = makeFieldReader(supplierHeaderMap());
      const suppliersCollection = collection(db, "users", ownerUid, "suppliers");
      const parsed = buildPendingSuppliers(rows, getField, suppliersCollection);

      // Same duplicate-phone skip as the customer import above.
      const { kept: pending, skipped } = splitImportDuplicates(parsed, suppliers, (p) => p.supplierData.phone);

      setSupplierImportProgress({ done: 0, total: pending.length });
      await commitInChunks(pending, writeSupplierChunk, (n) => {
        count += n;
        setSupplierImportProgress({ done: count, total: pending.length });
      });
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
