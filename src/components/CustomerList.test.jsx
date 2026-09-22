import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { STRINGS } from "../i18n";
import { SECTOR_IDS } from "../domain";
import CustomerListScreen from "./CustomerList";

// ---------------------------------------------------------------------------
// CustomerListScreen is the main list/search/filter screen — this is its
// first test coverage. It's a big "screen" component (composes AlertsCenter,
// FilterSheet, PendingEditsSheet, VisitCard...), so these tests deliberately
// stick to the happy-path default state of its own children (filter sheets
// closed, alerts center empty) rather than re-testing those components'
// internals, which already belong to their own files. What's covered here is
// CustomerListScreen's own responsibility: wiring props through, showing the
// right state (loading/empty/list), and calling the right callbacks.
// ---------------------------------------------------------------------------

const t = STRINGS.en;

function makeSectorCounts(overrides = {}) {
  return SECTOR_IDS.reduce((acc, id) => ({ ...acc, [id]: 0, ...overrides }), {});
}

// Every prop CustomerListScreen reads directly (see its destructured param
// list) needs a value here, or a prop-specific override per test — this
// mirrors the shape App.jsx actually passes it.
function baseProps(overrides = {}) {
  return {
    t,
    isOnline: true,
    dueReminders: [],
    staleCustomers: [],
    openDetail: vi.fn(),
    query: "",
    setQuery: vi.fn(),
    totalCustomers: 0,
    sectorCounts: makeSectorCounts(),
    sectorFilter: "all",
    setSectorFilter: vi.fn(),
    stageFilter: "all",
    setStageFilter: vi.fn(),
    allTags: [],
    tagFilter: "all",
    setTagFilter: vi.fn(),
    missingDataOnly: false,
    setMissingDataOnly: vi.fn(),
    missingDataCount: 0,
    noVisitsOnly: false,
    setNoVisitsOnly: vi.fn(),
    noVisitsCount: 0,
    dateAddedFilter: "all",
    setDateAddedFilter: vi.fn(),
    availableAddedMonths: [],
    dateAddedScopeTotal: 0,
    loaded: true,
    filtered: [],
    togglePin: vi.fn(),
    canEdit: true,
    openNew: vi.fn(),
    isOwnerAccount: false,
    pendingEdits: [],
    openPendingEditItem: vi.fn(),
    ...overrides,
  };
}

function makeVisit(overrides = {}) {
  return {
    id: "v1",
    companyName: "Acme Pest Solutions",
    sector: "private",
    stage: "",
    tags: [],
    phone: "",
    email: "",
    isPinned: false,
    ...overrides,
  };
}

describe("CustomerListScreen", () => {
  it("shows a skeleton placeholder instead of the list while data is still loading", () => {
    const { container } = render(
      <CustomerListScreen {...baseProps({ loaded: false, filtered: [] })} />
    );
    // SkeletonList renders its rows inside an aria-hidden wrapper — assert
    // via the shimmer placeholders rather than any real customer text,
    // since none should be in the DOM yet.
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText(t.noVisits)).not.toBeInTheDocument();
  });

  it("shows the empty state once loaded with no results, not the skeleton", () => {
    const { container } = render(
      <CustomerListScreen {...baseProps({ loaded: true, filtered: [] })} />
    );
    expect(screen.getByText(t.noVisits)).toBeInTheDocument();
    expect(screen.getByText(t.noVisitsHint)).toBeInTheDocument();
    expect(container.querySelectorAll(".skeleton").length).toBe(0);
  });

  it("renders a VisitCard for each customer in the filtered list", () => {
    const filtered = [
      makeVisit({ id: "v1", companyName: "Acme Pest Solutions" }),
      makeVisit({ id: "v2", companyName: "Nile Facilities Co" }),
    ];
    render(<CustomerListScreen {...baseProps({ filtered })} />);
    expect(screen.getByText("Acme Pest Solutions")).toBeInTheDocument();
    expect(screen.getByText("Nile Facilities Co")).toBeInTheDocument();
    expect(screen.queryByText(t.noVisits)).not.toBeInTheDocument();
  });

  it("calls openDetail with the visit when a customer card is tapped", () => {
    const openDetail = vi.fn();
    const visit = makeVisit({ id: "v1", companyName: "Acme Pest Solutions" });
    render(<CustomerListScreen {...baseProps({ filtered: [visit], openDetail })} />);
    fireEvent.click(screen.getByText("Acme Pest Solutions"));
    expect(openDetail).toHaveBeenCalledWith(visit);
  });

  it("calls setQuery as the user types in the search box", () => {
    const setQuery = vi.fn();
    render(<CustomerListScreen {...baseProps({ setQuery })} />);
    fireEvent.change(screen.getByPlaceholderText(t.searchPlaceholder), {
      target: { value: "Acme" },
    });
    expect(setQuery).toHaveBeenCalledWith("Acme");
  });

  it("shows the new-customer button when the user can edit, and wires it to openNew", () => {
    const openNew = vi.fn();
    render(<CustomerListScreen {...baseProps({ canEdit: true, openNew })} />);
    const btn = screen.getByLabelText(t.newVisit);
    fireEvent.click(btn);
    expect(openNew).toHaveBeenCalled();
  });

  it("hides the new-customer button for read-only (viewer) accounts", () => {
    render(<CustomerListScreen {...baseProps({ canEdit: false })} />);
    expect(screen.queryByLabelText(t.newVisit)).not.toBeInTheDocument();
  });

  it("shows the pin toggle on each card when the user can edit, and calls togglePin", () => {
    const togglePin = vi.fn();
    const visit = makeVisit({ id: "v1", companyName: "Acme Pest Solutions", isPinned: false });
    render(<CustomerListScreen {...baseProps({ filtered: [visit], canEdit: true, togglePin })} />);
    fireEvent.click(screen.getByLabelText(t.pinBtn));
    expect(togglePin).toHaveBeenCalledWith(visit);
  });

  it("hides the pin toggle entirely for read-only (viewer) accounts", () => {
    const visit = makeVisit({ id: "v1", companyName: "Acme Pest Solutions" });
    render(<CustomerListScreen {...baseProps({ filtered: [visit], canEdit: false })} />);
    expect(screen.queryByLabelText(t.pinBtn)).not.toBeInTheDocument();
  });

  it("shows the active-filter count badge only once a filter is applied", () => {
    const { rerender } = render(
      <CustomerListScreen {...baseProps({ sectorFilter: "all", stageFilter: "all" })} />
    );
    // "1" only appears once a filter is active; nothing to find beforehand.
    expect(screen.queryByText("1")).not.toBeInTheDocument();

    rerender(<CustomerListScreen {...baseProps({ sectorFilter: "construction" })} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows the total customer count in the sector-breakdown summary", () => {
    render(<CustomerListScreen {...baseProps({ totalCustomers: 7 })} />);
    expect(screen.getByText(t.totalCustomersLabel)).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
