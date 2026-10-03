// ============================================================================
// Customer list screen (search, filters, reminders banners, the list
// itself), extracted from App.jsx. Presentational only.
// ============================================================================

import { useState } from "react";
import {
  Search,
  SlidersHorizontal, Building2, Plus, Bell,
} from "lucide-react";
import { VisitCard, SkeletonList } from "./Shared";
import AlertsCenter from "./AlertsCenter";
import FilterSheet from "./FilterSheet";
import PendingEditsSheet from "./PendingEditsSheet";
import PillButton from "./PillButton";
import { PRIMARY, TEXT, MUTED, GOLD, LINE, SURFACE, sectorColor } from "../theme";
import { SECTOR_IDS } from "../domain";
import { useIncrementalReveal } from "../hooks/useIncrementalReveal";

export default function CustomerListScreen({
  t,
  isOnline,
  dueReminders,
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
  dateAddedFilter,
  setDateAddedFilter,
  availableAddedMonths,
  dateAddedScopeTotal,
  loaded,
  loadTimedOut,
  onRetryLoad,
  filtered,
  togglePin,
  canEdit,
  openNew,
  isOwnerAccount,
  pendingEdits = [],
  openPendingEditItem,
}) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchActive = searchFocused || query.length > 0;
  const [pendingEditsOpen, setPendingEditsOpen] = useState(false);
  const activeFilterCount =
    [sectorFilter, stageFilter, tagFilter, dateAddedFilter].filter((f) => f !== "all").length +
    [missingDataOnly, noVisitsOnly].filter(Boolean).length;

  // Only render a growing window of `filtered` instead of every row at
  // once — see useIncrementalReveal.js for why. resetKey is built from the
  // query/filter state (not from `filtered` itself) so a live Firestore
  // update while scrolled down doesn't reset the scroll position back to
  // the first page.
  const revealResetKey = [
    query, sectorFilter, stageFilter, tagFilter,
    missingDataOnly, noVisitsOnly, dateAddedFilter,
  ].join("|");
  const { visibleItems, hasMore, sentinelRef } = useIncrementalReveal(filtered, revealResetKey);

  return (
    <div className="px-4 pt-4 pb-24">
      <AlertsCenter
        t={t}
        isOnline={isOnline}
        dueReminders={dueReminders}
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
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={t.searchPlaceholder}
            style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 34, borderRadius: 14 }}
          />
        </div>
        <PillButton
          onClick={() => setFilterSheetOpen(true)}
          icon={SlidersHorizontal}
          label={t.filtersBtn}
          count={activeFilterCount}
          accent={PRIMARY}
          badgeBg={GOLD}
          badgeColor="#fff"
          searchActive={searchActive}
        />

        {isOwnerAccount && (
          <PillButton
            onClick={() => setPendingEditsOpen(true)}
            icon={Bell}
            label={t.pendingEditsBtn}
            count={pendingEdits.length}
            accent={GOLD}
            badgeBg="#fff"
            badgeColor={GOLD}
            searchActive={searchActive}
          />
        )}
      </div>

      <PendingEditsSheet
        t={t}
        open={pendingEditsOpen}
        onClose={() => setPendingEditsOpen(false)}
        pendingEdits={pendingEdits}
        onOpenItem={openPendingEditItem}
      />

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
        dateAddedFilter={dateAddedFilter}
        setDateAddedFilter={setDateAddedFilter}
        availableAddedMonths={availableAddedMonths}
        dateAddedScopeTotal={dateAddedScopeTotal}
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

      {!loaded && !loadTimedOut && <SkeletonList count={5} />}

      {/* Could not get an answer in time (offline / slow start): say so and
          offer a retry, instead of an endless skeleton or a false
          "no customers" message. */}
      {!loaded && loadTimedOut && (
        <div className="text-center py-16">
          <Building2 size={40} color="#C7C4B6" className="mx-auto mb-2" />
          <p className="font-bold" style={{ color: TEXT }}>{t.connectionIssueTitle}</p>
          <p className="text-sm mt-1 mb-4" style={{ color: MUTED }}>{t.connectionIssueHint}</p>
          <button
            onClick={onRetryLoad}
            className="btn-press font-bold"
            style={{ background: PRIMARY, color: "#fff", borderRadius: 12, padding: "10px 24px" }}
          >
            {t.retryBtn}
          </button>
        </div>
      )}

      {loaded && filtered.length === 0 && (
        <div className="text-center py-16">
          <Building2 size={40} color="#C7C4B6" className="mx-auto mb-2" />
          <p className="font-bold" style={{ color: TEXT }}>{t.noVisits}</p>
          <p className="text-sm mt-1" style={{ color: MUTED }}>{t.noVisitsHint}</p>
        </div>
      )}

      {visibleItems.map((v) => (
        <VisitCard key={v.id} visit={v} onOpen={openDetail} onTogglePin={togglePin} canEdit={canEdit} t={t} />
      ))}

      {/* Invisible sentinel: once it scrolls into view, useIncrementalReveal
          mounts the next page of rows. rootMargin on the observer means
          this fires a bit before the user actually reaches the bottom. */}
      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />}

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
          data-testid="new-visit"
        >
          <Plus size={26} />
        </button>
      )}
    </div>
  );
}
