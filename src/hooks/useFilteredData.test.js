import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { STRINGS } from "../i18n";
import { useFilteredData } from "./useFilteredData";

// ---------------------------------------------------------------------------
// First hook test in the project (existing *.test.js files all cover pure
// functions — helpers.js, dashboardCalculations.js, adminPermissions.js).
// useFilteredData is the best starting point for that: every screen's list
// filtering, duplicate detection, and stale-record nudges go through it, and
// — unlike useCustomerRecords/useWorkspace — it touches no Firebase, so it's
// testable with plain data in, data out, no mocking of `db` required.
//
// The clock is pinned with vi.useFakeTimers() for every test in this file:
// several of the derived lists (dueReminders, staleOffers, staleCustomers)
// are computed relative to "now", so leaving the real clock running would
// make those tests flaky depending on when they happen to run.
// ---------------------------------------------------------------------------

const t = STRINGS.en;
const NOW = new Date("2026-06-15T12:00:00.000Z");

function daysAgo(n) {
  return new Date(NOW.getTime() - n * 24 * 3600 * 1000);
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function baseProps(overrides = {}) {
  return {
    visits: [],
    suppliers: [],
    pendingDelete: null,
    pendingSupplierDelete: null,
    sectorFilter: "all",
    stageFilter: "all",
    tagFilter: "all",
    missingDataOnly: false,
    noVisitsOnly: false,
    dateAddedFilter: "all",
    setDateAddedFilter: vi.fn(),
    debouncedQuery: "",
    supplierTagFilter: "all",
    supplierCategoryFilter: "all",
    debouncedSupplierQuery: "",
    t,
    ...overrides,
  };
}

function makeVisit(overrides = {}) {
  return {
    id: "v1",
    companyName: "Acme",
    contactName: "Sami",
    sector: "private",
    stage: "survey",
    tags: [],
    phone: "",
    email: "",
    notes: "",
    visitDate: "",
    callDateTime: "",
    offers: [],
    isPinned: false,
    deleted: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("visibleVisits", () => {
  it("hides a soft-deleted visit", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [makeVisit({ id: "a" }), makeVisit({ id: "b", deleted: true })],
      }))
    );
    expect(result.current.visibleVisits.map((v) => v.id)).toEqual(["a"]);
  });

  it("hides the visit currently pending its own deletion (undo window)", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [makeVisit({ id: "a" }), makeVisit({ id: "b" })],
        pendingDelete: { id: "b" },
      }))
    );
    expect(result.current.visibleVisits.map((v) => v.id)).toEqual(["a"]);
  });
});

describe("dueReminders", () => {
  it("includes a call scheduled within the next 24h, excludes one further out", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({ id: "soon", callDateTime: new Date(NOW.getTime() + 3 * 3600 * 1000).toISOString() }),
          makeVisit({ id: "later", callDateTime: new Date(NOW.getTime() + 48 * 3600 * 1000).toISOString() }),
        ],
      }))
    );
    expect(result.current.dueReminders.map((v) => v.id)).toEqual(["soon"]);
  });

  it("also includes an overdue call (no lower bound on the window)", () => {
    // Worth pinning down explicitly: the filter is `callDateTime <= now + 24h`
    // with no floor, so a call that's already overdue counts as "due" too,
    // same as one due later today — there's no separate "overdue" bucket
    // here (AlertsCenter/visitStatus draw that distinction elsewhere).
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [makeVisit({ id: "overdue", callDateTime: new Date(NOW.getTime() - 48 * 3600 * 1000).toISOString() })],
      }))
    );
    expect(result.current.dueReminders.map((v) => v.id)).toEqual(["overdue"]);
  });

  it("sorts soonest first", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({ id: "in-20h", callDateTime: new Date(NOW.getTime() + 20 * 3600 * 1000).toISOString() }),
          makeVisit({ id: "in-1h", callDateTime: new Date(NOW.getTime() + 1 * 3600 * 1000).toISOString() }),
        ],
      }))
    );
    expect(result.current.dueReminders.map((v) => v.id)).toEqual(["in-1h", "in-20h"]);
  });
});

describe("staleOffers", () => {
  it("flags a pending offer older than the stale-offer threshold (30 days)", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({
            id: "v1",
            offers: [{ id: "o1", status: "pending", offerDate: isoDate(daysAgo(31)) }],
          }),
        ],
      }))
    );
    expect(result.current.staleOffers).toHaveLength(1);
    expect(result.current.staleOffers[0].id).toBe("o1");
    // the offer is annotated with its parent customer for the UI to link back
    expect(result.current.staleOffers[0].customer.id).toBe("v1");
  });

  it("does not flag a recent pending offer", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({ offers: [{ id: "o1", status: "pending", offerDate: isoDate(daysAgo(5)) }] }),
        ],
      }))
    );
    expect(result.current.staleOffers).toHaveLength(0);
  });

  it("never flags a decided (non-pending) offer, however old", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({ offers: [{ id: "o1", status: "purchased", offerDate: isoDate(daysAgo(90)) }] }),
        ],
      }))
    );
    expect(result.current.staleOffers).toHaveLength(0);
  });
});

describe("staleCustomers", () => {
  it("flags a customer with no activity in over the stale threshold (90 days)", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [makeVisit({ id: "cold", visitDate: isoDate(daysAgo(120)) })],
      }))
    );
    expect(result.current.staleCustomers.map((v) => v.id)).toEqual(["cold"]);
  });

  it("does not flag a customer with a recent visit", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [makeVisit({ id: "warm", visitDate: isoDate(daysAgo(10)) })],
      }))
    );
    expect(result.current.staleCustomers).toHaveLength(0);
  });
});

describe("pendingEdits / pendingSupplierEdits", () => {
  it("lists a visit with a pending change, but not one currently mid-deletion", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({ id: "a", last_change: { field: "phone" } }),
          makeVisit({ id: "b", last_change: { field: "phone" } }),
        ],
        pendingDelete: { id: "b" },
      }))
    );
    expect(result.current.pendingEdits.map((v) => v.id)).toEqual(["a"]);
  });

  it("maps a supplier's `name` to `companyName` for the shared review-queue UI", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        suppliers: [{ id: "s1", name: "Supplier Co", last_change: { field: "phone" } }],
      }))
    );
    expect(result.current.pendingSupplierEdits).toEqual([
      expect.objectContaining({ id: "s1", name: "Supplier Co", companyName: "Supplier Co" }),
    ]);
  });
});

describe("duplicateGroups", () => {
  it("groups two customers sharing the same phone number", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({ id: "a", companyName: "Company One", phone: "01012345678" }),
          makeVisit({ id: "b", companyName: "Company Two", phone: "01012345678" }),
        ],
      }))
    );
    expect(result.current.duplicateGroups).toHaveLength(1);
    expect(result.current.duplicateGroups[0].reason).toBe("phone");
  });

  it("does not group two unrelated, unique customers", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({ id: "a", companyName: "Company One", phone: "01011111111" }),
          makeVisit({ id: "b", companyName: "Company Two", phone: "01022222222" }),
        ],
      }))
    );
    expect(result.current.duplicateGroups).toHaveLength(0);
  });
});

describe("filtered", () => {
  it("narrows by sector", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({ id: "a", sector: "construction" }),
          makeVisit({ id: "b", sector: "education" }),
        ],
        sectorFilter: "construction",
      }))
    );
    expect(result.current.filtered.map((v) => v.id)).toEqual(["a"]);
  });

  it("matches the search query against the company name, case-insensitively", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({ id: "a", companyName: "Golden Gate Traders" }),
          makeVisit({ id: "b", companyName: "Nile Contractors" }),
        ],
        debouncedQuery: "golden",
      }))
    );
    expect(result.current.filtered.map((v) => v.id)).toEqual(["a"]);
  });

  it("always sorts pinned customers first, regardless of status/date", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({ id: "unpinned", visitDate: isoDate(daysAgo(1)) }),
          makeVisit({ id: "pinned", isPinned: true, visitDate: isoDate(daysAgo(30)) }),
        ],
      }))
    );
    expect(result.current.filtered[0].id).toBe("pinned");
  });

  it("among unpinned customers, sorts an overdue call before one with no reminder", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        visits: [
          makeVisit({ id: "none" }),
          makeVisit({ id: "overdue", callDateTime: new Date(NOW.getTime() - 3600 * 1000).toISOString() }),
        ],
      }))
    );
    expect(result.current.filtered.map((v) => v.id)).toEqual(["overdue", "none"]);
  });
});

describe("filteredSuppliers", () => {
  it("narrows by product tag", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        suppliers: [
          { id: "s1", name: "A", tags: ["pumps"] },
          { id: "s2", name: "B", tags: ["chemicals"] },
        ],
        supplierTagFilter: "pumps",
      }))
    );
    expect(result.current.filteredSuppliers.map((s) => s.id)).toEqual(["s1"]);
  });

  it("sorts a pinned supplier first", () => {
    const { result } = renderHook(() =>
      useFilteredData(baseProps({
        suppliers: [
          { id: "s1", name: "Zebra Supplies" },
          { id: "s2", name: "Alpha Traders", isPinned: true },
        ],
      }))
    );
    expect(result.current.filteredSuppliers[0].id).toBe("s2");
  });
});

describe("availableAddedMonths auto-reset", () => {
  it("resets dateAddedFilter to \"all\" when the currently-picked month drops out of the (now filtered) options", () => {
    const setDateAddedFilter = vi.fn();
    const { rerender } = renderHook(
      (props) => useFilteredData(props),
      {
        initialProps: baseProps({
          visits: [makeVisit({ id: "a", sector: "construction", createdAt: NOW.toISOString() })],
          dateAddedFilter: "2026-06",
          setDateAddedFilter,
        }),
      }
    );

    // Narrowing to a sector with zero customers in it makes "2026-06" (the
    // currently-picked month) disappear from availableAddedMonths — the
    // effect should notice and reset the filter instead of silently
    // showing an empty list for a month no longer even in the dropdown.
    act(() => {
      rerender(baseProps({
        visits: [makeVisit({ id: "a", sector: "construction", createdAt: NOW.toISOString() })],
        sectorFilter: "education",
        dateAddedFilter: "2026-06",
        setDateAddedFilter,
      }));
    });

    expect(setDateAddedFilter).toHaveBeenCalledWith("all");
  });

  it("does not reset when the picked month is still available", () => {
    const setDateAddedFilter = vi.fn();
    renderHook(() =>
      useFilteredData(baseProps({
        visits: [makeVisit({ id: "a", createdAt: NOW.toISOString() })],
        dateAddedFilter: "2026-06",
        setDateAddedFilter,
      }))
    );
    expect(setDateAddedFilter).not.toHaveBeenCalled();
  });
});
