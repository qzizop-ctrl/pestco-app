// ============================================================================
// Bottom sheet holding the supplier-list filters (category, product tags)
// behind one "فلاتر" button, instead of two separate chip rows permanently
// occupying screen space above the list — mirrors FilterSheet.jsx on the
// customers screen so both sections feel consistent. Filters still apply
// live as they're tapped; the sheet is purely about where the controls
// live, not how filtering works.
// ============================================================================

import { X, Tag, Package } from "lucide-react";
import { PRIMARY, PRIMARY_MID, TEXT, MUTED, GOLD, LINE, SURFACE, SURFACE_SUBTLE } from "../theme";

function ChipRow({ children }) {
  return (
    <div className="flex items-center flex-wrap gap-2">{children}</div>
  );
}

function Chip({ active, color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="btn-press font-bold text-xs flex items-center gap-1"
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        border: `1.4px solid ${active ? color : LINE}`,
        background: active ? color : SURFACE_SUBTLE,
        color: active ? "#fff" : MUTED,
        boxShadow: active ? `0 2px 8px -2px ${color}66` : "none",
      }}
    >
      {children}
    </button>
  );
}

function Section({ icon: Icon, label, first, children }) {
  return (
    <div style={{ paddingTop: first ? 0 : 16, borderTop: first ? "none" : `1px solid ${LINE}` }}>
      <label className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
        <Icon size={13} />
        {label}
      </label>
      {children}
    </div>
  );
}

export default function SupplierFilterSheet({
  t, open, onClose,
  totalSuppliers,
  allSupplierCategories, supplierCategoryFilter, setSupplierCategoryFilter,
  allSupplierTags, supplierTagFilter, setSupplierTagFilter,
}) {
  if (!open) return null;

  const activeCount =
    (supplierCategoryFilter !== "all" ? 1 : 0) +
    (supplierTagFilter !== "all" ? 1 : 0);

  const clearAll = () => {
    setSupplierCategoryFilter("all");
    setSupplierTagFilter("all");
  };

  return (
    <div
      className="flex items-end justify-center"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 90 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: SURFACE,
          borderRadius: "18px 18px 0 0",
          padding: "10px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
          width: "100%",
          maxWidth: 480,
          maxHeight: "82vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-center" style={{ paddingBottom: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: LINE }} />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base" style={{ color: TEXT }}>{t.filtersTitle}</span>
            {activeCount > 0 && (
              <span
                className="text-xs font-extrabold flex items-center justify-center"
                style={{
                  background: GOLD, color: "#fff", borderRadius: 999,
                  minWidth: 18, height: 18, padding: "0 5px",
                }}
              >
                {activeCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="btn-press flex items-center justify-center" style={{ color: MUTED }} aria-label={t.back}>
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col">
          <Section icon={Package} label={t.supplierCategoryLabel} first>
            <ChipRow>
              <Chip active={supplierCategoryFilter === "all"} color={PRIMARY_MID} onClick={() => setSupplierCategoryFilter("all")}>
                {t.supplierCategoryAll} ({totalSuppliers})
              </Chip>
              {allSupplierCategories.map((category) => (
                <Chip key={category} active={supplierCategoryFilter === category} color={PRIMARY_MID} onClick={() => setSupplierCategoryFilter(category)}>
                  {category}
                </Chip>
              ))}
            </ChipRow>
          </Section>

          {allSupplierTags.length > 0 && (
            <Section icon={Tag} label={t.supplierTagsLabel}>
              <ChipRow>
                <Chip active={supplierTagFilter === "all"} color={PRIMARY} onClick={() => setSupplierTagFilter("all")}>
                  {t.supplierTagsAll}
                </Chip>
                {allSupplierTags.map((tag) => (
                  <Chip key={tag} active={supplierTagFilter === tag} color={GOLD} onClick={() => setSupplierTagFilter(tag)}>
                    {tag}
                  </Chip>
                ))}
              </ChipRow>
            </Section>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={clearAll}
            disabled={activeCount === 0}
            className="btn-press flex-1 font-bold"
            style={{
              background: SURFACE,
              border: `1px solid ${LINE}`,
              color: MUTED,
              borderRadius: 12,
              padding: "11px 0",
              opacity: activeCount === 0 ? 0.5 : 1,
            }}
          >
            {t.clearFiltersBtn}
          </button>
          <button
            onClick={onClose}
            className="btn-press flex-1 font-bold"
            style={{ background: PRIMARY, color: "#fff", borderRadius: 12, padding: "11px 0" }}
          >
            {t.applyFiltersBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
