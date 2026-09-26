import { describe, it, expect } from "vitest";
import {
  resolvePeriod, pctChange, computeAvgDealSizeForCurrency,
  computeWinRate, computeDecidedCount, buildOfferBreakdown, computePeriodStats,
  computeTopClients, computeSectorBreakdown, computeStageConversionRates, buildOffersChartData,
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
    // from (June, 0-indexed: month 5) / to (March, month 2) given reversed
    // -> should normalize to March..June
    expect(r.start).toEqual(new Date(2026, 2, 1, 0, 0, 0));
    expect(r.end).toEqual(new Date(2026, 6, 0, 23, 59, 59));
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

describe("computePeriodStats", () => {
  // Jan 2026, matching a "custom single month" resolvePeriod() would
  // produce: monthRange(2026, 0) -> [Jan 1 00:00:00, Jan 31 23:59:59].
  const start = new Date(2026, 0, 1, 0, 0, 0);
  const end = new Date(2026, 0, 31, 23, 59, 59);

  it("counts every visit event in range, including boundary dates, but counts each distinct customer only once", () => {
    const visits = [
      {
        id: "c1",
        companyName: "Acme",
        sector: "construction",
        createdAt: "2026-01-10",
        // Two events for the same customer both land in-range -> 2 visit
        // events, but 1 distinct customer.
        visitHistory: [
          { id: "a", date: "2026-01-01" }, // exact start boundary
          { id: "b", date: "2026-01-31" }, // exact end boundary
        ],
      },
      {
        id: "c2",
        companyName: "Beta",
        sector: "education",
        createdAt: "2025-12-01",
        // Legacy single-visitDate shape, one event just outside the range.
        visitDate: "2025-12-31",
      },
    ];

    const stats = computePeriodStats(visits, start, end, "all", true);

    expect(stats.visitsCount).toBe(2);
    expect(stats.customersCount).toBe(1);
    expect(stats.filteredVisits.map((v) => v.id)).toEqual(["c1"]);
  });

  it("customersAddedInRange: counts a record by createdAt when present, regardless of visit activity", () => {
    const visits = [
      { id: "c1", companyName: "In range", sector: "construction", createdAt: "2026-01-15" },
      { id: "c2", companyName: "Out of range", sector: "construction", createdAt: "2025-06-01" },
    ];
    const stats = computePeriodStats(visits, start, end, "all", true);
    expect(stats.customersAddedList.map((v) => v.id)).toEqual(["c1"]);
    expect(stats.customersAddedCount).toBe(1);
  });

  it("customersAddedInRange: a dateless record that was never visited is always counted, single-month or not", () => {
    const visits = [
      { id: "c1", companyName: "No date, never visited", sector: "construction" },
    ];
    const single = computePeriodStats(visits, start, end, "all", true);
    const multi = computePeriodStats(visits, start, end, "all", false);
    expect(single.customersAddedList.map((v) => v.id)).toEqual(["c1"]);
    expect(multi.customersAddedList.map((v) => v.id)).toEqual(["c1"]);
  });

  it("customersAddedInRange: a dateless record that WAS visited only counts in multi-month views, not a single month", () => {
    const visits = [
      {
        id: "c1",
        companyName: "No date, already visited",
        sector: "construction",
        visitDate: "2026-01-20", // in range, so it still shows up in visitEventsInRange
      },
    ];
    const single = computePeriodStats(visits, start, end, "all", true);
    const multi = computePeriodStats(visits, start, end, "all", false);

    expect(single.customersAddedList.map((v) => v.id)).toEqual([]);
    expect(multi.customersAddedList.map((v) => v.id)).toEqual(["c1"]);
    // Still shows up as an actual visit either way — only the "added"
    // count is affected by isSingleMonth.
    expect(single.customersCount).toBe(1);
  });

  it("offersInRange is filtered purely by offerDate, independent of whether that customer has a logged visit event in range", () => {
    const visits = [
      {
        id: "c1",
        companyName: "Offer but no logged visit",
        sector: "construction",
        // No visitDate/visitHistory at all -> zero visit events.
        offers: [
          { amount: 500, currency: "EGP", status: "rejected", offerDate: "2026-01-10" },
          { amount: 999, currency: "EGP", status: "pending", offerDate: "2025-05-01" }, // out of range
        ],
      },
    ];
    const stats = computePeriodStats(visits, start, end, "all", true);

    expect(stats.visitsCount).toBe(0);
    expect(stats.customersCount).toBe(0);
    // But the offer inside the period still counts, decorated with the
    // customer's id/name/sector.
    expect(stats.offersInRange).toEqual([
      expect.objectContaining({
        amount: 500, status: "rejected", customerId: "c1", customerName: "Offer but no logged visit", sector: "construction",
      }),
    ]);
    expect(stats.offersCount).toBe(1);
  });

  it("offersValueTotals and offersByStatus sum correctly per currency, defaulting a missing currency to EGP", () => {
    const visits = [
      {
        id: "c1",
        companyName: "Acme",
        sector: "construction",
        visitDate: "2026-01-05",
        offers: [
          { amount: 1000, currency: "EGP", status: "purchased", offerDate: "2026-01-05" },
          { amount: 200, status: "pending", offerDate: "2026-01-06" }, // no currency -> EGP
          { amount: 50, currency: "USD", status: "rejected", offerDate: "2026-01-07" },
        ],
      },
    ];
    const stats = computePeriodStats(visits, start, end, "all", true);

    expect(stats.offersValueTotals).toEqual({ EGP: 1200, USD: 50 });
    expect(stats.offersByStatus.purchased).toEqual({ count: 1, totals: { EGP: 1000, USD: 0 } });
    expect(stats.offersByStatus.pending).toEqual({ count: 1, totals: { EGP: 200, USD: 0 } });
    expect(stats.offersByStatus.rejected).toEqual({ count: 1, totals: { EGP: 0, USD: 50 } });
    expect(stats.offersByStatus.installed).toEqual({ count: 0, totals: { EGP: 0, USD: 0 } });
  });

  it("pipeline counts by stage from filteredVisits only (customers who visited in-range), falling back to 'none' for a missing/unknown stage", () => {
    const visits = [
      { id: "c1", companyName: "A", sector: "construction", visitDate: "2026-01-05", stage: "quote" },
      { id: "c2", companyName: "B", sector: "construction", visitDate: "2026-01-06", stage: "quote" },
      { id: "c3", companyName: "C", sector: "construction", visitDate: "2026-01-07" }, // no stage at all
      { id: "c4", companyName: "D", sector: "construction", visitDate: "2026-01-08", stage: "not-a-real-stage" },
      // Added this period but never visited -> must NOT be counted in the pipeline.
      { id: "c5", companyName: "E", sector: "construction", createdAt: "2026-01-09", stage: "install" },
    ];
    const stats = computePeriodStats(visits, start, end, "all", true);

    expect(stats.pipeline).toEqual({
      survey: 0, quote: 2, install: 0, maintenance: 0, none: 2,
    });
  });

  it("sector filter is applied consistently across visit events, customersAdded, and offers", () => {
    const visits = [
      {
        id: "c1", companyName: "Construction co", sector: "construction",
        visitDate: "2026-01-05", createdAt: "2026-01-01",
        offers: [{ amount: 100, currency: "EGP", status: "pending", offerDate: "2026-01-05" }],
      },
      {
        id: "c2", companyName: "Education co", sector: "education",
        visitDate: "2026-01-06", createdAt: "2026-01-02",
        offers: [{ amount: 200, currency: "EGP", status: "pending", offerDate: "2026-01-06" }],
      },
    ];
    const stats = computePeriodStats(visits, start, end, "construction", true);

    expect(stats.visitsCount).toBe(1);
    expect(stats.customersAddedList.map((v) => v.id)).toEqual(["c1"]);
    expect(stats.offersInRange.map((o) => o.customerId)).toEqual(["c1"]);
  });
});

describe("computeTopClients", () => {
  it("groups a customer's offers together and sums their totals per currency", () => {
    const offers = [
      { customerId: "c1", customerName: "Acme", sector: "construction", amount: 100, currency: "EGP" },
      { customerId: "c1", customerName: "Acme", sector: "construction", amount: 50, currency: "EGP" },
      { customerId: "c1", customerName: "Acme", sector: "construction", amount: 20, currency: "USD" },
    ];
    const result = computeTopClients(offers);
    expect(result).toEqual([
      { customerId: "c1", customerName: "Acme", sector: "construction", offersCount: 3, totals: { EGP: 150, USD: 20 } },
    ]);
  });

  it("ranks by EGP total first, breaking ties with USD total, then offer count", () => {
    const offers = [
      // c1 and c2 tie on EGP (1000), c2 wins on USD (50 > 0)
      { customerId: "c1", customerName: "Low USD", amount: 1000, currency: "EGP" },
      { customerId: "c2", customerName: "High USD", amount: 1000, currency: "EGP" },
      { customerId: "c2", customerName: "High USD", amount: 50, currency: "USD" },
      // c3 has the highest EGP total outright
      { customerId: "c3", customerName: "Top EGP", amount: 5000, currency: "EGP" },
      // c4 and c5 tie on both EGP (0, no EGP offers) and USD (10 each) -> more offers wins
      { customerId: "c4", customerName: "One offer", amount: 10, currency: "USD" },
      { customerId: "c5", customerName: "Two offers", amount: 5, currency: "USD" },
      { customerId: "c5", customerName: "Two offers", amount: 5, currency: "USD" },
    ];
    const result = computeTopClients(offers, 10);
    expect(result.map((c) => c.customerId)).toEqual(["c3", "c2", "c1", "c5", "c4"]);
  });

  it("respects the limit parameter", () => {
    const offers = Array.from({ length: 8 }, (_, i) => ({
      customerId: `c${i}`, customerName: `Client ${i}`, amount: i + 1, currency: "EGP",
    }));
    expect(computeTopClients(offers, 3)).toHaveLength(3);
    expect(computeTopClients(offers)).toHaveLength(5); // default limit
  });

  it("falls back to customerName as the grouping key when customerId is missing, and skips offers with neither", () => {
    const offers = [
      { customerName: "Legacy Co", amount: 10, currency: "EGP" },
      { customerName: "Legacy Co", amount: 20, currency: "EGP" },
      { amount: 999, currency: "EGP" }, // neither id nor name -> dropped
    ];
    const result = computeTopClients(offers);
    expect(result).toEqual([
      { customerId: undefined, customerName: "Legacy Co", sector: undefined, offersCount: 2, totals: { EGP: 30, USD: 0 } },
    ]);
  });
});

describe("computeSectorBreakdown", () => {
  const start = new Date(2026, 0, 1, 0, 0, 0);
  const end = new Date(2026, 0, 31, 23, 59, 59);

  it("returns one entry per sector, in SECTOR_IDS order, using computePeriodStats scoped to that sector", () => {
    const visits = [
      {
        id: "c1", companyName: "Construction co", sector: "construction", visitDate: "2026-01-05",
        offers: [
          { amount: 1000, currency: "EGP", status: "purchased", offerDate: "2026-01-05" },
          { amount: 500, currency: "EGP", status: "rejected", offerDate: "2026-01-06" },
        ],
      },
      {
        id: "c2", companyName: "Education co", sector: "education", visitDate: "2026-01-07",
        offers: [{ amount: 300, currency: "EGP", status: "purchased", offerDate: "2026-01-07" }],
      },
    ];
    const breakdown = computeSectorBreakdown(visits, start, end, true);

    expect(breakdown.map((s) => s.id)).toEqual(["construction", "education", "consultants", "private"]);

    const construction = breakdown.find((s) => s.id === "construction");
    expect(construction.visitsCount).toBe(1);
    expect(construction.offersCount).toBe(2);
    expect(construction.offersValueTotals).toEqual({ EGP: 1500, USD: 0 });
    expect(construction.winRate).toBe(100 * (1 / 2)); // 1 purchased / (1 purchased + 1 rejected)

    // Sectors with no matching visits at all still come back with a full
    // zeroed-out entry rather than being omitted.
    const consultants = breakdown.find((s) => s.id === "consultants");
    expect(consultants.visitsCount).toBe(0);
    expect(consultants.offersCount).toBe(0);
    expect(consultants.winRate).toBeNull();
  });
});

describe("computeStageConversionRates", () => {
  it("computes each stage's conversion from the previous stage's count, with the first stage always null", () => {
    const pipeline = { survey: 10, quote: 5, install: 2, maintenance: 1 };
    expect(computeStageConversionRates(pipeline)).toEqual([
      { id: "survey", count: 10, pct: null },
      { id: "quote", count: 5, pct: 50 },
      { id: "install", count: 2, pct: 40 },
      { id: "maintenance", count: 1, pct: 50 },
    ]);
  });

  it("reports null (not a divide-by-zero artifact) when the previous stage has zero volume, distinct from a genuine 0% conversion", () => {
    const pipeline = { survey: 0, quote: 3, install: 0, maintenance: 0 };
    const rates = computeStageConversionRates(pipeline);
    // survey has no predecessor at all -> always null.
    expect(rates[0]).toEqual({ id: "survey", count: 0, pct: null });
    // quote's predecessor (survey) has 0 volume -> null, even though quote itself has 3.
    expect(rates[1]).toEqual({ id: "quote", count: 3, pct: null });
    // install's predecessor (quote) has real volume (3), and install genuinely got 0 of it -> a real 0%, not null.
    expect(rates[2]).toEqual({ id: "install", count: 0, pct: 0 });
    // maintenance's predecessor (install) is back to 0 volume -> null again.
    expect(rates[3]).toEqual({ id: "maintenance", count: 0, pct: null });
  });

  it("treats a missing stage key in the pipeline object as 0, not a crash", () => {
    expect(computeStageConversionRates({})).toEqual([
      { id: "survey", count: 0, pct: null },
      { id: "quote", count: 0, pct: null },
      { id: "install", count: 0, pct: null },
      { id: "maintenance", count: 0, pct: null },
    ]);
  });
});

describe("buildOffersChartData", () => {
  const months = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];

  it("day granularity: one bucket per day of the month, filtered by currency (missing currency treated as EGP)", () => {
    const start = new Date(2026, 1, 1); // Feb 2026 -> 28 days (not a leap year)
    const end = new Date(2026, 1, 28, 23, 59, 59);
    const offers = [
      { amount: 100, currency: "EGP", offerDate: "2026-02-05" },
      { amount: 50, currency: "USD", offerDate: "2026-02-05" }, // different currency -> excluded from EGP chart
      { amount: 200, offerDate: "2026-02-28" }, // no currency field -> treated as EGP
    ];
    const buckets = buildOffersChartData(offers, "EGP", "day", start, end, months);

    expect(buckets).toHaveLength(28);
    expect(buckets[4]).toEqual({ label: "5", value: 100 });
    expect(buckets[27]).toEqual({ label: "28", value: 200 });
    expect(buckets[0]).toEqual({ label: "1", value: 0 });
  });

  it("month granularity, single year: one bucket per month with no year suffix in the label", () => {
    const start = new Date(2026, 0, 1); // Jan 2026
    const end = new Date(2026, 1, 28, 23, 59, 59); // Feb 2026
    const offers = [
      { amount: 100, currency: "EGP", offerDate: "2026-01-15" },
      { amount: 200, currency: "EGP", offerDate: "2026-02-01" },
    ];
    const buckets = buildOffersChartData(offers, "EGP", "month", start, end, months);

    expect(buckets).toEqual([
      { year: 2026, month: 0, label: months[0].slice(0, 3), value: 100 },
      { year: 2026, month: 1, label: months[1].slice(0, 3), value: 200 },
    ]);
  });

  it("month granularity, spanning years: label includes a 2-digit year, and offers land in the right year+month bucket", () => {
    const start = new Date(2025, 10, 1); // Nov 2025
    const end = new Date(2026, 1, 28, 23, 59, 59); // Feb 2026
    const offers = [
      { amount: 10, currency: "EGP", offerDate: "2025-11-20" },
      { amount: 20, currency: "EGP", offerDate: "2026-01-05" },
      { amount: 30, currency: "EGP", offerDate: "2099-01-01" }, // outside every bucket -> silently dropped, not an error
    ];
    const buckets = buildOffersChartData(offers, "EGP", "month", start, end, months);

    expect(buckets.map((b) => b.label)).toEqual([
      `${months[10].slice(0, 3)} 25`, `${months[11].slice(0, 3)} 25`,
      `${months[0].slice(0, 3)} 26`, `${months[1].slice(0, 3)} 26`,
    ]);
    expect(buckets.map((b) => b.value)).toEqual([10, 0, 20, 0]);
  });
});
