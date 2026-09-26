import { describe, it, expect } from "vitest";
import { resolveNextOwners, selectOwner, resolveNoOwnersOutcome } from "./workspaceAccess";

describe("resolveNextOwners", () => {
  it("keeps an external editor/viewer grant as-is", () => {
    const result = resolveNextOwners({
      ownersMap: { ownerA: "editor" },
      userUid: "me",
      isReviewerEmail: false,
      hasKnownExternalAccess: false,
    });
    expect(result).toEqual([{ uid: "ownerA", role: "editor" }]);
  });

  it("drops entries that aren't editor/viewer (e.g. a stray non-role value)", () => {
    const result = resolveNextOwners({
      ownersMap: { ownerA: "editor", ownerB: "something-unexpected" },
      userUid: "me",
      isReviewerEmail: false,
      hasKnownExternalAccess: false,
    });
    expect(result).toEqual([{ uid: "ownerA", role: "editor" }]);
  });

  it("normalizes the account's own uid to 'owner' if it somehow appears as editor/viewer of itself", () => {
    const result = resolveNextOwners({
      ownersMap: { me: "editor", ownerB: "viewer" },
      userUid: "me",
      isReviewerEmail: false,
      hasKnownExternalAccess: false,
    });
    expect(result).toEqual([{ uid: "me", role: "owner" }, { uid: "ownerB", role: "viewer" }]);
  });

  it("self-provisions a reviewer/admin account as owner of its own workspace when it has no other access", () => {
    const result = resolveNextOwners({
      ownersMap: {},
      userUid: "me",
      isReviewerEmail: true,
      hasKnownExternalAccess: false,
    });
    expect(result).toEqual([{ uid: "me", role: "owner" }]);
  });

  it("does NOT self-provision a non-admin account with no access (must go through signup review instead)", () => {
    const result = resolveNextOwners({
      ownersMap: {},
      userUid: "me",
      isReviewerEmail: false,
      hasKnownExternalAccess: false,
    });
    expect(result).toEqual([]);
  });

  it("does NOT self-provision an admin account that has a known external access already resolved this session", () => {
    // e.g. their externally-granted access was momentarily empty in this
    // particular snapshot (a live revoke, a transient read) while they
    // were already resolved into some other real workspace this session —
    // must not spontaneously spawn a fresh empty "owner" workspace for them.
    const result = resolveNextOwners({
      ownersMap: {},
      userUid: "me",
      isReviewerEmail: true,
      hasKnownExternalAccess: true,
    });
    expect(result).toEqual([]);
  });

  it("does NOT self-provision an admin account that already has real external access in this exact snapshot", () => {
    const result = resolveNextOwners({
      ownersMap: { ownerA: "viewer" },
      userUid: "me",
      isReviewerEmail: true,
      hasKnownExternalAccess: false,
    });
    expect(result).toEqual([{ uid: "ownerA", role: "viewer" }]);
  });
});

describe("selectOwner", () => {
  const nextOwners = [{ uid: "a", role: "owner" }, { uid: "b", role: "editor" }];

  it("prefers the currently-resolved owner if it's still valid", () => {
    expect(selectOwner({ nextOwners, currentOwner: "b", savedOwner: "a" })).toBe("b");
  });

  it("falls back to the saved (localStorage) owner if the current one is no longer valid", () => {
    expect(selectOwner({ nextOwners, currentOwner: "gone", savedOwner: "b" })).toBe("b");
  });

  it("falls back to the first available owner if neither current nor saved is valid", () => {
    expect(selectOwner({ nextOwners, currentOwner: "gone", savedOwner: "also-gone" })).toBe("a");
  });

  it("falls back to the first available owner if nothing was previously resolved at all", () => {
    expect(selectOwner({ nextOwners, currentOwner: null, savedOwner: null })).toBe("a");
  });
});

describe("resolveNoOwnersOutcome", () => {
  it("waits rather than acting on a provisional (cached) snapshot", () => {
    expect(resolveNoOwnersOutcome({
      allowSignOut: false, isReviewerEmail: false, emailVerified: true, accountAgeMs: 0,
    })).toBe("wait");
    // Even a reviewer or an unverified account must wait on a cached read —
    // allowSignOut is checked first, before anything else.
    expect(resolveNoOwnersOutcome({
      allowSignOut: false, isReviewerEmail: true, emailVerified: false, accountAgeMs: 0,
    })).toBe("wait");
  });

  it("never signs out a reviewer/admin account, even with zero resolved workspaces", () => {
    expect(resolveNoOwnersOutcome({
      allowSignOut: true, isReviewerEmail: true, emailVerified: true, accountAgeMs: 0,
    })).toBe("reviewer_no_owners");
    expect(resolveNoOwnersOutcome({
      allowSignOut: true, isReviewerEmail: true, emailVerified: false, accountAgeMs: 999999999,
    })).toBe("reviewer_no_owners");
  });

  it("asks for email verification before ever considering the self-heal write", () => {
    expect(resolveNoOwnersOutcome({
      allowSignOut: true, isReviewerEmail: false, emailVerified: false, accountAgeMs: 0,
    })).toBe("needs_email_verification");
  });

  it("self-heals a verified account within the 24h window", () => {
    expect(resolveNoOwnersOutcome({
      allowSignOut: true, isReviewerEmail: false, emailVerified: true, accountAgeMs: 60 * 1000,
    })).toBe("sign_out_and_self_heal");
    // Right at the boundary, still under 24h.
    expect(resolveNoOwnersOutcome({
      allowSignOut: true, isReviewerEmail: false, emailVerified: true, accountAgeMs: 24 * 60 * 60 * 1000 - 1,
    })).toBe("sign_out_and_self_heal");
  });

  it("does not self-heal a verified account outside the 24h window (e.g. a long-dismissed/revoked account)", () => {
    expect(resolveNoOwnersOutcome({
      allowSignOut: true, isReviewerEmail: false, emailVerified: true, accountAgeMs: 24 * 60 * 60 * 1000,
    })).toBe("sign_out_only");
    expect(resolveNoOwnersOutcome({
      allowSignOut: true, isReviewerEmail: false, emailVerified: true, accountAgeMs: Infinity,
    })).toBe("sign_out_only");
  });
});
