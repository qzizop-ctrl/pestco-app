// ============================================================================
// Bottom sheet for linking one or more suppliers to an offer. Same pattern
// as FilterSheet.jsx: a single button on the parent screen opens this
// instead of a picker (select + chip row) permanently occupying space on
// the offer form. Selection is local to the sheet — nothing is written
// until the offer itself is saved via the parent's addOffer/newOffer state.
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { X, Check, Search } from "lucide-react";
import { TEXT, MUTED, LINE, SURFACE, PRIMARY, GOLD_SOFT } from "../constants";

export default function SupplierPickerSheet({
  t, open, onClose,
  suppliers, selectedIds, onToggle,
}) {
  // The component stays mounted (it just renders null) while closed, so the
  // search box wouldn't clear itself between opens without this — reset it
  // fresh every time the sheet opens.
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Selected suppliers stay pinned at the top (in their selected order) so
  // picking a few, then searching for one more, never scrolls an already
  // -chosen supplier out of view. Below the pinned ones, the rest of the
  // list is filtered by name as the user types.
  const visibleSuppliers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selected = suppliers.filter((s) => selectedIds.includes(s.id));
    const rest = suppliers.filter((s) => !selectedIds.includes(s.id));
    const filteredRest = q ? rest.filter((s) => (s.name || "").toLowerCase().includes(q)) : rest;
    // While actively searching, only show selected items that also match —
    // otherwise a long "already picked" block would bury the search results.
    const filteredSelected = q ? selected.filter((s) => (s.name || "").toLowerCase().includes(q)) : selected;
    return [...filteredSelected, ...filteredRest];
  }, [suppliers, selectedIds, query]);

  if (!open) return null;

  return (
    <div
      className="flex items-end justify-center"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 95 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: SURFACE,
          borderRadius: "18px 18px 0 0",
          padding: "16px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
          width: "100%",
          maxWidth: 480,
          maxHeight: "78vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-base" style={{ color: TEXT }}>{t.offerSuppliersSheetTitle}</span>
          <button onClick={onClose} className="btn-press flex items-center justify-center" style={{ color: MUTED }} aria-label={t.back}>
            <X size={18} />
          </button>
        </div>

        {suppliers.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noSuppliersToPick}</p>
        ) : (
          <>
            {/* Only worth the extra row once the list is long enough that
                scrolling to find a name is actually annoying. */}
            {suppliers.length > 6 && (
              <div className="relative mb-3">
                <Search
                  size={15}
                  color={MUTED}
                  style={{ position: "absolute", [t.dir === "rtl" ? "right" : "left"]: 12, top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.pickSupplierSearchPlaceholder}
                  style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 32, borderRadius: 10 }}
                />
              </div>
            )}

            {visibleSuppliers.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noSupplierSearchResults}</p>
            ) : (
              <div className="flex flex-col gap-1">
                {visibleSuppliers.map((s) => {
                  const isSelected = selectedIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => onToggle(s)}
                      className="btn-press flex items-center justify-between"
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: isSelected ? GOLD_SOFT : "transparent",
                        textAlign: t.dir === "rtl" ? "right" : "left",
                      }}
                    >
                      <span className="text-sm font-bold" style={{ color: TEXT }}>{s.name}</span>
                      {isSelected && <Check size={16} style={{ color: "#7A5420" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        <button
          onClick={onClose}
          className="btn-press w-full font-bold mt-4"
          style={{ background: PRIMARY, color: "#fff", borderRadius: 12, padding: "11px 0" }}
        >
          {t.offerSuppliersDone}
        </button>
      </div>
    </div>
  );
}
