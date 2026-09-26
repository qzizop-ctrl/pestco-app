import { useEffect, useMemo } from "react";
import { SECTOR_IDS, STALE_OFFER_DAYS, STALE_ACTIVITY_DAYS } from "../domain";
import { parseVisitDate, visitStatus, fmtReminder, findDuplicateGroups, isStaleCustomer, collectSupplierTags, collectSupplierCategories, getVisitEvents, toJsDate } from "../helpers";

// Every derived/filtered list the list & dashboard screens read — customer
// search/sector/stage/tag/date filters, reminders, stale offers/customers,
// pending-edit queues, and the supplier-side equivalents. All of this used
// to be a long run of useMemo calls inline in App.jsx; grouped here since
// they all share the same "start from visits/suppliers, filter down" shape
// and don't own any state of their own (pure derivations).
export function useFilteredData({
  visits, suppliers, pendingDelete, pendingSupplierDelete,
  sectorFilter, stageFilter, tagFilter, missingDataOnly, noVisitsOnly,
  dateAddedFilter, setDateAddedFilter, debouncedQuery,
  supplierTagFilter, supplierCategoryFilter, debouncedSupplierQuery,
  t,
}) {
  // Bucketed to the minute rather than Date.now() directly: using the raw
  // timestamp as a useMemo dependency below would defeat the memoization
  // (it's a different value on every render), but none of these lists need
  // finer-than-a-minute precision to be correct.
  const nowBucket = Math.floor(Date.now() / 60000);
  const now = nowBucket * 60000;

  const visibleVisits = useMemo(
    () => visits.filter((v) => v.id !== pendingDelete?.id && !v.deleted),
    [visits, pendingDelete]
  );

  const dueReminders = useMemo(
    () =>
      visibleVisits
        .filter((v) => v.callDateTime && new Date(v.callDateTime).getTime() <= now + 24 * 3600 * 1000)
        .sort((a, b) => new Date(a.callDateTime) - new Date(b.callDateTime)),
    [visibleVisits, nowBucket]
  );

  const staleOffers = useMemo(
    () =>
      visibleVisits.flatMap((v) =>
        (v.offers || [])
          .filter((o) => {
            if (o.status !== "pending") return false;
            const d = parseVisitDate(o.offerDate);
            if (!d) return false;
            return (now - d.getTime()) / (1000 * 3600 * 24) > STALE_OFFER_DAYS;
          })
          .map((o) => ({ ...o, customer: v }))
      ),
    [visibleVisits, nowBucket]
  );

  // Customers with no recent activity (visit, call, or note) — a nudge to
  // follow up before they go completely cold.
  const staleCustomers = useMemo(
    () => visibleVisits.filter((v) => isStaleCustomer(v, STALE_ACTIVITY_DAYS)),
    [visibleVisits, nowBucket]
  );

  // Customers with a pending edit OR a pending deletion awaiting the owner's
  // اعتماد/تراجع decision (last_change set but not yet cleared). Feeds the
  // bell icon on the customer list ONLY — kept independent from the
  // suppliers bell below, each section shows its own review queue rather
  // than a merged one, so tapping a section's bell always stays in that
  // section.
  const pendingEdits = useMemo(
    () => visits.filter((v) => v.last_change && v.id !== pendingDelete?.id),
    [visits, pendingDelete]
  );

  // Same idea, mirrored for suppliers (last_change set by saveSupplierForm /
  // proceedDeleteSupplier) but feeding a separate bell on the suppliers
  // list, independent of the customer one above.
  const pendingSupplierEdits = useMemo(
    () =>
      suppliers
        .filter((s) => s.last_change && s.id !== pendingSupplierDelete?.id)
        .map((s) => ({ ...s, companyName: s.name })),
    [suppliers, pendingSupplierDelete]
  );

  // Possible duplicate customers (same phone or a near-identical company
  // name), reviewed from the Settings screen.
  const duplicateGroups = useMemo(() => findDuplicateGroups(visibleVisits), [visibleVisits]);

  const allTags = useMemo(
    () => Array.from(new Set(visibleVisits.flatMap((v) => v.tags || []))).sort(),
    [visibleVisits]
  );

  // How many customers currently carry each tag, for the "manage tags"
  // screen in Settings (rename/merge) — a tag with a count next to it is
  // what makes typo variants like "VIP" vs "vip" visible in the first place.
  const tagCounts = useMemo(() => {
    const counts = {};
    visibleVisits.forEach((v) => {
      (v.tags || []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return counts;
  }, [visibleVisits]);

  const sectorCounts = useMemo(
    () =>
      SECTOR_IDS.reduce((acc, id) => {
        acc[id] = visibleVisits.filter((v) => v.sector === id).length;
        return acc;
      }, {}),
    [visibleVisits]
  );
  const totalCustomers = visibleVisits.length;
  const missingDataCount = useMemo(
    () => visibleVisits.filter((v) => !v.phone || !v.email).length,
    [visibleVisits]
  );
  const noVisitsCount = useMemo(
    () => visibleVisits.filter((v) => getVisitEvents(v).length === 0).length,
    [visibleVisits]
  );

  // Every "YYYY-MM" that at least one customer was actually added in,
  // together with how many — newest first — used to populate the "date
  // added" filter dropdown so it only ever offers months that have real
  // data behind them, with a count next to each just like the other filters.
  //
  // Scoped to whatever the sector/stage/tag/missing-data/no-visits filters
  // above it currently select (but not to dateAddedFilter itself, since
  // that's the one being computed here) — so picking e.g. "Contracting"
  // narrows these counts down to just that sector, the same way the
  // sector/stage chips already narrow each other.
  const dateAddedScopeVisits = useMemo(
    () =>
      visibleVisits
        .filter((v) => sectorFilter === "all" || v.sector === sectorFilter)
        .filter((v) => stageFilter === "all" || v.stage === stageFilter)
        .filter((v) => tagFilter === "all" || (v.tags || []).includes(tagFilter))
        .filter((v) => !missingDataOnly || !v.phone || !v.email)
        .filter((v) => !noVisitsOnly || getVisitEvents(v).length === 0),
    [visibleVisits, sectorFilter, stageFilter, tagFilter, missingDataOnly, noVisitsOnly]
  );
  const dateAddedScopeTotal = dateAddedScopeVisits.length;

  const availableAddedMonths = useMemo(() => {
    const counts = {};
    dateAddedScopeVisits.forEach((v) => {
      const d = toJsDate(v.createdAt);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((key) => ({ key, count: counts[key] }));
  }, [dateAddedScopeVisits]);

  // If the sector/stage/tag/etc. filters above narrow the list so far that
  // the currently-picked month no longer has any customers in it, fall
  // back to "all" automatically instead of silently showing zero results
  // for a month that's no longer even in the dropdown.
  useEffect(() => {
    if (dateAddedFilter === "all") return;
    if (!availableAddedMonths.some((m) => m.key === dateAddedFilter)) {
      setDateAddedFilter("all");
    }
  }, [availableAddedMonths, dateAddedFilter]);

  const filtered = useMemo(
    () =>
      visibleVisits
        .filter((v) => sectorFilter === "all" || v.sector === sectorFilter)
        .filter((v) => stageFilter === "all" || v.stage === stageFilter)
        .filter((v) => tagFilter === "all" || (v.tags || []).includes(tagFilter))
        .filter((v) => !missingDataOnly || !v.phone || !v.email)
        .filter((v) => !noVisitsOnly || getVisitEvents(v).length === 0)
        .filter((v) => {
          // Filters by when the record was added, regardless of visit/
          // pipeline status — deliberately kept independent of noVisitsOnly.
          if (dateAddedFilter === "all") return true;
          const d = toJsDate(v.createdAt);
          if (!d) return false;
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === dateAddedFilter;
        })
        .filter((v) => {
          const q = debouncedQuery.trim().toLowerCase();
          if (!q) return true;
          return (
            v.companyName.toLowerCase().includes(q) ||
            v.contactName.toLowerCase().includes(q) ||
            (v.phone || "").toLowerCase().includes(q) ||
            (v.notes || "").toLowerCase().includes(q) ||
            (v.visitDate || "").toLowerCase().includes(q) ||
            (v.callDateTime || "").toLowerCase().includes(q) ||
            (v.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
            (v.activityLog || []).some((entry) => (entry.text || "").toLowerCase().includes(q)) ||
            fmtReminder(v.callDateTime, t.locale).toLowerCase().includes(q)
          );
        })
        .sort((a, b) => {
          if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
          const sa = visitStatus(a);
          const sb = visitStatus(b);
          const order = { overdue: 0, today: 1, upcoming: 2, none: 3 };
          if (order[sa] !== order[sb]) return order[sa] - order[sb];
          const da = parseVisitDate(a.visitDate);
          const db = parseVisitDate(b.visitDate);
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return db - da;
        }),
    [visibleVisits, sectorFilter, stageFilter, tagFilter, missingDataOnly, noVisitsOnly, dateAddedFilter, debouncedQuery, t.locale]
  );

  // Suppliers with a pending deletion hidden, same as visibleVisits does for
  // customers: a pending deletion is flagged with `deleted: true` (and kept
  // out of the self-undo window via pendingSupplierDelete) rather than
  // actually removed, so it still needs to stay out of the normal list.
  const visibleSuppliers = useMemo(
    () => suppliers.filter((s) => s.id !== pendingSupplierDelete?.id && !s.deleted),
    [suppliers, pendingSupplierDelete]
  );

  // All unique product tags across every supplier, used to populate the
  // "filter by product" chip row on the Suppliers list.
  const allSupplierTags = useMemo(() => collectSupplierTags(visibleSuppliers), [visibleSuppliers]);

  // How many suppliers currently carry each product tag — same purpose as
  // tagCounts above, but for the suppliers tab of the "manage tags" card.
  const supplierTagCounts = useMemo(() => {
    const counts = {};
    visibleSuppliers.forEach((s) => {
      (s.tags || []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return counts;
  }, [visibleSuppliers]);

  // All unique "goods/service type" values across every supplier, used to
  // populate a separate "filter by category" chip row — distinct from the
  // product tags above, since a supplier's category (e.g. "كاميرات مراقبة")
  // and its individual product tags aren't the same field.
  const allSupplierCategories = useMemo(() => collectSupplierCategories(visibleSuppliers), [visibleSuppliers]);

  const filteredSuppliers = useMemo(
    () =>
      visibleSuppliers
        .filter((s) => supplierTagFilter === "all" || (s.tags || []).includes(supplierTagFilter))
        .filter((s) => supplierCategoryFilter === "all" || (s.category || "").trim() === supplierCategoryFilter)
        .filter((s) => {
          const q = debouncedSupplierQuery.trim().toLowerCase();
          if (!q) return true;
          return (
            (s.name || "").toLowerCase().includes(q) ||
            (s.contactName || "").toLowerCase().includes(q) ||
            (s.phone || "").toLowerCase().includes(q) ||
            (s.email || "").toLowerCase().includes(q) ||
            (s.category || "").toLowerCase().includes(q) ||
            (s.notes || "").toLowerCase().includes(q) ||
            (s.tags || []).some((tag) => tag.toLowerCase().includes(q))
          );
        })
        .sort((a, b) => {
          if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
          return (a.name || "").localeCompare(b.name || "", "ar");
        }),
    [visibleSuppliers, supplierTagFilter, supplierCategoryFilter, debouncedSupplierQuery]
  );

  return {
    visibleVisits, dueReminders, staleOffers, staleCustomers,
    pendingEdits, pendingSupplierEdits, duplicateGroups,
    allTags, tagCounts, sectorCounts, totalCustomers, missingDataCount, noVisitsCount,
    dateAddedScopeTotal, availableAddedMonths, filtered,
    visibleSuppliers, allSupplierTags, supplierTagCounts, allSupplierCategories, filteredSuppliers,
  };
}
