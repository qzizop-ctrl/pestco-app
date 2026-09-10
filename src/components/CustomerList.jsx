// ============================================================================
// Customer list screen (search, filters, reminders banners, the list
// itself), extracted from App.jsx. Presentational only.
// ============================================================================

import React, { useState } from "react";
import {
  Search,
  SlidersHorizontal, Building2, Plus,
} from "lucide-react";
import { VisitCard, SkeletonList } from "./Shared";
import AlertsCenter from "./AlertsCenter";
import FilterSheet from "./FilterSheet";
import {
  PRIMARY, TEXT, MUTED, GOLD, LINE, SURFACE,
  SECTOR_IDS,
  sectorColor,
} from "../constants";

export default function CustomerListScreen({
  t,
  isOnline,
  dueReminders,
  staleOffers,
  staleCustomers,
  openDetail,
  query,
  setQuery,
  totalCustomers,
  sectorCounts,
  sectorFilter,
  setSectorFilter,
  stageFilter,
  setStageFilter,
  allTags,
  tagFilter,
  setTagFilter,
  missingDataOnly,
  setMissingDataOnly,
  missingDataCount,
  noVisitsOnly,
  setNoVisitsOnly,
  noVisitsCount,
  loaded,
  filtered,
  togglePin,
  canEdit,
  openNew,
}) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const activeFilterCount =
    (sectorFilter !== "all" ? 1 : 0) +
    (stageFilter !== "all" ? 1 : 0) +
    (tagFilter !== "all" ? 1 : 0) +
    (missingDataOnly ? 1 : 0) +
    (noVisitsOnly ? 1 : 0);

  return (
    <div className="px-4 pt-4 pb-24">
      <AlertsCenter
        t={t}
        isOnline={isOnline}
        dueReminders={dueReminders}
        staleOffers={staleOffers}
        staleCustomers={staleCustomers}
        openDetail={openDetail}
      />

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            color={MUTED}
            style={{ position: "absolute", [t.dir === "rtl" ? "right" : "left"]: 12, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
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
            padding: "0 14px",
            height: 44,
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
      </div>

      <FilterSheet
        t={t}
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        totalCustomers={totalCustomers}
        sectorCounts={sectorCounts}
        sectorFilter={sectorFilter}
        setSectorFilter={setSectorFilter}
        stageFilter={stageFilter}
        setStageFilter={setStageFilter}
        allTags={allTags}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        missingDataOnly={missingDataOnly}
        setMissingDataOnly={setMissingDataOnly}
        missingDataCount={missingDataCount}
        noVisitsOnly={noVisitsOnly}
        setNoVisitsOnly={setNoVisitsOnly}
        noVisitsCount={noVisitsCount}
      />

      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold" style={{ color: TEXT }}>{t.totalCustomersLabel}</span>
          <span className="text-sm font-extrabold" style={{ color: PRIMARY }}>{totalCustomers}</span>
        </div>
        <div className="flex flex-col gap-1">
          {SECTOR_IDS.map((id) => (
            <div key={id} className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: MUTED }}>{t.sectors[id]}</span>
              <span className="text-xs font-extrabold" style={{ color: sectorColor(id) }}>{sectorCounts[id]}</span>
            </div>
          ))}
        </div>
      </div>

      {!loaded && <SkeletonList count={5} />}

      {loaded && filtered.length === 0 && (
        <div className="text-center py-16">
          <Building2 size={40} color="#C7C4B6" className="mx-auto mb-2" />
          <p className="font-bold" style={{ color: TEXT }}>{t.noVisits}</p>
          <p className="text-sm mt-1" style={{ color: MUTED }}>{t.noVisitsHint}</p>
        </div>
      )}

      {filtered.map((v) => (
        <VisitCard key={v.id} visit={v} onOpen={openDetail} onTogglePin={togglePin} canEdit={canEdit} t={t} />
      ))}

      {canEdit && (
        <button
          onClick={openNew}
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
          aria-label={t.newVisit}
        >
          <Plus size={26} />
        </button>
      )}
    </div>
  );
}
