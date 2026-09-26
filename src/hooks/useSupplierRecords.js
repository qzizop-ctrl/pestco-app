import { useState } from "react";
import { collection, doc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { emptySupplierForm } from "../domain";
import { parseTagsCell } from "../helpers";
import { logAudit } from "./useAuditLog";

// Suppliers CRUD (simple contact records — no visits/pipeline/offers).
// Split out of App.jsx; mirrors useCustomerRecords but for the much
// simpler supplier document shape.
export function useSupplierRecords({
  ownerUid, user, suppliers, canEdit, requireOnline, confirmAction, reportSaveError,
  t, setScreen, setIsSaving,
}) {
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [activeSupplierId, setActiveSupplierId] = useState(null);
  const [supplierErrors, setSupplierErrors] = useState({});
  const [pendingSupplierDelete, setPendingSupplierDelete] = useState(null); // { id, companyName, timeoutId }

  const openNewSupplier = () => {
    if (!canEdit) return;
    setSupplierForm(emptySupplierForm);
    setSupplierErrors({});
    setActiveSupplierId(null);
    setScreen("supplier-form");
  };

  // Loads the supplier's tags array back into the comma-separated text field
  // the form uses, the same way openEdit does for customer tags.
  const openEditSupplier = (supplier) => {
    if (!canEdit) return;
    setSupplierForm({
      ...emptySupplierForm,
      ...supplier,
      tagsInput: (supplier.tags || []).join(", "),
    });
    setSupplierErrors({});
    setActiveSupplierId(supplier.id);
    setScreen("supplier-form");
  };

  const validateSupplier = () => {
    const e = {};
    if (!supplierForm.name.trim()) e.name = t.supplierNameError;
    setSupplierErrors(e);
    return Object.keys(e).length === 0;
  };

  // Removes one tag from the supplier form's comma-separated tags text,
  // mirroring removeTagFromForm for customers.
  const removeTagFromSupplierForm = (tag) => {
    const remaining = (supplierForm.tagsInput || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== tag);
    setSupplierForm({ ...supplierForm, tagsInput: remaining.join(", ") });
  };

  const saveSupplierForm = async () => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!validateSupplier() || !user || !ownerUid) return;

    const { id, tagsInput, last_change, ...rest } = supplierForm;
    const data = { ...rest, tags: parseTagsCell(tagsInput) };
    const original = activeSupplierId ? suppliers.find((s) => s.id === activeSupplierId) : null;

    // Same audit-trail approach as saveForm for customers: diff the new data
    // against the record actually in Firestore (suppliers state) so
    // last_change.changes carries real old/new values, and flag the record
    // with last_change so it surfaces in the owner's pending-edits bell
    // (shared with customer edits) for review.
    const auditIgnoreKeys = ["tags", "createdAt", "updatedAt", "isPinned", "deleted"];
    const changes = {};
    if (original) {
      Object.keys(data).forEach((key) => {
        if (auditIgnoreKeys.includes(key)) return;
        const oldVal = original[key];
        const newVal = data[key];
        const oldCompare = oldVal ?? "";
        const newCompare = newVal ?? "";
        if (oldCompare !== newCompare) {
          changes[key] = { old_value: oldVal ?? "فارغ", new_value: newVal ?? "فارغ" };
        }
      });
    }

    const lastChangeData = {
      updatedBy: user?.displayName || user?.email || "موظف غير معروف",
      updatedById: user?.uid || null,
      updatedAt: new Date().toISOString(),
      ...(Object.keys(changes).length > 0 ? { changes } : {}),
    };

    setIsSaving(true);
    try {
      if (activeSupplierId) {
        await updateDoc(doc(db, "users", ownerUid, "suppliers", activeSupplierId), {
          ...data,
          last_change: lastChangeData,
        });
        logAudit(ownerUid, {
          entityType: "supplier", entityId: activeSupplierId, entityName: data.name,
          action: "update", changes, user, t,
        });
      } else {
        const ref = await addDoc(collection(db, "users", ownerUid, "suppliers"), {
          ...data,
          last_change: lastChangeData,
          createdAt: serverTimestamp(),
        });
        logAudit(ownerUid, {
          entityType: "supplier", entityId: ref.id, entityName: data.name,
          action: "create", user, t,
        });
      }
      setScreen("suppliers");
    } catch (e) {
      reportSaveError(e);
    } finally {
      setIsSaving(false);
    }
  };

  // Soft delete: same pattern as proceedDeleteVisit for customers — hide it
  // immediately (self-undo window), then flag it with deleted + a
  // last_change of type "delete" instead of actually removing the document.
  // That's what lets it show up in the owner's pending-edits bell/sheet and
  // be approved (final delete) or rolled back (restored) from
  // SupplierFormScreen, mirroring the customer review flow.
  const proceedDeleteSupplier = async (id) => {
    const supplier = suppliers.find((s) => s.id === id);
    setScreen("suppliers");

    const timeoutId = setTimeout(async () => {
      try {
        await updateDoc(doc(db, "users", ownerUid, "suppliers", id), {
          deleted: true,
          last_change: {
            type: "delete",
            updatedBy: user?.displayName || user?.email || "موظف غير معروف",
            updatedById: user?.uid || null,
            updatedAt: new Date().toISOString(),
          },
        });
        logAudit(ownerUid, {
          entityType: "supplier", entityId: id, entityName: supplier ? supplier.name : "",
          action: "delete", user, t,
        });
      } catch (e) {
        reportSaveError(e);
      }
      setPendingSupplierDelete((cur) => (cur && cur.id === id ? null : cur));
    }, 5000);

    setPendingSupplierDelete({ id, companyName: supplier ? supplier.name : "", timeoutId });
  };

  const deleteSupplier = (id) => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!user || !ownerUid) return;
    confirmAction(t.deleteSupplierConfirm, () => {
      proceedDeleteSupplier(id);
    }, { danger: true });
  };

  const undoSupplierDelete = () => {
    if (!pendingSupplierDelete) return;
    clearTimeout(pendingSupplierDelete.timeoutId);
    setPendingSupplierDelete(null);
  };

  const togglePinSupplier = async (supplier) => {
    if (!canEdit || !ownerUid) return;
    if (!requireOnline()) return;
    try {
      await updateDoc(doc(db, "users", ownerUid, "suppliers", supplier.id), { isPinned: !supplier.isPinned });
    } catch (e) {
      reportSaveError(e);
    }
  };

  return {
    supplierForm, setSupplierForm, activeSupplierId, supplierErrors, pendingSupplierDelete,
    openNewSupplier, openEditSupplier, removeTagFromSupplierForm, saveSupplierForm,
    deleteSupplier, undoSupplierDelete, togglePinSupplier,
  };
}
