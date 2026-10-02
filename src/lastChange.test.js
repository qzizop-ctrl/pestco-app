import { describe, it, expect } from "vitest";
import {
  computeRollbackFields, mergeLastChange, IGNORED_LAST_CHANGE_KEYS,
  tagsChanged, sameChangeValue, sameLastChange, formatChangeValue,
} from "./lastChange";

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

describe("tags in pending changes", () => {
  it("rolls tags back to the previous list", () => {
    const lastChange = { changes: { tags: { old_value: ["vip", "cctv"], new_value: ["vip"] } } };
    expect(computeRollbackFields(lastChange)).toEqual({ tags: ["vip", "cctv"] });
  });

  it("rolls a record that had no tags back to an EMPTY ARRAY, not the \"\" placeholder", () => {
    const lastChange = { changes: { tags: { old_value: "فارغ", new_value: ["vip"] } } };
    expect(computeRollbackFields(lastChange)).toEqual({ tags: [] });
  });

  it("tagsChanged ignores order and treats missing as empty", () => {
    expect(tagsChanged(["a", "b"], ["b", "a"])).toBe(false);
    expect(tagsChanged(undefined, [])).toBe(false);
    expect(tagsChanged([], ["a"])).toBe(true);
    expect(tagsChanged(["a"], ["a", "b"])).toBe(true);
  });

  it("sameChangeValue compares arrays by content, scalars by ===", () => {
    expect(sameChangeValue(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameChangeValue(["a"], ["b"])).toBe(false);
    expect(sameChangeValue(["a"], "a")).toBe(false);
    expect(sameChangeValue("x", "x")).toBe(true);
  });

  it("merging drops a tag edit that two editors cancelled out", () => {
    const prev = { updatedById: "a", changes: { tags: { old_value: ["x"], new_value: ["y"] } } };
    const next = { updatedById: "b", changes: { tags: { old_value: ["y"], new_value: ["x"] } } };
    expect(mergeLastChange(prev, next).changes).toBeUndefined();
  });

  it("formats lists and empty values for display", () => {
    expect(formatChangeValue(["a", "b"])).toBe("a, b");
    expect(formatChangeValue([])).toBe("—");
    expect(formatChangeValue("")).toBe("—");
    expect(formatChangeValue(undefined)).toBe("—");
    expect(formatChangeValue("text")).toBe("text");
  });
});

describe("visit-history entries recorded with a change", () => {
  it("never treats addedVisitEntryIds as a field to restore", () => {
    const lastChange = {
      changes: { visitDate: { old_value: "2026-01-01", new_value: "2026-02-01" } },
      addedVisitEntryIds: ["e1"],
    };
    const result = computeRollbackFields(lastChange);
    expect(result).toEqual({ visitDate: "2026-01-01" });
    expect(IGNORED_LAST_CHANGE_KEYS).toContain("addedVisitEntryIds");
  });

  it("merging keeps the entry ids of BOTH edits so a rollback undoes them all", () => {
    const prev = {
      updatedById: "a",
      changes: { visitDate: { old_value: "d0", new_value: "d1" } },
      addedVisitEntryIds: ["e1"],
    };
    const next = {
      updatedById: "b",
      changes: { visitDate: { old_value: "d1", new_value: "d2" } },
      addedVisitEntryIds: ["e2"],
    };
    const out = mergeLastChange(prev, next);
    expect(out.changes.visitDate).toEqual({ old_value: "d0", new_value: "d2" });
    expect(out.addedVisitEntryIds).toEqual(["e1", "e2"]);
  });

  it("a later edit without a visit-date change keeps the earlier edit's ids", () => {
    const prev = { updatedById: "a", changes: { visitDate: { old_value: "d0", new_value: "d1" } }, addedVisitEntryIds: ["e1"] };
    const next = { updatedById: "b", changes: { notes: { old_value: "", new_value: "n" } } };
    expect(mergeLastChange(prev, next).addedVisitEntryIds).toEqual(["e1"]);
  });
});

describe("sameLastChange (concurrency check for approve / rollback)", () => {
  it("is true for identical content regardless of key order", () => {
    const a = { updatedById: "a", changes: { notes: { old_value: "x", new_value: "y" } } };
    const b = { changes: { notes: { new_value: "y", old_value: "x" } }, updatedById: "a" };
    expect(sameLastChange(a, b)).toBe(true);
  });

  it("is false when another edit replaced or merged into it", () => {
    const shown = { updatedById: "a", updatedAt: "t1", changes: { notes: { old_value: "x", new_value: "y" } } };
    const stored = { updatedById: "b", updatedAt: "t2", changes: { notes: { old_value: "x", new_value: "z" } } };
    expect(sameLastChange(shown, stored)).toBe(false);
  });

  it("is false when the pending change disappeared or appeared", () => {
    expect(sameLastChange({ a: 1 }, null)).toBe(false);
    expect(sameLastChange(undefined, { a: 1 })).toBe(false);
    expect(sameLastChange(null, undefined)).toBe(true);
  });

  it("notices a different tag list", () => {
    const a = { changes: { tags: { old_value: [], new_value: ["a"] } } };
    const b = { changes: { tags: { old_value: [], new_value: ["a", "b"] } } };
    expect(sameLastChange(a, b)).toBe(false);
  });
});
