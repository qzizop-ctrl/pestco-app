// ============================================================================
// Suppliers screens (list + form), extracted from App.jsx.
//
// These are presentational: all Firestore calls, validation, and state
// (supplierForm, activeSupplierId, filters, etc.) still live in App.jsx and
// are passed in as props/handlers. This keeps the extraction low-risk — no
// data logic moved, only the JSX that renders it — while cutting a sizeable,
// self-contained chunk out of the single giant App.jsx file.
// ============================================================================

import React from "react";
import { Search, Tag, Truck, Star, Mail, Phone, MessageCircle, Plus, Trash2 } from "lucide-react";
import { TagChip, SkeletonList } from "./Shared";
import { FormSection } from "./CustomerForm";
import {
  PRIMARY, PRIMARY_MID, TEXT, MUTED, DANGER, GOLD, GOLD_SOFT, LINE, SURFACE,
  parseTagsCell,
} from "../constants";

export function SuppliersListScreen({
  t,
  canEdit,
  supplierQuery,
  setSupplierQuery,
  allSupplierTags,
  supplierTagFilter,
  setSupplierTagFilter,
  suppliersLoaded,
  filteredSuppliers,
  togglePinSupplier,
  openEditSupplier,
  openNewSupplier,
}) {
  return (
    <div className="px-4 pt-4 pb-24">
      <div className="relative mb-4">
        <Search
          size={16}
          color={MUTED}
          style={{ position: "absolute", [t.dir === "rtl" ? "right" : "left"]: 12, top: "50%", transform: "translateY(-50%)" }}
        />
        <input
          value={supplierQuery}
          onChange={(e) => setSupplierQuery(e.target.value)}
          placeholder={t.searchSuppliersPlaceholder}
          style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 34, borderRadius: 14 }}
        />
      </div>

      {allSupplierTags.length > 0 && (
        <div className="flex items-center gap-2 mb-4" style={{ overflowX: "auto" }}>
          <button
            onClick={() => setSupplierTagFilter("all")}
            className="btn-press font-bold text-xs flex items-center gap-1"
            style={{
              flexShrink: 0,
              padding: "8px 16px",
              borderRadius: 999,
              border: `1.4px solid ${supplierTagFilter === "all" ? PRIMARY : LINE}`,
              background: supplierTagFilter === "all" ? PRIMARY : SURFACE,
              color: supplierTagFilter === "all" ? "#fff" : MUTED,
            }}
          >
            <Tag size={12} /> {t.supplierTagsAll}
          </button>
          {allSupplierTags.map((tag) => {
            const isActive = supplierTagFilter === tag;
            return (
              <button
                key={tag}
                onClick={() => setSupplierTagFilter(tag)}
                className="btn-press font-bold text-xs"
                style={{
                  flexShrink: 0,
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: `1.4px solid ${isActive ? GOLD : LINE}`,
                  background: isActive ? GOLD : SURFACE,
                  color: isActive ? "#fff" : MUTED,
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

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
}) {
  return (
    <div className="px-4 pt-4 pb-10 flex flex-col gap-4">
     <div
      className="flex flex-col gap-4"
      style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16 }}
     >
      <FormSection title={t.formSectionBasic} first>
        <div>
          <label>{t.supplierNameLabel}</label>
          <input
            value={supplierForm.name}
            onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
            placeholder={t.supplierNamePlaceholder}
          />
          {supplierErrors.name && <p className="text-xs mt-1" style={{ color: DANGER }}>{supplierErrors.name}</p>}
        </div>

        <div>
          <label>{t.supplierContactLabel}</label>
          <input
            value={supplierForm.contactName}
            onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
            placeholder={t.supplierContactPlaceholder}
          />
        </div>
      </FormSection>

      <FormSection title={t.formSectionContact}>
        <div>
          <label>{t.phoneLabel}</label>
          <input
            type="tel"
            value={supplierForm.phone}
            onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
            placeholder={t.phonePlaceholder}
          />
        </div>

        <div>
          <label>{t.emailLabel}</label>
          <input
            type="email"
            value={supplierForm.email}
            onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
            placeholder={t.emailPlaceholder}
          />
        </div>
      </FormSection>

      <FormSection title={t.formSectionClassification}>
        <div>
          <label>{t.supplierCategoryLabel}</label>
          <input
            value={supplierForm.category}
            onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
            placeholder={t.supplierCategoryPlaceholder}
          />
        </div>

        <div>
          <label>{t.supplierTagsLabel}</label>
          <input
            value={supplierForm.tagsInput}
            onChange={(e) => setSupplierForm({ ...supplierForm, tagsInput: e.target.value })}
            placeholder={t.supplierTagsPlaceholder}
          />
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
          <textarea
            rows={5}
            value={supplierForm.notes}
            onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
            placeholder={t.notesPlaceholder}
          />
        </div>
      </FormSection>
     </div>

      <button
        onClick={saveSupplierForm}
        className="btn-press font-bold"
        style={{ background: PRIMARY, color: "#fff", borderRadius: 14, padding: "12px 0" }}
      >
        {t.saveSupplier}
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
