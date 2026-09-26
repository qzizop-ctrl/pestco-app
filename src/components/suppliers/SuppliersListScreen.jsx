// ============================================================================
// Suppliers list screen, split out of what used to be one Suppliers.jsx
// (list + form combined). Presentational only — see SupplierFormScreen.jsx
// for the same note; nothing about how state/Firestore calls work changed,
// only which file the JSX lives in.
// ============================================================================
import { useState } from "react";
import {
  Search, SlidersHorizontal, Truck, Star, Mail, Phone, MessageCircle, Plus, Bell,
} from "lucide-react";
import { TagChip, SkeletonList } from "../Shared";
import SupplierFilterSheet from "../SupplierFilterSheet";
import PendingEditsSheet from "../PendingEditsSheet";
import { PRIMARY, PRIMARY_MID, TEXT, MUTED, GOLD, GOLD_SOFT, LINE, SURFACE } from "../../theme";
import { buildWhatsAppLink } from "../../tagsAndLinks";
import { openWhatsApp } from "../../nativeWhatsApp";
import { useIncrementalReveal } from "../../hooks/useIncrementalReveal";

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

  // Same windowed-rendering fix as CustomerList.jsx — see
  // useIncrementalReveal.js. resetKey is the query/filter state, not
  // filteredSuppliers itself, so a live update doesn't reset scroll.
  const revealResetKey = [supplierQuery, supplierCategoryFilter, supplierTagFilter].join("|");
  const { visibleItems: visibleSuppliers, hasMore, sentinelRef } =
    useIncrementalReveal(filteredSuppliers, revealResetKey);

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

      {visibleSuppliers.map((s) => (
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
                    href={buildWhatsAppLink(s.phone)}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      openWhatsApp(s.phone);
                    }}
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

      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />}

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
