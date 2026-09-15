import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  isAdminEmail,
  resolvePrimaryAdminEmail,
  isPrimaryAdminEmail,
  canRemoveAdmin,
} from "./adminPermissions";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Owner@Example.com  ")).toBe("owner@example.com");
  });

  it("treats missing/null/undefined as empty string", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail("")).toBe("");
  });
});

describe("isAdminEmail", () => {
  it("recognizes an email that's in the list", () => {
    expect(isAdminEmail(["owner@x.com", "admin2@x.com"], "admin2@x.com")).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isAdminEmail(["owner@x.com"], "  Owner@X.com  ")).toBe(true);
  });

  it("rejects an email that isn't in the list", () => {
    expect(isAdminEmail(["owner@x.com"], "random@x.com")).toBe(false);
  });

  it("handles an empty/missing list safely", () => {
    expect(isAdminEmail([], "owner@x.com")).toBe(false);
    expect(isAdminEmail(null, "owner@x.com")).toBe(false);
  });

  it("never matches an empty email", () => {
    expect(isAdminEmail(["owner@x.com", ""], "")).toBe(false);
  });
});

describe("resolvePrimaryAdminEmail", () => {
  it("prefers the explicit primaryEmail field", () => {
    expect(
      resolvePrimaryAdminEmail("Owner@X.com", ["secondary@x.com", "owner@x.com"])
    ).toBe("owner@x.com");
  });

  it(
    "THE BUG THAT ACTUALLY HAPPENED: without an explicit primaryEmail, " +
    "falls back to array position — this is why a newly added admin can " +
    "end up looking primary if the doc predates the primaryEmail field",
    () => {
      // secondary admin happens to sit first in the array (e.g. because of
      // how the doc was hand-edited in the console) — old logic treated
      // THIS as primary, which is exactly the reported bug.
      const resolved = resolvePrimaryAdminEmail(undefined, ["secondary@x.com", "owner@x.com"]);
      expect(resolved).toBe("secondary@x.com");
      expect(resolved).not.toBe("owner@x.com");
    }
  );

  it("returns null when there's no primaryEmail and no emails at all", () => {
    expect(resolvePrimaryAdminEmail(undefined, [])).toBeNull();
    expect(resolvePrimaryAdminEmail(undefined, null)).toBeNull();
  });

  it("normalizes the explicit field", () => {
    expect(resolvePrimaryAdminEmail("  Owner@X.com  ", [])).toBe("owner@x.com");
  });
});

describe("isPrimaryAdminEmail", () => {
  it("matches the resolved primary admin", () => {
    expect(isPrimaryAdminEmail("owner@x.com", "Owner@X.com")).toBe(true);
  });

  it("rejects a non-primary admin, even if they are an admin", () => {
    expect(isPrimaryAdminEmail("owner@x.com", "secondary@x.com")).toBe(false);
  });

  it("is false when there's no resolved primary at all", () => {
    expect(isPrimaryAdminEmail(null, "owner@x.com")).toBe(false);
    expect(isPrimaryAdminEmail(undefined, "owner@x.com")).toBe(false);
  });
});

describe("canRemoveAdmin", () => {
  const base = {
    requesterIsPrimaryAdmin: true,
    targetEmail: "secondary@x.com",
    primaryAdminEmail: "owner@x.com",
    adminEmailsCount: 2,
  };

  it("allows the primary admin to remove a secondary admin", () => {
    expect(canRemoveAdmin(base)).toBe(true);
  });

  it("refuses a non-primary admin trying to remove anyone", () => {
    expect(canRemoveAdmin({ ...base, requesterIsPrimaryAdmin: false })).toBe(false);
  });

  it("refuses to remove the primary admin itself, even by the primary admin", () => {
    expect(canRemoveAdmin({ ...base, targetEmail: "owner@x.com" })).toBe(false);
  });

  it("refuses to remove the last remaining admin", () => {
    expect(canRemoveAdmin({ ...base, adminEmailsCount: 1 })).toBe(false);
  });

  it("refuses an empty/missing target email", () => {
    expect(canRemoveAdmin({ ...base, targetEmail: "" })).toBe(false);
    expect(canRemoveAdmin({ ...base, targetEmail: null })).toBe(false);
  });

  it("is case/whitespace-insensitive when comparing to the primary email", () => {
    expect(canRemoveAdmin({ ...base, targetEmail: "  Owner@X.com  " })).toBe(false);
  });
});
