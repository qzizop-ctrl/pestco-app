import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// useLiveData keeps the customers / suppliers in sync. The behaviour pinned
// down here: an EMPTY snapshot served from the local cache is not an answer
// ("no customers") — it can just mean the cache is empty and the server has
// not been reached yet — and a load that never completes is reported
// (visitsTimedOut) instead of spinning forever.
const mocks = vi.hoisted(() => ({
  collection: vi.fn((_db, ...segs) => ({ path: segs.join("/") })),
  onSnapshot: vi.fn(),
  reportException: vi.fn(),
  reportWarning: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({ collection: mocks.collection, onSnapshot: mocks.onSnapshot }));
vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../sentry", () => ({ reportException: mocks.reportException, reportWarning: mocks.reportWarning }));

import { useLiveData } from "./useLiveData";

// A minimal QuerySnapshot as applySnapshot / useLiveData use it.
function snapOf(docs, { fromCache = false } = {}) {
  const wrapped = docs.map((d) => ({ id: d.id, data: () => { const { id: _id, ...rest } = d; return rest; } }));
  return {
    size: wrapped.length,
    empty: wrapped.length === 0,
    metadata: { fromCache },
    docs: wrapped,
    docChanges: () => wrapped.map((doc) => ({ type: "added", doc })),
  };
}

let listeners; // path -> { next, error }

function setup() {
  return renderHook(() => useLiveData({ uid: "u" }, "owner1"));
}

const send = (path, snap) => act(() => listeners[path].next(snap));

beforeEach(() => {
  vi.clearAllMocks();
  listeners = {};
  mocks.onSnapshot.mockImplementation((ref, next, error) => {
    listeners[ref.path] = { next, error };
    return vi.fn();
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLiveData — cached-empty snapshots", () => {
  it("does not treat an empty cache-only snapshot as 'loaded' (no false 'no customers')", () => {
    const { result } = setup();
    send("users/owner1/visits", snapOf([], { fromCache: true }));
    expect(result.current.loaded).toBe(false);
    expect(result.current.visits).toEqual([]);
  });

  it("a server-confirmed empty snapshot IS a real 'no customers'", () => {
    const { result } = setup();
    send("users/owner1/visits", snapOf([], { fromCache: true }));
    send("users/owner1/visits", snapOf([], { fromCache: false }));
    expect(result.current.loaded).toBe(true);
    expect(result.current.visits).toEqual([]);
  });

  it("a NON-empty cached snapshot is applied immediately (offline start with data still works)", () => {
    const { result } = setup();
    send("users/owner1/visits", snapOf([{ id: "a", companyName: "Acme" }], { fromCache: true }));
    expect(result.current.loaded).toBe(true);
    expect(result.current.visits).toHaveLength(1);
  });

  it("once real data has been applied, a later empty snapshot is applied too (records really removed)", () => {
    const { result } = setup();
    send("users/owner1/visits", snapOf([{ id: "a", companyName: "Acme" }]));
    send("users/owner1/visits", snapOf([], { fromCache: true }));
    expect(result.current.visits).toEqual([]);
    expect(result.current.loaded).toBe(true);
  });

  it("applies the same rule to suppliers", () => {
    const { result } = setup();
    send("users/owner1/suppliers", snapOf([], { fromCache: true }));
    expect(result.current.suppliersLoaded).toBe(false);
    send("users/owner1/suppliers", snapOf([], { fromCache: false }));
    expect(result.current.suppliersLoaded).toBe(true);
  });
});

describe("useLiveData — never-ending loads", () => {
  it("reports visitsTimedOut after 12s without a real answer", () => {
    vi.useFakeTimers();
    const { result } = setup();
    send("users/owner1/visits", snapOf([], { fromCache: true }));
    act(() => vi.advanceTimersByTime(11999));
    expect(result.current.visitsTimedOut).toBe(false);
    act(() => vi.advanceTimersByTime(2));
    expect(result.current.visitsTimedOut).toBe(true);
    expect(result.current.loaded).toBe(false);
  });

  it("a real answer clears the timeout state and stops the timer", () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => vi.advanceTimersByTime(12001));
    expect(result.current.visitsTimedOut).toBe(true);
    send("users/owner1/visits", snapOf([{ id: "a", companyName: "Acme" }]));
    expect(result.current.visitsTimedOut).toBe(false);
    expect(result.current.loaded).toBe(true);
  });

  it("retryLiveData re-subscribes and resets the timeout", () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => vi.advanceTimersByTime(12001));
    const before = mocks.onSnapshot.mock.calls.length;
    act(() => result.current.retryLiveData());
    expect(mocks.onSnapshot.mock.calls.length).toBe(before + 2); // visits + suppliers
    expect(result.current.visitsTimedOut).toBe(false);
  });

  it("an error is still surfaced as loaded + visitsError (unchanged behaviour)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = setup();
    act(() => listeners["users/owner1/visits"].error(Object.assign(new Error("denied"), { code: "permission-denied" })));
    expect(result.current.loaded).toBe(true);
    expect(result.current.visitsError).toBeTruthy();
    expect(result.current.visitsTimedOut).toBe(false);
    errSpy.mockRestore();
  });
});
