import { describe, it, expect, vi, beforeEach } from "vitest";

// useAccessManagement is the "write side" of the permission system: it is
// what actually changes who can see the workspace (grant/revoke, Dashboard
// toggle, signup review, admin list). The pure predicates it relies on
// (canGrantAccess, canRemoveAdmin, ...) are covered in adminPermissions.test.js;
// these tests cover what that file can't — that the HOOK enforces them
// before touching Firestore, and that what it writes is exactly right
// (in particular that one member's change never wipes another's settings).
//
// The hook contains no React state or effects (it only returns closures),
// so it is called directly instead of through renderHook.
//
// Firestore is mocked. `tx` stands in for a transaction: get() returns the
// "server copy" of access/{ownerUid} (set per test), set() records what
// would be written back.
const mocks = vi.hoisted(() => {
  const tx = { get: vi.fn(), set: vi.fn() };
  return {
    tx,
    doc: vi.fn((...args) => ({ path: args.slice(1).join("/") })),
    runTransaction: vi.fn(async (_db, fn) => fn(tx)),
    deleteDoc: vi.fn(() => Promise.resolve()),
    setDoc: vi.fn(() => Promise.resolve()),
    arrayUnion: vi.fn((...items) => ({ __arrayUnion: items })),
    arrayRemove: vi.fn((...items) => ({ __arrayRemove: items })),
    reportException: vi.fn(),
  };
});

vi.mock("firebase/firestore", () => ({
  doc: mocks.doc,
  runTransaction: mocks.runTransaction,
  deleteDoc: mocks.deleteDoc,
  setDoc: mocks.setDoc,
  arrayUnion: mocks.arrayUnion,
  arrayRemove: mocks.arrayRemove,
}));
vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../sentry", () => ({ reportException: mocks.reportException }));

import { useAccessManagement } from "./useAccessManagement";

const snap = (data) => ({ exists: () => data !== undefined, data: () => data });

function makeHook(overrides = {}) {
  const props = {
    user: { uid: "owner1" },
    isOwnerAccount: true,
    isReviewer: true,
    isPrimaryAdmin: true,
    primaryAdminEmail: "boss@x.com",
    adminEmails: ["boss@x.com", "second@x.com"],
    requireOnline: vi.fn(() => true),
    reportError: vi.fn(),
    ...overrides,
  };
  return { api: useAccessManagement(props), props };
}

const ACCESS = { path: "access/owner1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.tx.get.mockResolvedValue(snap(undefined));
});

describe("grantAccess", () => {
  it("writes the member into access/{owner} and the reverse lookup, Dashboard off by default", async () => {
    mocks.tx.get.mockResolvedValue(snap({ members: {} }));
    const { api } = makeHook();
    await api.grantAccess("new@x.com", "editor");

    expect(mocks.tx.set).toHaveBeenCalledWith(ACCESS, { members: { "new@x.com": "editor" } }, { merge: true });
    expect(mocks.tx.set).toHaveBeenCalledWith(
      { path: "access_by_email/new@x.com" },
      { owners: { owner1: "editor" }, dashboardAccess: false }
    );
  });

  it("creates the access doc when it doesn't exist yet", async () => {
    const { api } = makeHook();
    await api.grantAccess("new@x.com", "viewer");
    expect(mocks.tx.set).toHaveBeenCalledWith(ACCESS, { members: { "new@x.com": "viewer" } }, { merge: true });
  });

  it("normalizes the email (trim + lowercase) for both documents", async () => {
    const { api } = makeHook();
    await api.grantAccess("  New@X.COM ", "viewer");
    expect(mocks.tx.set.mock.calls[0][1]).toEqual({ members: { "new@x.com": "viewer" } });
    expect(mocks.tx.set.mock.calls[1][0]).toEqual({ path: "access_by_email/new@x.com" });
  });

  it("keeps other members and preserves this member's Dashboard access when only the role changes", async () => {
    mocks.tx.get.mockResolvedValue(
      snap({
        members: { "a@x.com": "viewer", "b@x.com": "editor" },
        dashboardAccess: { "a@x.com": true },
      })
    );
    const { api } = makeHook();
    await api.grantAccess("a@x.com", "editor");

    expect(mocks.tx.set).toHaveBeenCalledWith(
      ACCESS,
      { members: { "a@x.com": "editor", "b@x.com": "editor" } },
      { merge: true }
    );
    expect(mocks.tx.set).toHaveBeenCalledWith(
      { path: "access_by_email/a@x.com" },
      { owners: { owner1: "editor" }, dashboardAccess: true }
    );
  });

  it("doesn't hand a brand-new member Dashboard access just because others have it", async () => {
    mocks.tx.get.mockResolvedValue(
      snap({ members: { "a@x.com": "viewer" }, dashboardAccess: { "a@x.com": true } })
    );
    const { api } = makeHook();
    await api.grantAccess("fresh@x.com", "viewer");
    expect(mocks.tx.set).toHaveBeenCalledWith(
      { path: "access_by_email/fresh@x.com" },
      { owners: { owner1: "viewer" }, dashboardAccess: false }
    );
  });

  it("does nothing for a non-owner account", async () => {
    const { api } = makeHook({ isOwnerAccount: false });
    await api.grantAccess("new@x.com", "editor");
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("does nothing without a signed-in user", async () => {
    const { api } = makeHook({ user: null });
    await api.grantAccess("new@x.com", "editor");
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("refuses a role that isn't editor/viewer (no way to grant 'owner' or 'admin')", async () => {
    const { api } = makeHook();
    await api.grantAccess("new@x.com", "owner");
    await api.grantAccess("new@x.com", "admin");
    await api.grantAccess("new@x.com", undefined);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("refuses an empty / whitespace email", async () => {
    const { api } = makeHook();
    await api.grantAccess("   ", "editor");
    await api.grantAccess("", "editor");
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("does nothing while offline", async () => {
    const { api } = makeHook({ requireOnline: vi.fn(() => false) });
    await api.grantAccess("new@x.com", "editor");
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("reports a failed transaction to the UI and Sentry instead of failing silently", async () => {
    const boom = new Error("permission-denied");
    mocks.runTransaction.mockRejectedValueOnce(boom);
    const { api, props } = makeHook();
    await expect(api.grantAccess("new@x.com", "editor")).resolves.toBeUndefined();
    expect(props.reportError).toHaveBeenCalledWith(boom);
    expect(mocks.reportException).toHaveBeenCalled();
  });
});

describe("revokeAccess", () => {
  it("removes only that member and keeps everyone else's role and Dashboard setting", async () => {
    mocks.tx.get.mockResolvedValue(
      snap({
        members: { "a@x.com": "viewer", "b@x.com": "editor" },
        dashboardAccess: { "a@x.com": true, "b@x.com": true },
      })
    );
    const { api } = makeHook();
    await api.revokeAccess("A@x.com");

    // merge:false replaces the whole document, so the survivors' data must
    // be re-included or it would be wiped.
    expect(mocks.tx.set).toHaveBeenCalledWith(
      ACCESS,
      { members: { "b@x.com": "editor" }, dashboardAccess: { "b@x.com": true } },
      { merge: false }
    );
    expect(mocks.tx.set).toHaveBeenCalledWith(
      { path: "access_by_email/a@x.com" },
      { owners: {}, dashboardAccess: false },
      { merge: false }
    );
  });

  it("is safe when the access doc doesn't exist", async () => {
    const { api } = makeHook();
    await api.revokeAccess("a@x.com");
    expect(mocks.tx.set).toHaveBeenCalledWith(
      ACCESS,
      { members: {}, dashboardAccess: {} },
      { merge: false }
    );
  });

  it("does nothing for a non-owner, an empty email, offline, or no user", async () => {
    await makeHook({ isOwnerAccount: false }).api.revokeAccess("a@x.com");
    await makeHook().api.revokeAccess("  ");
    await makeHook({ requireOnline: vi.fn(() => false) }).api.revokeAccess("a@x.com");
    await makeHook({ user: null }).api.revokeAccess("a@x.com");
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("reports a failure without throwing", async () => {
    const boom = new Error("nope");
    mocks.runTransaction.mockRejectedValueOnce(boom);
    const { api, props } = makeHook();
    await expect(api.revokeAccess("a@x.com")).resolves.toBeUndefined();
    expect(props.reportError).toHaveBeenCalledWith(boom);
  });
});

describe("setMemberDashboardAccess", () => {
  it("turns Dashboard on for an existing member, keeping the role and other members' settings", async () => {
    mocks.tx.get.mockResolvedValue(
      snap({ members: { "a@x.com": "editor", "b@x.com": "viewer" }, dashboardAccess: { "b@x.com": true } })
    );
    const { api } = makeHook();
    await api.setMemberDashboardAccess("A@x.com", true);

    expect(mocks.tx.set).toHaveBeenCalledWith(
      ACCESS,
      { dashboardAccess: { "b@x.com": true, "a@x.com": true } },
      { merge: true }
    );
    expect(mocks.tx.set).toHaveBeenCalledWith(
      { path: "access_by_email/a@x.com" },
      { owners: { owner1: "editor" }, dashboardAccess: true }
    );
  });

  it("turns it off and coerces the value to a real boolean", async () => {
    mocks.tx.get.mockResolvedValue(
      snap({ members: { "a@x.com": "viewer" }, dashboardAccess: { "a@x.com": true } })
    );
    const { api } = makeHook();
    await api.setMemberDashboardAccess("a@x.com", 0);
    expect(mocks.tx.set.mock.calls[0][1]).toEqual({ dashboardAccess: { "a@x.com": false } });
    expect(mocks.tx.set.mock.calls[1][1]).toEqual({ owners: { owner1: "viewer" }, dashboardAccess: false });
  });

  it("does nothing for someone who isn't a member (never granted, or already revoked)", async () => {
    mocks.tx.get.mockResolvedValue(snap({ members: { "b@x.com": "viewer" } }));
    const { api } = makeHook();
    await api.setMemberDashboardAccess("ghost@x.com", true);
    expect(mocks.tx.set).not.toHaveBeenCalled();
  });

  it("is owner-only — even an admin/reviewer who isn't the owner can't toggle it", async () => {
    const { api } = makeHook({ isOwnerAccount: false, isReviewer: true });
    await api.setMemberDashboardAccess("a@x.com", true);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("does nothing while offline", async () => {
    const { api } = makeHook({ requireOnline: vi.fn(() => false) });
    await api.setMemberDashboardAccess("a@x.com", true);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });
});

describe("reviewSignup / dismissSignup", () => {
  it("grants the chosen role first, then clears the pending signup", async () => {
    const order = [];
    mocks.runTransaction.mockImplementationOnce(async (_db, fn) => {
      order.push("grant");
      return fn(mocks.tx);
    });
    mocks.deleteDoc.mockImplementationOnce(() => {
      order.push("delete");
      return Promise.resolve();
    });
    const { api } = makeHook();
    await api.reviewSignup("uid9", "new@x.com", "viewer");

    expect(order).toEqual(["grant", "delete"]);
    expect(mocks.deleteDoc).toHaveBeenCalledWith({ path: "signups/uid9" });
  });

  it("only a reviewer can review or dismiss a signup", async () => {
    const { api } = makeHook({ isReviewer: false });
    await api.reviewSignup("uid9", "new@x.com", "viewer");
    await api.dismissSignup("uid9");
    expect(mocks.runTransaction).not.toHaveBeenCalled();
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
  });

  it("reports (doesn't throw) when clearing the signup fails after a successful grant", async () => {
    const boom = new Error("delete failed");
    mocks.deleteDoc.mockRejectedValueOnce(boom);
    const { api, props } = makeHook();
    await expect(api.reviewSignup("uid9", "new@x.com", "editor")).resolves.toBeUndefined();
    expect(mocks.tx.set).toHaveBeenCalled();
    expect(props.reportError).toHaveBeenCalledWith(boom);
  });

  it("dismissSignup deletes the signup document", async () => {
    const { api } = makeHook();
    await api.dismissSignup("uid9");
    expect(mocks.deleteDoc).toHaveBeenCalledWith({ path: "signups/uid9" });
  });
});

describe("addAdminEmail / removeAdminEmail", () => {
  it("a reviewer can add an admin (normalized) with arrayUnion + merge", async () => {
    const { api } = makeHook();
    await api.addAdminEmail("  Third@X.com ");
    expect(mocks.setDoc).toHaveBeenCalledWith(
      { path: "config/admins" },
      { emails: { __arrayUnion: ["third@x.com"] } },
      { merge: true }
    );
  });

  it("ignores an empty email, and non-reviewers can't add admins", async () => {
    await makeHook().api.addAdminEmail("   ");
    await makeHook({ isReviewer: false }).api.addAdminEmail("third@x.com");
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it("the primary admin can remove another admin", async () => {
    const { api } = makeHook();
    await api.removeAdminEmail("Second@x.com");
    expect(mocks.setDoc).toHaveBeenCalledWith(
      { path: "config/admins" },
      { emails: { __arrayRemove: ["second@x.com"] } },
      { merge: true }
    );
  });

  it("a non-primary admin can't remove anyone", async () => {
    const { api } = makeHook({ isPrimaryAdmin: false });
    await api.removeAdminEmail("boss@x.com");
    await api.removeAdminEmail("second@x.com");
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it("nobody — not even the primary — can remove the primary admin", async () => {
    const { api } = makeHook();
    await api.removeAdminEmail("BOSS@x.com");
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it("the last remaining admin can't be removed", async () => {
    const { api } = makeHook({ adminEmails: ["boss@x.com"], primaryAdminEmail: "someone-else@x.com" });
    await api.removeAdminEmail("boss@x.com");
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
});
