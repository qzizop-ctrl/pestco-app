import { describe, it, expect } from "vitest";
import { computeRollbackFields, mergeLastChange, IGNORED_LAST_CHANGE_KEYS } from "./lastChange";

describe("computeRollbackFields", () => {
  it("restores old_value for fields shaped as { old_value }", () => {
    const lastChange = {
      changes: {
        companyName: { old_value: "Old Co", new_value: "New Co" },
        phone: { old_value: "0100000000", new_value: "0111111111" },
      },
    };
    expect(computeRollbackFields(lastChange)).toEqual({
      companyName: "Old Co",
      phone: "0100000000",
    });
  });

  it("restores bare scalar values as-is", () => {
    const lastChange = { changes: { stage: "quote", notes: "call back later" } };
    expect(computeRollbackFields(lastChange)).toEqual({
      stage: "quote",
      notes: "call back later",
    });
  });

  it("falls back to `details` when `changes` is absent", () => {
    const lastChange = { details: { companyName: { old_value: "Old Co" } } };
    expect(computeRollbackFields(lastChange)).toEqual({ companyName: "Old Co" });
  });

  it("falls back to last_change itself when neither changes nor details exist", () => {
    const lastChange = { companyName: { old_value: "Old Co" }, updatedBy: "a@b.com" };
    expect(computeRollbackFields(lastChange)).toEqual({ companyName: "Old Co" });
  });

  it("excludes metadata keys (changed_by, updatedBy, updated_at, etc.)", () => {
    const lastChange = {
      changes: {
        companyName: { old_value: "Old Co" },
        changed_by: "a@b.com",
        updatedBy: "a@b.com",
        updatedById: "uid123",
        updated_at: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    };
    const result = computeRollbackFields(lastChange);
    expect(result).toEqual({ companyName: "Old Co" });
    IGNORED_LAST_CHANGE_KEYS.forEach((key) => expect(result).not.toHaveProperty(key));
  });

  it("skips a nested object field that has no old_value (can't safely guess)", () => {
    const lastChange = {
      changes: {
        companyName: { old_value: "Old Co" },
        weirdField: { some: "nested", shape: true },
      },
    };
    expect(computeRollbackFields(lastChange)).toEqual({ companyName: "Old Co" });
  });

  it("excludes `type` when falling back to last_change itself (pending-delete shape)", () => {
    // A pending-delete's last_change has no `changes`/`details` sub-object
    // (see useCustomerRecords.js's commitDeleteVisit), so this falls through
    // to reading last_change itself — `type: "delete"` must not leak through
    // as a field to restore.
    const lastChange = {
      type: "delete", updatedBy: "a@b.com", updatedById: "uid123", updatedAt: "2026-01-01",
    };
    expect(computeRollbackFields(lastChange)).toEqual({});
  });

  it("returns an empty object for a missing or empty last_change", () => {
    expect(computeRollbackFields(null)).toEqual({});
    expect(computeRollbackFields(undefined)).toEqual({});
    expect(computeRollbackFields({})).toEqual({});
  });

  it("returns an empty object when changes is not an object (defensive)", () => {
    expect(computeRollbackFields({ changes: "not an object" })).toEqual({});
  });
});

describe("computeRollbackFields hardening", () => {
  it("only restores known editable fields (a crafted last_change can't touch createdAt/deleted/offers)", () => {
    const lastChange = {
      changes: {
        companyName: { old_value: "Old Co" },
        createdAt: { old_value: "1970" },
        deleted: { old_value: true },
        offers: { old_value: [] },
        isAdmin: "yes",
      },
    };
    expect(computeRollbackFields(lastChange)).toEqual({ companyName: "Old Co" });
  });

  it("turns the \"فارغ\" display placeholder back into an empty value", () => {
    const lastChange = { changes: { notes: { old_value: "فارغ", new_value: "hi" } } };
    expect(computeRollbackFields(lastChange)).toEqual({ notes: "" });
  });
});

describe("mergeLastChange", () => {
  const A = { updatedBy: "A", updatedById: "a", updatedAt: "t1" };
  const B = { updatedBy: "B", updatedById: "b", updatedAt: "t2" };

  it("returns next when there is nothing to merge with", () => {
    const next = { ...B, changes: { notes: { old_value: "x", new_value: "y" } } };
    expect(mergeLastChange(null, next)).toBe(next);
    expect(mergeLastChange({ ...A, type: "delete" }, next)).toBe(next);
  });

  it("keeps the oldest old_value and newest new_value per field, and both editors' fields", () => {
    const prev = { ...A, changes: { notes: { old_value: "v0", new_value: "v1" }, phone: { old_value: "1", new_value: "2" } } };
    const next = { ...B, changes: { notes: { old_value: "v1", new_value: "v2" }, email: { old_value: "فارغ", new_value: "a@b" } } };
    const out = mergeLastChange(prev, next);
    expect(out.updatedById).toBe("b");
    expect(out.changes).toEqual({
      notes: { old_value: "v0", new_value: "v2" },
      phone: { old_value: "1", new_value: "2" },
      email: { old_value: "فارغ", new_value: "a@b" },
    });
  });

  it("drops a field that was changed back to its original value", () => {
    const prev = { ...A, changes: { notes: { old_value: "v0", new_value: "v1" } } };
    const next = { ...B, changes: { notes: { old_value: "v1", new_value: "v0" } } };
    expect(mergeLastChange(prev, next).changes).toBeUndefined();
  });
});
