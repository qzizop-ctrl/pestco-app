import { describe, it, expect } from "vitest";
import { computeRollbackFields, IGNORED_LAST_CHANGE_KEYS } from "./lastChange";

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

  it("returns an empty object for a missing or empty last_change", () => {
    expect(computeRollbackFields(null)).toEqual({});
    expect(computeRollbackFields(undefined)).toEqual({});
    expect(computeRollbackFields({})).toEqual({});
  });

  it("returns an empty object when changes is not an object (defensive)", () => {
    expect(computeRollbackFields({ changes: "not an object" })).toEqual({});
  });
});
