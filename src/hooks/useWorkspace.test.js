import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// useWorkspace is the orchestrator: it turns the raw answers of four
// listeners (admin list, access resolution, members, pending signups) plus
// the auth user into the flags the whole UI trusts — canEdit,
// isOwnerAccount, canViewDashboard, isReviewer, isPrimaryAdmin — and bounces
// people off screens they must not see. The four sub-hooks have their own
// concerns, so they are mocked here and each test sets what they "return".
const mocks = vi.hoisted(() => ({
  authCallback: null,
  onAuthStateChanged: vi.fn(),
  adminConfig: { adminEmails: [], primaryAdminEmail: null },
  access: {},
  members: { members: {}, dashboardAccess: {} },
  pendingSignups: [],
  usePendingSignups: vi.fn(),
}));

vi.mock("firebase/auth", () => ({ onAuthStateChanged: mocks.onAuthStateChanged }));
vi.mock("../firebase", () => ({ auth: {} }));
vi.mock("./useAdminConfig", () => ({ useAdminConfig: () => mocks.adminConfig }));
vi.mock("./useAccessResolution", () => ({ useAccessResolution: () => mocks.access }));
vi.mock("./useMembersAccess", () => ({ useMembersAccess: () => mocks.members }));
vi.mock("./usePendingSignups", () => ({
  usePendingSignups: (args) => {
    mocks.usePendingSignups(args);
    return mocks.pendingSignups;
  },
}));

import { useWorkspace } from "./useWorkspace";

const USER = { uid: "me", email: "Me@Pest.test" };

function access(overrides = {}) {
  return {
    ownerUid: "owner1",
    myRole: "viewer",
    myDashboardAccess: false,
    availableOwners: [],
    permissionLoading: false,
    authError: false,
    clearAuthError: vi.fn(),
    switchOwnerWorkspace: vi.fn(),
    ...overrides,
  };
}

// Mirrors the real startup order: permissions stay "loading" until auth has
// answered, THEN resolve. (Rendering with permissionLoading already false
// before the user exists is a state the app never has, and made the screen
// guards fire on a signed-out first render.) A test that passes
// permissionLoading: true keeps it loading for the whole test.
function setup({ screen = "list", signedIn = true, ...accessOverrides } = {}) {
  const setScreen = vi.fn();
  const setActiveId = vi.fn();
  mocks.access = access({ ...accessOverrides, permissionLoading: true });
  const hook = renderHook(
    (props) => useWorkspace({ setActiveId, setScreen, ...props }),
    { initialProps: { screen } }
  );
  act(() => mocks.authCallback(signedIn ? USER : null));
  mocks.access = access(accessOverrides);
  hook.rerender({ screen });
  return { ...hook, setScreen, setActiveId };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminConfig = { adminEmails: [], primaryAdminEmail: null };
  mocks.members = { members: {}, dashboardAccess: {} };
  mocks.pendingSignups = [];
  mocks.onAuthStateChanged.mockImplementation((_auth, cb) => {
    mocks.authCallback = cb;
    return vi.fn();
  });
});

describe("authentication", () => {
  it("authChecked flips to true only once Firebase has answered, and exposes the user", () => {
    mocks.access = access();
    const { result } = renderHook(() => useWorkspace({ screen: "list", setScreen: vi.fn(), setActiveId: vi.fn() }));
    expect(result.current.authChecked).toBe(false);
    expect(result.current.user).toBeNull();
    act(() => mocks.authCallback(USER));
    expect(result.current.authChecked).toBe(true);
    expect(result.current.user).toBe(USER);
  });

  it("unsubscribes from auth on unmount", () => {
    const unsub = vi.fn();
    mocks.onAuthStateChanged.mockImplementation((_a, cb) => {
      mocks.authCallback = cb;
      return unsub;
    });
    mocks.access = access();
    const { unmount } = renderHook(() => useWorkspace({ screen: "list", setScreen: vi.fn(), setActiveId: vi.fn() }));
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});

describe("role flags", () => {
  it("owner: can edit, is the owner account, always sees the Dashboard", () => {
    const { result } = setup({ myRole: "owner" });
    expect(result.current.canEdit).toBe(true);
    expect(result.current.isOwnerAccount).toBe(true);
    expect(result.current.canViewDashboard).toBe(true);
  });

  it("editor: can edit, is NOT the owner, Dashboard only if turned on for them", () => {
    let r = setup({ myRole: "editor", myDashboardAccess: false }).result;
    expect(r.current.canEdit).toBe(true);
    expect(r.current.isOwnerAccount).toBe(false);
    expect(r.current.canViewDashboard).toBe(false);
    r = setup({ myRole: "editor", myDashboardAccess: true }).result;
    expect(r.current.canViewDashboard).toBe(true);
  });

  it("viewer: can't edit, isn't the owner", () => {
    const { result } = setup({ myRole: "viewer" });
    expect(result.current.canEdit).toBe(false);
    expect(result.current.isOwnerAccount).toBe(false);
  });

  it("no role at all grants nothing", () => {
    const { result } = setup({ myRole: null, ownerUid: null });
    expect(result.current.canEdit).toBe(false);
    expect(result.current.isOwnerAccount).toBe(false);
    expect(result.current.canViewDashboard).toBe(false);
  });

  it("while permissions are still loading nobody can edit or own anything (no flash of edit controls)", () => {
    const { result } = setup({ myRole: "owner", permissionLoading: true });
    expect(result.current.canEdit).toBe(false);
    expect(result.current.isOwnerAccount).toBe(false);
  });

  it("the Dashboard flag is strictly `=== true` (a truthy non-boolean doesn't count)", () => {
    const { result } = setup({ myRole: "viewer", myDashboardAccess: "yes" });
    expect(result.current.canViewDashboard).toBe(false);
  });
});

describe("admin flags", () => {
  it("isReviewer follows the admin list, case/whitespace-insensitively", () => {
    mocks.adminConfig = { adminEmails: ["me@pest.test"], primaryAdminEmail: null };
    expect(setup().result.current.isReviewer).toBe(true);
    mocks.adminConfig = { adminEmails: ["someone@else.test"], primaryAdminEmail: null };
    expect(setup().result.current.isReviewer).toBe(false);
  });

  it("an admin is not automatically an owner (being an admin doesn't open someone else's workspace)", () => {
    mocks.adminConfig = { adminEmails: ["me@pest.test"], primaryAdminEmail: "me@pest.test" };
    const { result } = setup({ myRole: "viewer" });
    expect(result.current.isReviewer).toBe(true);
    expect(result.current.isOwnerAccount).toBe(false);
    expect(result.current.canEdit).toBe(false);
  });

  it("only the account matching primaryEmail is the primary admin", () => {
    mocks.adminConfig = { adminEmails: ["me@pest.test", "b@pest.test"], primaryAdminEmail: "me@pest.test" };
    expect(setup().result.current.isPrimaryAdmin).toBe(true);
    mocks.adminConfig = { adminEmails: ["me@pest.test", "b@pest.test"], primaryAdminEmail: "b@pest.test" };
    expect(setup().result.current.isPrimaryAdmin).toBe(false);
  });

  it("signed out: neither reviewer nor primary admin, even if the admin list has their email", () => {
    mocks.adminConfig = { adminEmails: ["me@pest.test"], primaryAdminEmail: "me@pest.test" };
    const { result } = setup({ signedIn: false });
    expect(result.current.isReviewer).toBe(false);
    expect(result.current.isPrimaryAdmin).toBe(false);
  });

  it("pending signups are only loaded for reviewers", () => {
    mocks.adminConfig = { adminEmails: [], primaryAdminEmail: null };
    setup();
    expect(mocks.usePendingSignups).toHaveBeenLastCalledWith(expect.objectContaining({ isReviewer: false }));
    mocks.adminConfig = { adminEmails: ["me@pest.test"], primaryAdminEmail: null };
    setup();
    expect(mocks.usePendingSignups).toHaveBeenLastCalledWith(expect.objectContaining({ isReviewer: true }));
  });
});

describe("screen guards", () => {
  it("a viewer who lands on Settings is sent back to the list", () => {
    const { setScreen } = setup({ screen: "settings", myRole: "viewer" });
    expect(setScreen).toHaveBeenCalledWith("list");
  });

  it("an editor on Settings is sent back too", () => {
    const { setScreen } = setup({ screen: "settings", myRole: "editor" });
    expect(setScreen).toHaveBeenCalledWith("list");
  });

  it("the owner may stay on Settings", () => {
    const { setScreen } = setup({ screen: "settings", myRole: "owner" });
    expect(setScreen).not.toHaveBeenCalled();
  });

  it("an admin who isn't an owner may stay on Settings (signups / admin list)", () => {
    mocks.adminConfig = { adminEmails: ["me@pest.test"], primaryAdminEmail: null };
    const { setScreen } = setup({ screen: "settings", myRole: "viewer" });
    expect(setScreen).not.toHaveBeenCalled();
  });

  it("no redirect while permissions are loading (would bounce the owner on every cold start)", () => {
    const { setScreen } = setup({ screen: "settings", myRole: "viewer", permissionLoading: true });
    expect(setScreen).not.toHaveBeenCalled();
  });

  it("someone without Dashboard access is bounced off the Dashboard", () => {
    const { setScreen } = setup({ screen: "dashboard", myRole: "editor", myDashboardAccess: false });
    expect(setScreen).toHaveBeenCalledWith("list");
  });

  it("the owner and members who were granted the Dashboard may stay", () => {
    let r = setup({ screen: "dashboard", myRole: "owner" });
    expect(r.setScreen).not.toHaveBeenCalled();
    r = setup({ screen: "dashboard", myRole: "viewer", myDashboardAccess: true });
    expect(r.setScreen).not.toHaveBeenCalled();
  });

  it("losing Dashboard access while on it bounces live", () => {
    mocks.access = access({ myRole: "viewer", myDashboardAccess: true });
    const setScreen = vi.fn();
    const { rerender } = renderHook((p) => useWorkspace({ screen: "dashboard", setScreen, setActiveId: vi.fn(), ...p }), {
      initialProps: {},
    });
    act(() => mocks.authCallback(USER));
    expect(setScreen).not.toHaveBeenCalled();
    mocks.access = access({ myRole: "viewer", myDashboardAccess: false });
    rerender({});
    expect(setScreen).toHaveBeenCalledWith("list");
  });
});

describe("passthrough", () => {
  it("exposes what the sub-hooks resolved, unchanged", () => {
    mocks.members = { members: { "a@b.test": "editor" }, dashboardAccess: { "a@b.test": true } };
    mocks.pendingSignups = [{ uid: "x", email: "x@y.test" }];
    mocks.adminConfig = { adminEmails: ["me@pest.test"], primaryAdminEmail: "me@pest.test" };
    const { result } = setup({ ownerUid: "owner9", availableOwners: [{ uid: "owner9", role: "viewer" }], authError: "unverified" });
    expect(result.current.ownerUid).toBe("owner9");
    expect(result.current.availableOwners).toEqual([{ uid: "owner9", role: "viewer" }]);
    expect(result.current.authError).toBe("unverified");
    expect(result.current.members).toEqual({ "a@b.test": "editor" });
    expect(result.current.dashboardAccess).toEqual({ "a@b.test": true });
    expect(result.current.pendingSignups).toEqual([{ uid: "x", email: "x@y.test" }]);
    expect(result.current.adminEmails).toEqual(["me@pest.test"]);
    expect(result.current.primaryAdminEmail).toBe("me@pest.test");
  });
});
