// ============================================================================
// Suppliers screens (list + form), extracted from App.jsx.
//
// These are presentational: all Firestore calls, validation, and state
// (supplierForm, activeSupplierId, filters, etc.) still live in App.jsx and
// are passed in as props/handlers. This keeps the extraction low-risk — no
// data logic moved, only the JSX that renders it — while cutting a sizeable,
// self-contained chunk out of the single giant App.jsx file.
// ============================================================================

import React, { useState } from "react";
import {
  Search, SlidersHorizontal, Truck, Star, Mail, Phone, MessageCircle, Plus, Trash2,
  Building2, User, Package, Tag, StickyNote, Bell, AlertTriangle, Check, RotateCcw,
} from "lucide-react";
import { TagChip, SkeletonList } from "./Shared";
import { FormSection, IconField } from "./CustomerForm";
import SupplierFilterSheet from "./SupplierFilterSheet";
import PendingEditsSheet from "./PendingEditsSheet";
import {
  PRIMARY, PRIMARY_MID, TEXT, MUTED, DANGER, SUCCESS, GOLD, GOLD_SOFT, LINE, SURFACE,
  parseTagsCell,
} from "../constants";
import { db } from "../firebase";
import { doc, updateDoc, deleteDoc, deleteField } from "firebase/firestore";

export function SuppliersListScreen({
  t,
  canEdit,
  supplierQuery,
  setSupplierQuery,
  totalSuppliers,
  allSupplierTags,
  supplierTagFilter,
  setSupplierTagFilter,
  allSupplierCategories,
  supplierCategoryFilter,
  setSupplierCategoryFilter,
  suppliersLoaded,
  filteredSuppliers,
  togglePinSupplier,
  openEditSupplier,
  openNewSupplier,
  isOwnerAccount,
  pendingEdits = [],
  openPendingEditItem,
}) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [pendingEditsOpen, setPendingEditsOpen] = useState(false);
  const searchActive = searchFocused || supplierQuery.length > 0;

  const activeFilterCount =
    (supplierCategoryFilter !== "all" ? 1 : 0) +
    (supplierTagFilter !== "all" ? 1 : 0);

  return (
    <div className="px-4 pt-4 pb-24">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            color={MUTED}
            style={{ position: "absolute", [t.dir === "rtl" ? "right" : "left"]: 12, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            value={supplierQuery}
            onChange={(e) => setSupplierQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={t.searchSuppliersPlaceholder}
            style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 34, borderRadius: 14 }}
          />
        </div>
        <button
          onClick={() => setFilterSheetOpen(true)}
          className="btn-press flex items-center justify-center gap-1 font-bold text-xs flex-shrink-0"
          style={{
            position: "relative",
            border: `1.4px solid ${activeFilterCount > 0 ? PRIMARY : LINE}`,
            background: activeFilterCount > 0 ? PRIMARY : SURFACE,
            color: activeFilterCount > 0 ? "#fff" : MUTED,
            borderRadius: 14,
            height: 44,
            overflow: "hidden",
            transition: "max-width 0.2s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease",
            maxWidth: searchActive ? 0 : 120,
            padding: searchActive ? "0" : "0 14px",
            opacity: searchActive ? 0 : 1,
            pointerEvents: searchActive ? "none" : "auto",
          }}
        >
          <SlidersHorizontal size={15} />
          {t.filtersBtn}
          {activeFilterCount > 0 && (
            <span
              className="text-xs font-extrabold flex items-center justify-center"
              style={{
                background: GOLD, color: "#fff", borderRadius: 999,
                minWidth: 16, height: 16, padding: "0 4px",
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        {isOwnerAccount && (
          <button
            onClick={() => setPendingEditsOpen(true)}
            className="btn-press flex items-center justify-center gap-1 font-bold text-xs flex-shrink-0"
            style={{
              position: "relative",
              border: `1.4px solid ${pendingEdits.length > 0 ? GOLD : LINE}`,
              background: pendingEdits.length > 0 ? GOLD : SURFACE,
              color: pendingEdits.length > 0 ? "#fff" : MUTED,
              borderRadius: 14,
              height: 44,
              overflow: "hidden",
              transition: "max-width 0.2s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease",
              maxWidth: searchActive ? 0 : 120,
              padding: searchActive ? "0" : "0 14px",
              opacity: searchActive ? 0 : 1,
              pointerEvents: searchActive ? "none" : "auto",
            }}
          >
            <Bell size={15} />
            {t.pendingEditsBtn}
            {pendingEdits.length > 0 && (
              <span
                className="text-xs font-extrabold flex items-center justify-center"
                style={{
                  background: "#fff", color: GOLD, borderRadius: 999,
                  minWidth: 16, height: 16, padding: "0 4px",
                }}
              >
                {pendingEdits.length}
              </span>
            )}
          </button>
        )}
      </div>

      <PendingEditsSheet
        t={t}
        open={pendingEditsOpen}
        onClose={() => setPendingEditsOpen(false)}
        pendingEdits={pendingEdits}
        onOpenItem={openPendingEditItem}
      />

      <SupplierFilterSheet
        t={t}
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        totalSuppliers={totalSuppliers}
        allSupplierCategories={allSupplierCategories}
        supplierCategoryFilter={supplierCategoryFilter}
        setSupplierCategoryFilter={setSupplierCategoryFilter}
        allSupplierTags={allSupplierTags}
        supplierTagFilter={supplierTagFilter}
        setSupplierTagFilter={setSupplierTagFilter}
      />

      {!suppliersLoaded && <SkeletonList count={4} />}

      {suppliersLoaded && filteredSuppliers.length === 0 && (
        <div className="text-center py-16">
          <Truck size={40} color="#C7C4B6" className="mx-auto mb-2" />
          <p className="font-bold" style={{ color: TEXT }}>{t.noSuppliers}</p>
          <p className="text-sm mt-1" style={{ color: MUTED }}>{t.noSuppliersHint}</p>
        </div>
      )}

      {filteredSuppliers.map((s) => (
        <div
          key={s.id}
          style={{
            position: "relative",
            background: SURFACE,
            border: `1px solid ${LINE}`,
            borderRadius: 16,
            marginBottom: 12,
          }}
        >
          {canEdit && (
            <button
              onClick={() => togglePinSupplier(s)}
              className="btn-press flex items-center justify-center"
              style={{
                position: "absolute",
                top: 10,
                [t.dir === "rtl" ? "left" : "right"]: 10,
                width: 28,
                height: 28,
                zIndex: 2,
                color: s.isPinned ? GOLD : "#C7C4B6",
              }}
              aria-label={s.isPinned ? t.unpinBtn : t.pinBtn}
            >
              <Star size={17} fill={s.isPinned ? GOLD : "none"} />
            </button>
          )}
          <button
            onClick={() => openEditSupplier(s)}
            className={`btn-press w-full ${t.dir === "rtl" ? "text-right" : "text-left"}`}
            style={{ display: "block", padding: 14 }}
          >
            <div className="flex items-start justify-between gap-2">
              <div style={{ [t.dir === "rtl" ? "paddingLeft" : "paddingRight"]: 32 }}>
                <p className="font-extrabold text-base" style={{ margin: 0, color: TEXT }}>
                  {s.name || t.noSupplierName}
                </p>
                {s.contactName && (
                  <p className="text-sm" style={{ margin: "2px 0 0", color: MUTED }}>{s.contactName}</p>
                )}
              </div>
              {s.category && (
                <span
                  className="text-xs font-bold flex-shrink-0"
                  style={{ background: GOLD_SOFT, color: "#7A5420", borderRadius: 999, padding: "3px 9px" }}
                >
                  {s.category}
                </span>
              )}
            </div>
            {s.notes && (
              <p className="text-sm mt-1" style={{ color: MUTED, margin: "4px 0 0" }}>{s.notes}</p>
            )}
            {(s.tags || []).length > 0 && (
              <div className="flex items-center flex-wrap gap-1 mt-2">
                {s.tags.map((tag) => (
                  <TagChip key={tag} label={tag} />
                ))}
              </div>
            )}
            <div
              className="flex items-center justify-between"
              style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${LINE}` }}
            >
              <div>
                <p className="text-sm" style={{ margin: 0, color: MUTED }}>{s.phone || "—"}</p>
                {s.email && (
                  <p className="text-xs" style={{ margin: "2px 0 0", color: MUTED }}>{s.email}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {s.email && (
                  <a
                    href={`mailto:${s.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="btn-press flex items-center justify-center"
                    style={{ width: 32, height: 32, borderRadius: 10, background: "#E7EEF8", color: PRIMARY_MID }}
                    aria-label={t.emailRow}
                  >
                    <Mail size={14} />
                  </a>
                )}
                {s.phone && (
                  <a
                    href={`tel:${s.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="btn-press flex items-center justify-center"
                    style={{ width: 32, height: 32, borderRadius: 10, background: "#E5F1EA", color: "#2F9E58" }}
                    aria-label={t.phoneRow}
                  >
                    <Phone size={14} />
                  </a>
                )}
                {s.phone && (
                  <a
                    href={`https://wa.me/${s.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="btn-press flex items-center justify-center"
                    style={{ width: 32, height: 32, borderRadius: 10, background: "#E4F5EA", color: "#25A245" }}
                    aria-label={t.whatsapp}
                  >
                    <MessageCircle size={14} />
                  </a>
                )}
              </div>
            </div>
          </button>
        </div>
      ))}

      {canEdit && (
        <button
          onClick={openNewSupplier}
          className="btn-press flex items-center justify-center"
          style={{
            position: "fixed",
            bottom: 84,
            left: 20,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: GOLD,
            color: "#fff",
            border: "none",
            boxShadow: "0 10px 20px rgba(192,138,62,.4)",
            zIndex: 20,
          }}
          aria-label={t.newSupplierBtn}
        >
          <Plus size={26} />
        </button>
      )}
    </div>
  );
}

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
  isOwnerAccount,
  setScreen,
}) {
  const [loadingAction, setLoadingAction] = useState(false);

  const isPendingDelete = supplierForm.last_change?.type === "delete";

  // نفس مسار مستند المورد المستخدم في باقي التطبيق: users/{ownerUid}/suppliers/{id}.
  const getDocRef = () => {
    if (!ownerUid || !activeSupplierId) return null;
    return doc(db, "users", ownerUid, "suppliers", activeSupplierId);
  };

  // 1. اعتماد التعديل (حذف تنبيه التعديل وتنظيف المساحة)
  const handleApprove = async () => {
    if (!isOwnerAccount || !activeSupplierId) return;
    const docRef = getDocRef();
    if (!docRef) {
      alert("تعذّر تحديد مساحة العمل الحالية.");
      return;
    }
    setLoadingAction(true);
    try {
      await updateDoc(docRef, { last_change: deleteField() });
      alert("تم اعتماد البيانات وتنظيف المساحة بنجاح.");
    } catch (err) {
      console.error("خطأ أثناء الاعتماد:", err);
      alert("حدث خطأ أثناء الاعتماد: " + err.message);
    } finally {
      setLoadingAction(false);
      setScreen && setScreen("suppliers");
    }
  };

  // 2. التراجع عن التعديل (إعادة القيم القديمة وحذف التنبيه)
  const handleRollback = async () => {
    if (!isOwnerAccount || !activeSupplierId || !supplierForm.last_change) return;
    const docRef = getDocRef();
    if (!docRef) {
      alert("تعذّر تحديد مساحة العمل الحالية.");
      return;
    }
    setLoadingAction(true);
    try {
      const rawChanges = supplierForm.last_change.changes || supplierForm.last_change.details || supplierForm.last_change;
      const rollbackPayload = {};

      if (typeof rawChanges === "object" && rawChanges !== null) {
        Object.entries(rawChanges).forEach(([field, val]) => {
          const ignoreKeys = ["changed_by", "updatedBy", "updatedById", "updated_at", "updatedAt", "changes", "details"];
          if (!ignoreKeys.includes(field)) {
            if (val && typeof val === "object" && "old_value" in val) {
              rollbackPayload[field] = val.old_value;
            } else if (typeof val !== "object") {
              rollbackPayload[field] = val;
            }
          }
        });
      }

      rollbackPayload.last_change = deleteField();

      await updateDoc(docRef, rollbackPayload);
      alert("تم التراجع عن التعديلات وإعادة البيانات بنجاح.");
    } catch (err) {
      console.error("خطأ أثناء التراجع:", err);
      alert("حدث خطأ أثناء التراجع: " + err.message);
    } finally {
      setLoadingAction(false);
      setScreen && setScreen("suppliers");
    }
  };

  // 3. اعتماد الحذف نهائيًا — بيمسح المستند فعليًا من Firestore
  const handleConfirmDelete = async () => {
    if (!isOwnerAccount || !activeSupplierId) return;
    const docRef = getDocRef();
    if (!docRef) {
      alert("تعذّر تحديد مساحة العمل الحالية.");
      return;
    }
    setLoadingAction(true);
    try {
      await deleteDoc(docRef);
      alert(t.deleteApprovedMsgSupplier);
    } catch (err) {
      console.error("خطأ أثناء اعتماد الحذف:", err);
      alert("حدث خطأ أثناء اعتماد الحذف: " + err.message);
    } finally {
      setLoadingAction(false);
      setScreen && setScreen("suppliers");
    }
  };

  // 4. استرجاع المورد — بيلغي علامة الحذف وينظّف last_change
  const handleRestoreDeleted = async () => {
    if (!isOwnerAccount || !activeSupplierId) return;
    const docRef = getDocRef();
    if (!docRef) {
      alert("تعذّر تحديد مساحة العمل الحالية.");
      return;
    }
    setLoadingAction(true);
    try {
      await updateDoc(docRef, { deleted: deleteField(), last_change: deleteField() });
      alert(t.deleteRestoredMsgSupplier);
    } catch (err) {
      console.error("خطأ أثناء استرجاع المورد:", err);
      alert("حدث خطأ أثناء استرجاع المورد: " + err.message);
    } finally {
      setLoadingAction(false);
      setScreen && setScreen("suppliers");
    }
  };

  const fieldLabels = {
    name: "اسم المورد",
    contactName: "الشخص المسؤول",
    phone: "رقم الهاتف",
    email: "البريد الإلكتروني",
    category: "نوع الخدمة/المنتج",
    notes: "الملاحظات",
  };

  return (
    <div className="px-4 pt-4 pb-10 flex flex-col gap-4">

      {/* ----------------- صندوق تنبيه طلب حذف مورد ----------------- */}
      {isOwnerAccount && activeSupplierId && isPendingDelete && (
        <div
          className="shadow-sm"
          style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 16, padding: 14 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-xs flex items-center gap-1" style={{ color: "#991B1B" }}>
              <Trash2 size={15} color={DANGER} /> {t.deletePendingTitleSupplier}
            </span>
            <span className="text-xs" style={{ color: MUTED }}>
              {supplierForm.last_change.updatedAt
                ? new Date(supplierForm.last_change.updatedAt).toLocaleString("ar-EG")
                : ""}
            </span>
          </div>

          <div className="text-xs mb-3" style={{ color: TEXT }}>
            {t.deletePendingBySupplier(supplierForm.last_change.updatedBy || "غير معروف")}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConfirmDelete}
              disabled={loadingAction}
              className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
              style={{ background: DANGER, color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loadingAction ? 0.6 : 1 }}
            >
              <Trash2 size={14} /> {t.confirmDeleteFinalBtn}
            </button>
            <button
              onClick={handleRestoreDeleted}
              disabled={loadingAction}
              className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
              style={{ background: SUCCESS, color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loadingAction ? 0.6 : 1 }}
            >
              <RotateCcw size={14} /> {t.restoreSupplierBtn}
            </button>
          </div>
        </div>
      )}

      {/* ----------------- صندوق تنبيه تعديل بيانات مورد ----------------- */}
      {isOwnerAccount && activeSupplierId && supplierForm.last_change && !isPendingDelete && (
        <div
          className="shadow-sm"
          style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 16, padding: 14 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-xs flex items-center gap-1" style={{ color: "#92400E" }}>
              <AlertTriangle size={15} color="#D97706" /> تنبيه تعديل بيانات مورد (خاص بك)
            </span>
            <span className="text-xs" style={{ color: MUTED }}>
              {supplierForm.last_change.updatedAt
                ? new Date(supplierForm.last_change.updatedAt).toLocaleString("ar-EG")
                : ""}
            </span>
          </div>

          <div className="text-xs mb-2" style={{ color: TEXT }}>
            قام المستخدم{" "}
            <span className="font-bold">{supplierForm.last_change.updatedBy || "غير معروف"}</span>{" "}
            بتعديل البيانات التالية:
          </div>

          <div
            className="flex flex-col gap-1.5 text-xs mb-3"
            style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 10, padding: 10 }}
          >
            {(() => {
              const ignoreKeys = ["changed_by", "updatedBy", "updatedById", "updated_at", "updatedAt", "changes", "details", "last_change"];
              const rawChanges = supplierForm.last_change.changes || supplierForm.last_change.details || supplierForm.last_change;

              if (!rawChanges || typeof rawChanges !== "object") {
                return <div style={{ color: MUTED }}>تعديلات عامة على السجل</div>;
              }

              const entries = Object.entries(rawChanges).filter(([k]) => !ignoreKeys.includes(k));

              if (entries.length === 0) {
                return <div style={{ color: MUTED }}>تم إجراء تعديل على بيانات السجل (بدون تفاصيل قيم قديمة)</div>;
              }

              return entries.map(([field, val]) => {
                const arabicLabel = fieldLabels[field] || field;
                const oldValue = typeof val === "object" && val !== null ? val.old_value : undefined;
                const newValue = typeof val === "object" && val !== null ? val.new_value : val;

                return (
                  <div key={field} className="flex items-center gap-2 border-b border-gray-100 last:border-0 pb-1">
                    <span className="font-semibold min-w-[90px]" style={{ color: MUTED }}>{arabicLabel}:</span>
                    {oldValue !== undefined && (
                      <>
                        <span className="line-through font-bold px-1.5 py-0.5 rounded" style={{ background: "#FEE2E2", color: DANGER }}>
                          {String(oldValue || "—")}
                        </span>
                        <span>←</span>
                      </>
                    )}
                    <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: "#D1FAE5", color: "#047857" }}>
                      {String(newValue !== undefined && newValue !== null ? newValue : "—")}
                    </span>
                  </div>
                );
              });
            })()}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={loadingAction}
              className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
              style={{ background: SUCCESS, color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loadingAction ? 0.6 : 1 }}
            >
              <Check size={14} /> اعتماد (تنظيف المساحة)
            </button>
            <button
              onClick={handleRollback}
              disabled={loadingAction}
              className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
              style={{ background: DANGER, color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loadingAction ? 0.6 : 1 }}
            >
              <RotateCcw size={14} /> تراجع عن التعديل
            </button>
          </div>
        </div>
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
