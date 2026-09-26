import { describe, it, expect } from "vitest";
import { buildVisitEntry } from "./activityHelpers";
import { todayLocalISO } from "./dateUtils";
import { splitImportDuplicates } from "./excelImportHelpers";
import { diffVisitFields, buildVisitEditFields } from "./formHelpers";

describe("todayLocalISO", () => {
  it("formats the LOCAL calendar date, zero-padded", () => {
    // Built from local components on purpose: the result must not depend on
    // the machine's time zone (toISOString() would, which was the bug — in
    // Egypt 00:30 local is still "yesterday" in UTC).
    expect(todayLocalISO(new Date(2026, 0, 5, 0, 30))).toBe("2026-01-05");
    expect(todayLocalISO(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("is what buildVisitEntry stamps when no date is given", () => {
    expect(buildVisitEntry().date).toBe(todayLocalISO());
    expect(buildVisitEntry("2024-03-04").date).toBe("2024-03-04");
  });
});

describe("diffVisitFields", () => {
  it("returns only the fields whose value changed", () => {
    const baseline = { companyName: "A", notes: "x", phone: "0100" };
    const data = { companyName: "A", notes: "y", phone: "0100" };
    expect(diffVisitFields(baseline, data)).toEqual({ notes: "y" });
  });

  it("treats undefined / null / empty string as the same empty value", () => {
    expect(diffVisitFields({ email: undefined }, { email: "" })).toEqual({});
    expect(diffVisitFields({ email: null }, { email: "" })).toEqual({});
    expect(diffVisitFields({ email: "" }, { email: "a@b.c" })).toEqual({ email: "a@b.c" });
  });

  it("compares arrays by value, not by reference", () => {
    expect(diffVisitFields({ tags: ["a", "b"] }, { tags: ["a", "b"] })).toEqual({});
    expect(diffVisitFields({ tags: ["a"] }, { tags: ["a", "b"] })).toEqual({ tags: ["a", "b"] });
  });

  it("uses `defaults` for a field the baseline never had", () => {
    expect(diffVisitFields({}, { isPinned: false }, { isPinned: false })).toEqual({});
    expect(diffVisitFields({}, { isPinned: true }, { isPinned: false })).toEqual({ isPinned: true });
  });
});

describe("buildVisitEditFields", () => {
  it("sends only what was edited since the form opened, so a concurrent pin/stage change survives", () => {
    // The form was opened while the customer was un-pinned, stage "". Someone
    // else then pinned it and moved it to a new stage in Firestore. The form
    // still holds the old values for those, so they must NOT be in the write.
    const openedAs = { companyName: "Acme", notes: "old", isPinned: false, stage: "" };
    const savedAs = { companyName: "Acme", notes: "new", isPinned: false, stage: "" };
    expect(buildVisitEditFields(openedAs, savedAs)).toEqual({ notes: "new" });
  });

  it("falls back to the whole form when there is no baseline", () => {
    const data = { companyName: "Acme", notes: "n" };
    expect(buildVisitEditFields(null, data)).toEqual(data);
  });

  it("re-arms the reminder when the call is rescheduled", () => {
    const openedAs = { callDateTime: "2026-01-01T10:00", notified: true };
    const savedAs = { callDateTime: "2026-01-02T10:00", notified: true };
    expect(buildVisitEditFields(openedAs, savedAs)).toEqual({
      callDateTime: "2026-01-02T10:00",
      notified: false,
    });
  });

  it("leaves `notified` alone when the call time didn't change or was cleared", () => {
    const same = { callDateTime: "2026-01-01T10:00", notified: true, notes: "a" };
    expect(buildVisitEditFields(same, { ...same, notes: "b" })).toEqual({ notes: "b" });
    expect(buildVisitEditFields(same, { ...same, callDateTime: "" })).toEqual({ callDateTime: "" });
  });
});

describe("splitImportDuplicates", () => {
  const rows = (...phones) => phones.map((phone, i) => ({ id: i, phone }));
  const phoneOf = (r) => r.phone;

  it("skips rows whose phone already belongs to an existing record, across +20 / 0 / spacing variants", () => {
    const existing = [{ phone: "+20 100 123 4567" }];
    const { kept, skipped } = splitImportDuplicates(rows("01001234567", "01555555555"), existing, phoneOf);
    expect(kept.map((r) => r.phone)).toEqual(["01555555555"]);
    expect(skipped).toBe(1);
  });

  it("skips repeats inside the file itself, keeping the first", () => {
    const { kept, skipped } = splitImportDuplicates(rows("0100", "0100", "0100"), [], phoneOf);
    expect(kept).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it("never treats rows without a phone as duplicates", () => {
    const { kept, skipped } = splitImportDuplicates(rows("", "", "  "), [{ phone: "" }], phoneOf);
    expect(kept).toHaveLength(3);
    expect(skipped).toBe(0);
  });

  it("ignores soft-deleted existing records", () => {
    const existing = [{ phone: "01001234567", deleted: true }];
    const { kept, skipped } = splitImportDuplicates(rows("01001234567"), existing, phoneOf);
    expect(kept).toHaveLength(1);
    expect(skipped).toBe(0);
  });

  it("copes with no existing list at all", () => {
    expect(splitImportDuplicates(rows("0100"), undefined, phoneOf).kept).toHaveLength(1);
  });
});
