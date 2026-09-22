// ============================================================================
// Supplier form screen, split out of what used to be one Suppliers.jsx
// (list + form combined). Presentational only — all Firestore calls,
// validation, and state (supplierForm, activeSupplierId, etc.) still live
// in App.jsx and are passed in as props/handlers.
// ============================================================================
import {
  Mail, Phone, Trash2, Building2, User, Package, Tag, StickyNote,
} from "lucide-react";
import { TagChip } from "../Shared";
import { FormSection, IconField } from "../CustomerForm";
import PendingChangeBanner from "../PendingChangeBanner";
import { PRIMARY, DANGER, LINE, SURFACE } from "../../theme";
import { parseTagsCell } from "../../helpers";
import { db } from "../../firebase";
import { doc } from "firebase/firestore";
import { useLastChangeActions } from "../../hooks/useLastChangeActions";
import { logAudit } from "../../hooks/useAuditLog";

export function SupplierFormScreen({
  t,
  supplierForm,
  setSupplierForm,
  supplierErrors,
  removeTagFromSupplierForm,
  saveSupplierForm,
  activeSupplierId,
  deleteSupplier,
  saving,
  ownerUid,
  user,
  isOwnerAccount,
  setScreen,
}) {
  // نفس مسار مستند المورد المستخدم في باقي التطبيق: users/{ownerUid}/suppliers/{id}.
  const getDocRef = () => {
    if (!ownerUid || !activeSupplierId) return null;
    return doc(db, "users", ownerUid, "suppliers", activeSupplierId);
  };

  const {
    loadingAction, handleApprove, handleRollback, handleConfirmDelete, handleRestoreDeleted,
  } = useLastChangeActions({
    getDocRef,
    isOwnerAccount,
    lastChange: supplierForm.last_change,
    t,
    deleteSuccessMsg: t.deleteApprovedMsgSupplier,
    restoreSuccessMsg: t.deleteRestoredMsgSupplier,
    onFinally: () => setScreen && setScreen("suppliers"),
    onAudit: (action) => logAudit(ownerUid, {
      entityType: "supplier", entityId: activeSupplierId, entityName: supplierForm?.name,
      action, user, t,
    }),
  });

  return (
    <div className="px-4 pt-4 pb-10 flex flex-col gap-4">

      {/* صندوق تنبيه طلب حذف أو تعديل بيانات مورد — لصاحب الـworkspace فقط */}
      {isOwnerAccount && activeSupplierId && (
        <PendingChangeBanner
          t={t}
          kind="supplier"
          lastChange={supplierForm.last_change}
          loadingAction={loadingAction}
          onApprove={handleApprove}
          onRollback={handleRollback}
          onConfirmDelete={handleConfirmDelete}
          onRestore={handleRestoreDeleted}
        />
      )}

     <div
      className="flex flex-col gap-4"
      style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16 }}
     >
      <FormSection title={t.formSectionBasic} first>
        <div>
          <label>{t.supplierNameLabel}</label>
          <IconField icon={Building2}>
            <input
              className="field-bare"
              value={supplierForm.name}
              onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              placeholder={t.supplierNamePlaceholder}
            />
          </IconField>
          {supplierErrors.name && <p className="text-xs mt-1" style={{ color: DANGER }}>{supplierErrors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label>{t.supplierContactLabel}</label>
            <IconField icon={User}>
              <input
                className="field-bare"
                value={supplierForm.contactName}
                onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                placeholder={t.supplierContactPlaceholder}
              />
            </IconField>
          </div>

          <div>
            <label>{t.phoneLabel}</label>
            <IconField icon={Phone}>
              <input
                className="field-bare"
                type="tel"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                placeholder={t.phonePlaceholder}
              />
            </IconField>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label>{t.emailLabel}</label>
            <IconField icon={Mail}>
              <input
                className="field-bare"
                type="email"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                placeholder={t.emailPlaceholder}
              />
            </IconField>
          </div>

          <div>
            <label>{t.supplierCategoryLabel}</label>
            <IconField icon={Package}>
              <input
                className="field-bare"
                value={supplierForm.category}
                onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                placeholder={t.supplierCategoryPlaceholder}
              />
            </IconField>
          </div>
        </div>
      </FormSection>

      <FormSection title={t.formSectionClassification}>
        <div>
          <label>{t.supplierTagsLabel}</label>
          <IconField icon={Tag}>
            <input
              className="field-bare"
              value={supplierForm.tagsInput}
              onChange={(e) => setSupplierForm({ ...supplierForm, tagsInput: e.target.value })}
              placeholder={t.supplierTagsPlaceholder}
            />
          </IconField>
          {parseTagsCell(supplierForm.tagsInput).length > 0 && (
            <div className="flex items-center flex-wrap gap-1 mt-2">
              {parseTagsCell(supplierForm.tagsInput).map((tag) => (
                <TagChip key={tag} label={tag} onRemove={() => removeTagFromSupplierForm(tag)} />
              ))}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title={t.formSectionNotes}>
        <div>
          <label>{t.supplierNotesLabel}</label>
          <IconField icon={StickyNote} top>
            <textarea
              className="field-bare"
              rows={5}
              value={supplierForm.notes}
              onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
              placeholder={t.notesPlaceholder}
            />
          </IconField>
        </div>
      </FormSection>
     </div>

      <button
        onClick={saveSupplierForm}
        disabled={saving}
        className="btn-press font-bold"
        style={{ background: PRIMARY, color: "#fff", borderRadius: 14, padding: "12px 0", opacity: saving ? 0.7 : 1 }}
      >
        {saving ? t.saving : t.saveSupplier}
      </button>

      {activeSupplierId && (
        <button
          onClick={() => deleteSupplier(activeSupplierId)}
          className="btn-press flex items-center justify-center gap-2 font-bold"
          style={{ background: SURFACE, border: `1px solid ${DANGER}`, color: DANGER, borderRadius: 14, padding: "12px 0" }}
        >
          <Trash2 size={16} /> {t.delete}
        </button>
      )}
    </div>
  );
}
