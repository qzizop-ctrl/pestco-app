import { useEffect, useState } from "react";

// The customer-list search/filter UI state. Pulled out of App.jsx — pure
// UI state with no dependency on any other hook (useFilteredData below
// only reads these values as plain arguments), so moving it here changes
// nothing about behavior; it's created at the same point in App() and
// destructured with the same names as before.
export function useCustomerFilters() {
  const [query, setQuery] = useState("");
  // The input stays bound to `query` directly so typing feels instant; the
  // list filter below reads `debouncedQuery` instead, which only updates
  // 250ms after the user stops typing. That avoids re-filtering the full
  // customer list on every single keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(id);
  }, [query]);
  const [sectorFilter, setSectorFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [missingDataOnly, setMissingDataOnly] = useState(false);
  const [noVisitsOnly, setNoVisitsOnly] = useState(false);
  // "all" or a "YYYY-MM" key — filters by when the customer record was
  // created, independent of visit/pipeline status (see availableAddedMonths).
  const [dateAddedFilter, setDateAddedFilter] = useState("all");

  return {
    query, setQuery, debouncedQuery,
    sectorFilter, setSectorFilter,
    stageFilter, setStageFilter,
    tagFilter, setTagFilter,
    missingDataOnly, setMissingDataOnly,
    noVisitsOnly, setNoVisitsOnly,
    dateAddedFilter, setDateAddedFilter,
  };
}
