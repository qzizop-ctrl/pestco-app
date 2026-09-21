import { useEffect, useMemo, useRef, useState } from "react";

// ============================================================================
// WHY THIS EXISTS
// ----------------------------------------------------------------------------
// useLiveData.js loads the *entire* visits/suppliers collection in one shot
// (see the long comment there) — that choice is deliberate and stays as-is:
// search, filters, duplicate-phone checks, reminders, and the Dashboard's
// stats all correctly assume they see every record, and splitting that apart
// is a real backend/query redesign, not a drop-in fix.
//
// What *is* a safe, local fix is how many of those already-loaded records
// actually get rendered as DOM at once. CustomerList / SuppliersListScreen
// used to `.map()` over the full filtered array unconditionally — fine at
// dozens of rows, increasingly expensive (initial paint, scroll jank, memory)
// as a workspace grows into the hundreds/thousands useLiveData already warns
// about (LARGE_COLLECTION_WARNING_THRESHOLD). This hook caps what's actually
// mounted to a small growing window and reveals more as the user scrolls,
// the same pattern as "infinite scroll" — the full dataset is still there in
// memory for search/filters/counts, only the rendered slice is capped.
// ============================================================================

const DEFAULT_PAGE_SIZE = 30;

// `resetKey` should change only when the *query* changes (search text,
// active filters) — not on every Firestore snapshot update — so a live edit
// arriving while the user is scrolled down doesn't yank them back to the
// top. Callers build it from their filter/search state, e.g.:
//   `${query}|${sectorFilter}|${stageFilter}|${tagFilter}|...`
export function useIncrementalReveal(items, resetKey, pageSize = DEFAULT_PAGE_SIZE) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef(null);

  // New search/filter -> start over from the first page. Deliberately NOT
  // keyed on `items` itself (that identity changes on every live data
  // update too), only on the caller-supplied query signature.
  useEffect(() => {
    setVisibleCount(pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, pageSize]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    // No IntersectionObserver (very old WebView) -> just render everything;
    // correctness over the render-cost optimization in that edge case.
    if (typeof IntersectionObserver === "undefined") {
      setVisibleCount(items.length);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(items.length, c + pageSize));
        }
      },
      { rootMargin: "600px 0px" } // reveal the next page before the user hits bottom
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length, pageSize]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );

  return {
    visibleItems,
    hasMore: visibleCount < items.length,
    sentinelRef,
  };
}
