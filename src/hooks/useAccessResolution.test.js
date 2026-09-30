import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// useAccessResolution decides who is an owner / editor / viewer, which
// workspace is selected, and when an account with no access is signed out.
// Getting it wrong either locks people out or lets an unapproved account
// stay signed in, so these tests pin the decisions down.
//
// Firestore is mocked: onSnapshot hands us the listener callbacks so each
// test can "deliver" server / cache snapshots and errors on demand.
const mocks = vi.hoisted(() => ({
  doc: vi.fn((_db, ...segs) => ({ path: segs.join("/") })),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  signOut: vi.fn(() => Promise.resolve()),
  reportException: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: mocks.doc,
  onSnapshot: mocks.onSnapshot,
  setDoc: mocks.setDoc,
  serverTimestamp: mocks.serverTimestamp,
}));
vi.mock("firebase/auth", () => ({ signOut: mocks.signOut }));
vi.mock("../firebase", () => ({ auth: {}, db: {} }));
vi.mock("../sentry", () => ({ reportException: mocks.reportException }));

import { useAccessResolution } from "./useAccessResolution";

const DAY = 24 * 60 * 60 * 1000;

const makeUser = (overrides = {}) => ({
  uid: "me",
  email: "Me@Pest.test",
  emailVerified: true,
  metadata: { creationTime: new Date(Date.now() - 60 * 1000).toISOString() },
  ...overrides,
});

const snapOf = (data, { fromCache = false } = {}) => ({
  exists: () => data !== null,
  data: () => data,
  metadata: { fromCache },
});

// The access_by_email listener registered by the hook under test.
let listener;

function setup({ user = makeUser(), adminEmails = [] } = {}) {
  const setScreen = vi.fn();
  const setActiveId = vi.fn();
  const hook = renderHook(
    (props) => useAccessResolution({ setScreen, setActiveId, ...props }),
    { initialProps: { user, adminEmails, screen: "list" } }
  );
  return { ...hook, setScreen, setActiveId };
}

const deliver = (data, opts) => act(() => listener.next(snapOf(data, opts)));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  listener = null;
  mocks.onSnapshot.mockImplementation((_ref, next, error) => {
    listener = { next, error };
    return vi.fn();
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("before there is anything to resolve", () => {
  it("signed out: nothing is resolved, no listener, stale workspace choice is forgotten", () => {
    localStorage.setItem("pestco_selected_owner", "someone");
    const { result } = setup({ user: null, adminEmails: [] });
    expect(result.current.ownerUid).toBeNull();
    expect(result.current.myRole).toBeNull();
    expect(result.current.availableOwners).toEqual([]);
    expect(result.current.permissionLoading).toBe(false);
    expect(mocks.onSnapshot).not.toHaveBeenCalled();
    expect(localStorage.getItem("pestco_selected_owner")).toBeNull();
  });

  it("keeps loading (and doesn't decide anything) until the admin list has arrived", () => {
    const { result } = setup({ adminEmails: null });
    expect(result.current.permissionLoading).toBe(true);
    expect(mocks.onSnapshot).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("an UNVERIFIED account is signed out with the 'unverified' error and never reads access", () => {
    const { result, setScreen } = setup({ user: makeUser({ emailVerified: false }), adminEmails: ["me@pest.test"] });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(result.current.authError).toBe("unverified");
    expect(result.current.ownerUid).toBeNull();
    expect(result.current.permissionLoading).toBe(false);
    expect(setScreen).toHaveBeenCalledWith("list");
    expect(mocks.onSnapshot).not.toHaveBeenCalled();
  });

  it("looks the account up by its lower-cased, trimmed email", () => {
    setup({ user: makeUser({ email: "  Me@Pest.TEST " }), adminEmails: [] });
    expect(mocks.doc).toHaveBeenCalledWith({}, "access_by_email", "me@pest.test");
  });
});

describe("granted members", () => {
  it("an editor lands in the workspace they were granted, not in an empty one of their own", () => {
    const { result } = setup();
    deliver({ owners: { ownerA: "editor" } });
    expect(result.current.ownerUid).toBe("ownerA");
    expect(result.current.myRole).toBe("editor");
    expect(result.current.availableOwners).toEqual([{ uid: "ownerA", role: "editor" }]);
    expect(result.current.permissionLoading).toBe(false);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("a viewer stays a viewer", () => {
    const { result } = setup();
    deliver({ owners: { ownerA: "viewer" } });
    expect(result.current.myRole).toBe("viewer");
  });

  it("reads the Dashboard flag from the same document (default off)", () => {
    const { result } = setup();
    deliver({ owners: { ownerA: "viewer" }, dashboardAccess: true });
    expect(result.current.myDashboardAccess).toBe(true);
    deliver({ owners: { ownerA: "viewer" } });
    expect(result.current.myDashboardAccess).toBe(false);
  });

  it("remembers the selected workspace for next time", () => {
    setup();
    deliver({ owners: { ownerA: "editor" } });
    expect(localStorage.getItem("pestco_selected_owner")).toBe("ownerA");
  });

  it("restores the saved workspace when the account has several", () => {
    localStorage.setItem("pestco_selected_owner", "ownerB");
    const { result } = setup();
    deliver({ owners: { ownerA: "editor", ownerB: "viewer" } });
    expect(result.current.ownerUid).toBe("ownerB");
    expect(result.current.myRole).toBe("viewer");
  });

  it("falls back to the first workspace if the saved one is gone", () => {
    localStorage.setItem("pestco_selected_owner", "ownerGone");
    const { result } = setup();
    deliver({ owners: { ownerA: "editor", ownerB: "viewer" } });
    expect(result.current.ownerUid).toBe("ownerA");
  });

  it("a role change is picked up live", () => {
    const { result } = setup();
    deliver({ owners: { ownerA: "editor" } });
    deliver({ owners: { ownerA: "viewer" } });
    expect(result.current.ownerUid).toBe("ownerA");
    expect(result.current.myRole).toBe("viewer");
  });
});

describe("admins", () => {
  it("an admin with no grants owns a workspace under their own uid", () => {
    const { result } = setup({ adminEmails: ["me@pest.test"] });
    deliver(null);
    expect(result.current.ownerUid).toBe("me");
    expect(result.current.myRole).toBe("owner");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("an admin who was granted access elsewhere does NOT get a phantom workspace of their own", () => {
    const { result } = setup({ adminEmails: ["me@pest.test"] });
    deliver({ owners: { ownerA: "viewer" } });
    expect(result.current.availableOwners).toEqual([{ uid: "ownerA", role: "viewer" }]);
    expect(result.current.myRole).toBe("viewer");
  });
});

describe("accounts with no access", () => {
  it("a non-admin nobody granted anything to is signed out with the 'not registered' error", () => {
    const { result, setActiveId } = setup();
    deliver(null);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(result.current.authError).toBe(true);
    expect(result.current.ownerUid).toBeNull();
    expect(result.current.availableOwners).toEqual([]);
    expect(result.current.permissionLoading).toBe(false);
    expect(setActiveId).toHaveBeenCalledWith(null);
  });

  it("a NEW verified account gets its pending signup (re)written before sign-out", () => {
    setup();
    deliver(null);
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
    expect(mocks.setDoc).toHaveBeenCalledWith(
      { path: "signups/me" },
      { email: "me@pest.test", createdAt: "SERVER_TS" }
    );
  });

  it("an OLD account (dismissed / revoked) is signed out without resurrecting a pending signup", () => {
    setup({ user: makeUser({ metadata: { creationTime: new Date(Date.now() - 3 * DAY).toISOString() } }) });
    deliver(null);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it("an existing signup doc (permission-denied on the rewrite) is not reported as an error", async () => {
    mocks.setDoc.mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "permission-denied" }));
    setup();
    deliver(null);
    await act(async () => {});
    expect(mocks.reportException).not.toHaveBeenCalled();
  });

  it("any other failure of the signup rewrite IS reported", async () => {
    mocks.setDoc.mockRejectedValueOnce(Object.assign(new Error("boom"), { code: "unavailable" }));
    setup();
    deliver(null);
    await act(async () => {});
    expect(mocks.reportException).toHaveBeenCalledTimes(1);
  });

  it("revoking access live signs the member out", () => {
    const { result } = setup();
    deliver({ owners: { ownerA: "editor" } });
    expect(result.current.ownerUid).toBe("ownerA");
    deliver({ owners: {} });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(result.current.ownerUid).toBeNull();
    expect(result.current.myRole).toBeNull();
  });

  it("an admin whose external grant is revoked stays signed in (they still review signups) — no phantom workspace, no sign-out", () => {
    const { result } = setup({ adminEmails: ["me@pest.test"] });
    deliver({ owners: { ownerA: "viewer" } });
    expect(result.current.ownerUid).toBe("ownerA");
    deliver({ owners: {} });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(result.current.ownerUid).toBeNull();
    expect(result.current.availableOwners).toEqual([]);
    expect(result.current.permissionLoading).toBe(false);
  });
});

describe("stale cache vs. confirmed server data", () => {
  it("never signs anyone out because of a provisional CACHED 'no access' read", () => {
    const { result } = setup();
    deliver(null, { fromCache: true });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(result.current.permissionLoading).toBe(true);
  });

  it("a cached snapshot alone doesn't apply anything immediately", () => {
    const { result } = setup();
    deliver({ owners: { ownerA: "editor" } }, { fromCache: true });
    expect(result.current.ownerUid).toBeNull();
    expect(result.current.permissionLoading).toBe(true);
  });

  it("if the server never answers, cached VALID access is applied after 8s so the app isn't stuck loading", () => {
    vi.useFakeTimers();
    const { result } = setup();
    deliver({ owners: { ownerA: "editor" } }, { fromCache: true });
    act(() => vi.advanceTimersByTime(7999));
    expect(result.current.permissionLoading).toBe(true);
    act(() => vi.advanceTimersByTime(2));
    expect(result.current.ownerUid).toBe("ownerA");
    expect(result.current.permissionLoading).toBe(false);
  });

  it("…but a cached 'no access' is still never acted on, even after the 8s fallback", () => {
    vi.useFakeTimers();
    setup();
    deliver(null, { fromCache: true });
    act(() => vi.advanceTimersByTime(10000));
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("a confirmed server snapshot cancels the fallback and wins over the cached one", () => {
    vi.useFakeTimers();
    const { result } = setup();
    deliver({ owners: { ownerA: "editor" } }, { fromCache: true });
    deliver({ owners: { ownerB: "viewer" } });
    act(() => vi.advanceTimersByTime(20000));
    expect(result.current.ownerUid).toBe("ownerB");
    expect(result.current.myRole).toBe("viewer");
  });
});

describe("listener failure", () => {
  it("clears everything and reports it, but doesn't sign the user out", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, setScreen } = setup();
    deliver({ owners: { ownerA: "editor" } });
    act(() => listener.error(new Error("permission-denied")));
    expect(result.current.ownerUid).toBeNull();
    expect(result.current.myRole).toBeNull();
    expect(result.current.availableOwners).toEqual([]);
    expect(result.current.permissionLoading).toBe(false);
    expect(mocks.reportException).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(setScreen).toHaveBeenCalledWith("list");
    errSpy.mockRestore();
  });
});

describe("switching workspace", () => {
  it("moves to another workspace the account really has, with that workspace's role", () => {
    const { result, setScreen, setActiveId } = setup();
    deliver({ owners: { ownerA: "editor", ownerB: "viewer" } });
    act(() => result.current.switchOwnerWorkspace("ownerB"));
    expect(result.current.ownerUid).toBe("ownerB");
    expect(result.current.myRole).toBe("viewer");
    expect(setScreen).toHaveBeenCalledWith("list");
    expect(setActiveId).toHaveBeenCalledWith(null);
    expect(localStorage.getItem("pestco_selected_owner")).toBe("ownerB");
  });

  it("refuses a workspace the account has no access to", () => {
    const { result } = setup();
    deliver({ owners: { ownerA: "editor" } });
    act(() => result.current.switchOwnerWorkspace("someone-elses"));
    expect(result.current.ownerUid).toBe("ownerA");
    expect(result.current.myRole).toBe("editor");
  });

  it("the switched workspace survives the next live snapshot", () => {
    const { result } = setup();
    deliver({ owners: { ownerA: "editor", ownerB: "viewer" } });
    act(() => result.current.switchOwnerWorkspace("ownerB"));
    deliver({ owners: { ownerA: "editor", ownerB: "viewer" } });
    expect(result.current.ownerUid).toBe("ownerB");
  });
});

describe("email-less accounts", () => {
  it("an account without an email is the owner of its own uid (no lookup possible)", () => {
    const { result } = setup({ user: makeUser({ email: "" }) });
    expect(result.current.ownerUid).toBe("me");
    expect(result.current.myRole).toBe("owner");
    expect(result.current.permissionLoading).toBe(false);
    expect(mocks.onSnapshot).not.toHaveBeenCalled();
  });
});
