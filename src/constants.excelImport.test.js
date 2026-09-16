import { describe, it, expect } from "vitest";
import {
  findSectorId, findRoleId, findStageId, parseTagsCell,
  normalizeExcelDate, normalizeExcelDateTime, parseVisitDate, toISODate,
} from "./constants";

// These back the Excel import path touched in useExcelImport.js: a bug here
// silently mis-files or mis-dates an imported row rather than throwing, so
// they're worth pinning down directly rather than only exercising them
// indirectly through a full import.

describe("findSectorId", () => {
  it("matches a raw id unchanged", () => {
    expect(findSectorId("construction")).toBe("construction");
  });

  it("matches an Arabic label", () => {
    expect(findSectorId("قطاع التعليم")).toBe("education");
  });

  it("matches an English label", () => {
    expect(findSectorId("Consultants")).toBe("consultants");
  });

  it("falls back to 'private' for an unrecognized or empty value", () => {
    expect(findSectorId("something random")).toBe("private");
    expect(findSectorId("")).toBe("private");
    expect(findSectorId(undefined)).toBe("private");
  });

  it("trims surrounding whitespace before matching", () => {
    expect(findSectorId("  قطاع التعليم  ")).toBe("education");
  });
});

describe("findRoleId", () => {
  it("matches a raw id, an Arabic label, and an English label", () => {
    expect(findRoleId("it")).toBe("it");
    expect(findRoleId("المكتب الفني")).toBe("technical");
    expect(findRoleId("Purchasing Manager")).toBe("purchasing");
  });

  it("falls back to 'other' when nothing matches", () => {
    expect(findRoleId("nonsense")).toBe("other");
    expect(findRoleId("")).toBe("other");
  });
});

describe("findStageId", () => {
  it("matches a raw id, an Arabic label, and an English label", () => {
    expect(findStageId("quote")).toBe("quote");
    expect(findStageId("تركيب")).toBe("install");
    expect(findStageId("Maintenance")).toBe("maintenance");
  });

  it("falls back to 'survey' (the pipeline's first stage) when nothing matches", () => {
    expect(findStageId("nonsense")).toBe("survey");
    expect(findStageId(undefined)).toBe("survey");
  });
});

describe("parseTagsCell", () => {
  it("splits a comma separated cell and trims each tag", () => {
    expect(parseTagsCell("VIP,  يحتاج عرض سعر ,urgent")).toEqual([
      "VIP", "يحتاج عرض سعر", "urgent",
    ]);
  });

  it("drops empty entries from stray/extra commas", () => {
    expect(parseTagsCell("VIP,,urgent,")).toEqual(["VIP", "urgent"]);
  });

  it("returns an empty array for an empty/missing cell", () => {
    expect(parseTagsCell("")).toEqual([]);
    expect(parseTagsCell(undefined)).toEqual([]);
    expect(parseTagsCell(null)).toEqual([]);
  });

  it("returns a single-item array for a cell with no commas", () => {
    expect(parseTagsCell("VIP")).toEqual(["VIP"]);
  });
});

describe("normalizeExcelDate", () => {
  it("formats a real Date object as yyyy-mm-dd", () => {
    expect(normalizeExcelDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("passes an already-ISO string through unchanged", () => {
    expect(normalizeExcelDate("2026-03-14")).toBe("2026-03-14");
  });

  it("converts a dd-mm-yyyy text cell to ISO", () => {
    expect(normalizeExcelDate("05-01-2026")).toBe("2026-01-05");
  });

  it("returns an empty string for an empty/missing cell", () => {
    expect(normalizeExcelDate("")).toBe("");
    expect(normalizeExcelDate(undefined)).toBe("");
  });
});

describe("normalizeExcelDateTime", () => {
  it("formats a real Date object as yyyy-mm-ddThh:mm", () => {
    expect(normalizeExcelDateTime(new Date(2026, 0, 5, 14, 30))).toBe("2026-01-05T14:30");
  });

  it("passes a plain string through trimmed", () => {
    expect(normalizeExcelDateTime("  2026-01-05T14:30  ")).toBe("2026-01-05T14:30");
  });

  it("returns an empty string for an empty/missing cell", () => {
    expect(normalizeExcelDateTime("")).toBe("");
    expect(normalizeExcelDateTime(undefined)).toBe("");
  });
});

describe("parseVisitDate / toISODate round-trip", () => {
  it("round-trips an ISO date", () => {
    expect(toISODate("2026-06-01")).toBe("2026-06-01");
  });

  it("round-trips a dd-mm-yyyy legacy text date", () => {
    expect(toISODate("1-6-2026")).toBe("2026-06-01");
  });

  it("returns an empty string for an unparsable/missing date", () => {
    expect(toISODate("")).toBe("");
    expect(toISODate(undefined)).toBe("");
  });

  it("parseVisitDate returns null (not a bad Date) for garbage input", () => {
    expect(parseVisitDate("not a date")).toBeNull();
  });
});
