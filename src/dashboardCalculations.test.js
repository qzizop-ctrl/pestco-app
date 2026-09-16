import { describe, it, expect } from "vitest";
import {
  resolvePeriod, pctChange, computeAvgDealSizeForCurrency,
  computeWinRate, computeDecidedCount, buildOfferBreakdown,
} from "./dashboardCalculations";

// Minimal t stub — resolvePeriod only touches t.months and the two
// dashPeriodLast* labels, never renders anything.
const t = {
  months: [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ],
  dashPeriodLast3: "آخر 3 شهور",
  dashPeriodLast6: "آخر 6 شهور",
  dashPeriodCurrentMonth: "الشهر الحالي",
};

describe("resolvePeriod", () => {
  it("defaults to the current calendar month with day granularity", () => {
    const now = new Date(2026, 8, 16); // Sep 16, 2026
    const r = resolvePeriod({ mode: "month" }, now, t);
    expect(r.start).toEqual(new Date(2026, 8, 1, 0, 0, 0));
    expect(r.end).toEqual(new Date(2026, 8, 30, 23, 59, 59));
    expect(r.granularity).toBe("day");
    expect(r.prevStart).toEqual(new Date(2026, 7, 1, 0, 0, 0));
  });

  it("wraps the year when the current month is January (prev period)", () => {
    const now = new Date(2026, 0, 15); // Jan 2026
    const r = resolvePeriod({ mode: "month" }, now, t);
    expect(r.prevStart.getFullYear()).toBe(2025);
    expect(r.prevStart.getMonth()).toBe(11); // December
  });

  it("q3 mode spans the last 3 months ending this month, month granularity", () => {
    const now = new Date(2026, 1, 10); // Feb 2026 -> Dec, Jan, Feb
    const r = resolvePeriod({ mode: "q3" }, now, t);
    expect(r.start).toEqual(new Date(2025, 11, 1, 0, 0, 0));
    expect(r.end).toEqual(new Date(2026, 1, 28, 23, 59, 59));
    expect(r.granularity).toBe("month");
  });

  it("year mode covers Jan 1 to Dec 31 with the prior year as comparison", () => {
    const r = resolvePeriod({ mode: "year", year: 2025 }, new Date(2026, 5, 1), t);
    expect(r.start).toEqual(new Date(2025, 0, 1, 0, 0, 0));
    expect(r.end).toEqual(new Date(2025, 11, 31, 23, 59, 59));
    expect(r.prevStart).toEqual(new Date(2024, 0, 1, 0, 0, 0));
  });

  it("custom range spanning multiple months uses month granularity and resolves out-of-order from/to", () => {
    const r = resolvePeriod(
      { mode: "custom", customType: "range", from: { year: 2026, month: 5 }, to: { year: 2026, month: 2 } },
      new Date(2026, 5, 1),
      t
    );
    // from (May) / to (March) given reversed -> should normalize to March..May
    expect(r.start).toEqual(new Date(2026, 2, 1, 0, 0, 0));
    expect(r.end).toEqual(new Date(2026, 5, 0, 23, 59, 59));
    expect(r.granularity).toBe("month");
  });

  it("custom single month uses day granularity", () => {
    const r = resolvePeriod(
      { mode: "custom", customType: "single", single: { year: 2026, month: 6 } },
      new Date(2026, 8, 1),
      t
    );
    expect(r.granularity).toBe("day");
    expect(r.start).toEqual(new Date(2026, 6, 1, 0, 0, 0));
  });
});

describe("pctChange", () => {
  it("returns null when there is no previous value to compare against", () => {
    expect(pctChange(50, 0)).toBeNull();
    expect(pctChange(50, null)).toBeNull();
  });

  it("computes signed percentage change", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
  });
});

describe("computeAvgDealSizeForCurrency", () => {
  it("averages only offers in the requested currency", () => {
    const offers = [
      { amount: 100, currency: "EGP" },
      { amount: 300, currency: "EGP" },
      { amount: 50, currency: "USD" },
    ];
    expect(computeAvgDealSizeForCurrency(offers, "EGP")).toBe(200);
    expect(computeAvgDealSizeForCurrency(offers, "USD")).toBe(50);
  });

  it("treats offers with no currency field as EGP", () => {
    const offers = [{ amount: 100 }, { amount: 200, currency: "EGP" }];
    expect(computeAvgDealSizeForCurrency(offers, "EGP")).toBe(150);
  });

  it("returns null when there are no offers in that currency", () => {
    expect(computeAvgDealSizeForCurrency([], "EGP")).toBeNull();
    expect(computeAvgDealSizeForCurrency([{ amount: 10, currency: "USD" }], "EGP")).toBeNull();
  });
});

describe("computeWinRate / computeDecidedCount", () => {
  it("counts both purchased and installed offers as wins", () => {
    const offersByStatus = {
      purchased: { count: 2 },
      installed: { count: 3 },
      rejected: { count: 1 },
      pending: { count: 10 },
    };
    // won = 5, rejected = 1, decided = 6 -> 5/6 = 83.33...%
    expect(computeWinRate(offersByStatus)).toBeCloseTo((5 / 6) * 100);
    expect(computeDecidedCount(offersByStatus)).toBe(6);
  });

  it("excludes pending offers from the denominator entirely", () => {
    const offersByStatus = { purchased: { count: 1 }, rejected: { count: 0 }, pending: { count: 50 } };
    expect(computeWinRate(offersByStatus)).toBe(100);
  });

  it("returns null when nothing has been decided yet", () => {
    expect(computeWinRate({ pending: { count: 5 } })).toBeNull();
    expect(computeDecidedCount({ pending: { count: 5 } })).toBe(0);
  });

  it("agrees with buildOfferBreakdown on what counts as converted/won", () => {
    const offersByStatus = {
      purchased: { count: 2, totals: { EGP: 200 } },
      installed: { count: 1, totals: { EGP: 100 } },
      rejected: { count: 1, totals: { EGP: 50 } },
      pending: { count: 0, totals: {} },
    };
    const breakdown = buildOfferBreakdown(offersByStatus);
    expect(computeDecidedCount(offersByStatus)).toBe(breakdown.convertedCount + breakdown.rejectedCount);
  });
});
