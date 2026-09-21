// ============================================================================
// Customer detail screen, extracted into sections under ./customer-detail/.
// All handlers/state still live in App.jsx and flow down as props — this
// file only wires up which section goes where inside the one info card,
// plus the pending-change banner, edit/delete actions, and the supplier
// picker sheet that sits outside it.
// ============================================================================
import { Pencil, Trash2, FileText } from "lucide-react";
import PendingChangeBanner from "./PendingChangeBanner";
import SupplierPickerSheet from "./SupplierPickerSheet";
import CustomerHeaderCard from "./customer-detail/CustomerHeaderCard";
import CustomerContactRows from "./customer-detail/CustomerContactRows";
import CustomerCallReminder from "./customer-detail/CustomerCallReminder";
import CustomerOffersSection from "./customer-detail/CustomerOffersSection";
import CustomerActivitySection from "./customer-detail/CustomerActivitySection";
import { PRIMARY_MID, MUTED, DANGER, LINE, SURFACE } from "../theme";
import { db } from "../firebase";
import { doc } from "firebase/firestore";
import { useLastChangeActions } from "../hooks/useLastChangeActions";
import { logAudit } from "../hooks/useAuditLog";

export default function CustomerDetailScreen({
  t,
  active,
  ownerUid,
  user,
  canEdit,
  isOwnerAccount,
  togglePin,
  activeStageIdx,
  changeStage,
  clearCallReminder,
  logVisitToday,
  activeOffersValueText,
  activeOffers,
  expandedOfferId,
  setExpandedOfferId,
  updateOfferStatus,
  deleteOffer,
  newOffer,
  setNewOffer,
  addOffer,
  suppliers,
  supplierPickerOpen,
  setSupplierPickerOpen,
  toggleOfferSupplier,
  activityLog,
  newActivityText,
  setNewActivityText,
  submitActivity,
  deleteActivity,
  openEdit,
  deleteVisit,
  setScreen,
}) {
  // مرجع مستند العميل الصحيح في Firestore — نفس المسار المستخدم في باقي
  // التطبيق (App.jsx وuseLiveData.js): users/{ownerUid}/visits/{id}.
  // العميل مخزّن في كولكشن اسمه "visits" مش "customers"، وownerUid بييجي
  // من الـ workspace الحالي مش من بيانات العميل نفسه.
  const getDocRef = () => {
    if (!ownerUid || !active?.id) return null;
    return doc(db, "users", ownerUid, "visits", active.id);
  };

  const {
    loadingAction, handleApprove, handleRollback, handleConfirmDelete, handleRestoreDeleted,
  } = useLastChangeActions({
    getDocRef,
    isOwnerAccount,
    lastChange: active?.last_change,
    t,
    deleteSuccessMsg: t.deleteApprovedMsg,
    restoreSuccessMsg: t.deleteRestoredMsg,
    onDeleteSuccess: () => setScreen && setScreen("list"),
    onAudit: (action) => logAudit(ownerUid, {
      entityType: "customer", entityId: active?.id, entityName: active?.companyName,
      action, user, t,
    }),
  });

  if (!active) return null;

  return (
    <div className="px-4 pt-4 pb-10">

      {/* صندوق تنبيه طلب حذف أو تعديل بيانات — لصاحب الـworkspace فقط */}
      {isOwnerAccount && (
        <PendingChangeBanner
          t={t}
          kind="customer"
          lastChange={active.last_change}
          loadingAction={loadingAction}
          onApprove={handleApprove}
          onRollback={handleRollback}
          onConfirmDelete={handleConfirmDelete}
          onRestore={handleRestoreDeleted}
        />
      )}

      {/* ----------------- باقي الواجهة والبيانات ----------------- */}
      <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16 }}>
        <CustomerHeaderCard
          t={t}
          active={active}
          canEdit={canEdit}
          togglePin={togglePin}
          activeStageIdx={activeStageIdx}
          changeStage={changeStage}
        />

        <CustomerContactRows t={t} active={active} canEdit={canEdit} logVisitToday={logVisitToday} />

        <CustomerCallReminder t={t} active={active} canEdit={canEdit} clearCallReminder={clearCallReminder} />

        {active.notes && (
          <div style={{ borderTop: `0.5px solid ${LINE}`, marginTop: 12, paddingTop: 12 }}>
            <span className="flex items-center gap-2 text-sm font-bold mb-1"><FileText size={15} /> {t.notesRow}</span>
            <p className="text-sm" style={{ color: MUTED, lineHeight: 1.7 }}>{active.notes}</p>
          </div>
        )}

        <CustomerOffersSection
          t={t}
          active={active}
          canEdit={canEdit}
          activeOffersValueText={activeOffersValueText}
          activeOffers={activeOffers}
          expandedOfferId={expandedOfferId}
          setExpandedOfferId={setExpandedOfferId}
          updateOfferStatus={updateOfferStatus}
          deleteOffer={deleteOffer}
          newOffer={newOffer}
          setNewOffer={setNewOffer}
          addOffer={addOffer}
          setSupplierPickerOpen={setSupplierPickerOpen}
        />

        <CustomerActivitySection
          t={t}
          canEdit={canEdit}
          newActivityText={newActivityText}
          setNewActivityText={setNewActivityText}
          submitActivity={submitActivity}
          activityLog={activityLog}
          deleteActivity={deleteActivity}
        />
      </div>

      {canEdit && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => openEdit(active)}
            className="btn-press flex-1 flex items-center justify-center gap-2 font-bold"
            style={{ background: SURFACE, border: `1px solid ${PRIMARY_MID}`, color: PRIMARY_MID, borderRadius: 14, padding: "12px 0" }}
          >
            <Pencil size={16} /> {t.edit}
          </button>
          <button
            onClick={() => deleteVisit(active.id)}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{ background: SURFACE, border: `1px solid ${DANGER}`, color: DANGER, borderRadius: 14, padding: "12px 20px" }}
          >
            <Trash2 size={16} /> {t.delete}
          </button>
        </div>
      )}

      <SupplierPickerSheet
        t={t}
        open={supplierPickerOpen}
        onClose={() => setSupplierPickerOpen(false)}
        suppliers={suppliers || []}
        selectedIds={newOffer.supplierIds || []}
        onToggle={toggleOfferSupplier}
      />
    </div>
  );
}
