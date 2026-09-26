import { describe, it, expect } from "vitest";
import { computeRejectionReasonsReport } from "./dashboardCalculations";

// Minimal t stub — only rejectionReasons and unknownUser are touched.
const t = {
  rejectionReasons: {
    price: "السعر أعلى من المنافس",
    timing: "التوقيت غير مناسب",
    other: "سبب آخر",
  },
  unknownUser: "غير معروف",
};

describe("computeRejectionReasonsReport", () => {
  it("only counts offers with status 'rejected'", () => {
    const offers = [
      { status: "rejected", rejectionReasonId: "price" },
      { status: "accepted", rejectionReasonId: "price" },
      { status: "pending" },
    ];
    expect(computeRejectionReasonsReport(offers, t).total).toBe(1);
  });

  it("groups by rejectionReasonId and computes correct percentages", () => {
    const offers = [
      { status: "rejected", rejectionReasonId: "price" },
      { status: "rejected", rejectionReasonId: "price" },
      { status: "rejected", rejectionReasonId: "timing" },
      { status: "rejected", rejectionReasonId: "timing" },
    ];
    const { byReason } = computeRejectionReasonsReport(offers, t);
    expect(byReason).toEqual([
      { id: "price", label: t.rejectionReasons.price, count: 2, pct: 50 },
      { id: "timing", label: t.rejectionReasons.timing, count: 2, pct: 50 },
    ]);
  });

  it("buckets legacy offers with no rejectionReasonId into 'other' instead of dropping them", () => {
    const offers = [
      { status: "rejected", rejectionReason: "free text from before this feature existed" },
      { status: "rejected", rejectionReasonId: "price" },
    ];
    const { byReason, total } = computeRejectionReasonsReport(offers, t);
    expect(total).toBe(2);
    const other = byReason.find((r) => r.id === "other");
    expect(other).toEqual({ id: "other", label: t.rejectionReasons.other, count: 1, pct: 50 });
  });

  it("sorts reasons from most to least common", () => {
    const offers = [
      { status: "rejected", rejectionReasonId: "timing" },
      { status: "rejected", rejectionReasonId: "price" },
      { status: "rejected", rejectionReasonId: "price" },
      { status: "rejected", rejectionReasonId: "price" },
    ];
    const { byReason } = computeRejectionReasonsReport(offers, t);
    expect(byReason.map((r) => r.id)).toEqual(["price", "timing"]);
  });

  it("breaks down rejections by rep for comparison, falling back to unknownUser", () => {
    const offers = [
      { status: "rejected", rejectionReasonId: "price", rejectedBy: "Ali" },
      { status: "rejected", rejectionReasonId: "timing", rejectedBy: "Ali" },
      { status: "rejected", rejectionReasonId: "price", rejectedBy: "Sara" },
      { status: "rejected", rejectionReasonId: "price" },
    ];
    const { byRep } = computeRejectionReasonsReport(offers, t);
    expect(byRep).toEqual([
      { name: "Ali", count: 2 },
      { name: "Sara", count: 1 },
      { name: t.unknownUser, count: 1 },
    ]);
  });

  it("returns an empty report with no offers or no rejections", () => {
    expect(computeRejectionReasonsReport([], t)).toEqual({ total: 0, byReason: [], byRep: [] });
    expect(computeRejectionReasonsReport([{ status: "accepted" }], t)).toEqual({ total: 0, byReason: [], byRep: [] });
  });

  it("handles a missing/undefined offersInRange safely", () => {
    expect(computeRejectionReasonsReport(undefined, t)).toEqual({ total: 0, byReason: [], byRep: [] });
  });
});
