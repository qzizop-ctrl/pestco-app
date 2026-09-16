// ============================================================================
// Bottom sheet holding every customer-list filter (sector, pipeline stage,
// tags, missing-data, no-visits-yet) behind one "فلاتر" button, instead of
// four separate chip rows permanently occupying screen space above the
// list. Filters still apply live as they're tapped (there's no separate
// "apply" step to keep behavior identical to before) — the sheet is purely
// about where the controls live, not how filtering works. "Apply" just
// closes the sheet; "Clear all" resets every filter at once.
// ============================================================================

import React from "react";
import {
  X, Tag, ListFilter, Clock, CalendarDays,
  Building2, GitBranch, SlidersHorizontal,
} from "lucide-react";
import { PRIMARY, TEXT, MUTED, DANGER, GOLD, LINE, SURFACE, SURFACE_SUBTLE, sectorColor, stageColor } from "../theme";
import { SECTOR_IDS, STAGE_IDS } from "../domain";

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

// One filter group: an icon + label heading, its controls, and a hairline
// divider above it (except the first group) so the sheet reads as a set of
// clearly separated sections instead of one continuous block.
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

export default function FilterSheet({
  t, open, onClose,
  totalCustomers, sectorCounts,
  sectorFilter, setSectorFilter,
  stageFilter, setStageFilter,
  allTags, tagFilter, setTagFilter,
  missingDataOnly, setMissingDataOnly, missingDataCount,
  noVisitsOnly, setNoVisitsOnly, noVisitsCount,
  dateAddedFilter, setDateAddedFilter, availableAddedMonths = [], dateAddedScopeTotal,
}) {
  if (!open) return null;

  const activeCount =
    (sectorFilter !== "all" ? 1 : 0) +
    (stageFilter !== "all" ? 1 : 0) +
    (tagFilter !== "all" ? 1 : 0) +
    (missingDataOnly ? 1 : 0) +
    (noVisitsOnly ? 1 : 0) +
    (dateAddedFilter !== "all" ? 1 : 0);

  const clearAll = () => {
    setSectorFilter("all");
    setStageFilter("all");
    setTagFilter("all");
    setMissingDataOnly(false);
    setNoVisitsOnly(false);
    setDateAddedFilter("all");
  };

  // "YYYY-MM" -> a locale-aware "Month Year" label (e.g. "أغسطس 2026").
  // Defensively falls back instead of throwing if it's ever handed a
  // malformed or missing key (e.g. a stale cached bundle mixing old/new
  // shapes) instead of crashing the whole screen.
  const monthLabel = (key) => {
    if (!key || typeof key !== "string" || !key.includes("-")) return key || "";
    const [y, m] = key.split("-").map(Number);
    if (!y || !m) return key;
    const d = new Date(y, m - 1, 1);
    try {
      return d.toLocaleDateString(t.locale, { month: "long", year: "numeric" });
    } catch (e) {
      return key;
    }
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
        {/* Drag handle: signals "this sheet can be dismissed" at a glance,
            matching the swipe-down affordance people expect from a bottom sheet. */}
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
          <Section icon={Building2} label={t.sectorLabel} first>
            <ChipRow>
              <Chip active={sectorFilter === "all"} color={PRIMARY} onClick={() => setSectorFilter("all")}>
                {t.sectorAll} ({totalCustomers})
              </Chip>
              {SECTOR_IDS.map((id) => (
                <Chip key={id} active={sectorFilter === id} color={sectorColor(id)} onClick={() => setSectorFilter(id)}>
                  {t.sectors[id]} ({sectorCounts[id]})
                </Chip>
              ))}
            </ChipRow>
          </Section>

          <Section icon={GitBranch} label={t.pipelineLabel}>
            <ChipRow>
              <Chip active={stageFilter === "all"} color={PRIMARY} onClick={() => setStageFilter("all")}>
                {t.pipelineAll}
              </Chip>
              {STAGE_IDS.map((id) => (
                <Chip key={id} active={stageFilter === id} color={stageColor(id)} onClick={() => setStageFilter(id)}>
                  {t.stages[id]}
                </Chip>
              ))}
            </ChipRow>
          </Section>

          {allTags.length > 0 && (
            <Section icon={Tag} label={t.tagsLabel}>
              <ChipRow>
                <Chip active={tagFilter === "all"} color={PRIMARY} onClick={() => setTagFilter("all")}>
                  {t.tagsAll}
                </Chip>
                {allTags.map((tag) => (
                  <Chip key={tag} active={tagFilter === tag} color={GOLD} onClick={() => setTagFilter(tag)}>
                    {tag}
                  </Chip>
                ))}
              </ChipRow>
            </Section>
          )}

          <Section icon={SlidersHorizontal} label={t.otherFiltersLabel}>
            <ChipRow>
              <Chip active={missingDataOnly} color={DANGER} onClick={() => setMissingDataOnly((m) => !m)}>
                <ListFilter size={12} /> {t.missingDataFilter} ({missingDataCount})
              </Chip>
              <Chip active={noVisitsOnly} color={GOLD} onClick={() => setNoVisitsOnly((m) => !m)}>
                <Clock size={12} /> {t.noVisitsYetFilter} ({noVisitsCount})
              </Chip>
            </ChipRow>
          </Section>

          {availableAddedMonths.length > 0 && (
            <Section icon={CalendarDays} label={t.dateAddedFilterLabel}>
              <div className="icon-field">
                <CalendarDays size={17} color={MUTED} style={{ flexShrink: 0 }} />
                <select
                  className="field-bare"
                  value={dateAddedFilter}
                  onChange={(e) => setDateAddedFilter(e.target.value)}
                >
                  <option value="all">{t.dateAddedAllOption} ({dateAddedScopeTotal ?? totalCustomers})</option>
                  {availableAddedMonths
                    // Accepts either shape: a plain "YYYY-MM" string (older
                    // App.jsx) or a { key, count } object (current App.jsx).
                    // Keeps this screen working even if the two files ever
                    // drift out of sync between updates.
                    .map((item) => (typeof item === "string" ? { key: item, count: null } : item))
                    .filter((item) => item && item.key)
                    .map(({ key, count }) => (
                      <option key={key} value={key}>
                        {monthLabel(key)}{count != null ? ` (${count})` : ""}
                      </option>
                    ))}
                </select>
              </div>
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
