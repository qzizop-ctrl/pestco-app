import { describe, it, expect } from "vitest";
import { buildOffer, describeOfferForAudit } from "./offerHelpers";
import { STRINGS } from "./i18n";

describe("buildOffer — rejection details", () => {
  const rejection = {
    rejectionReason: "Price too high",
    rejectionReasonId: "price",
    rejectedBy: "Sara",
    rejectedById: "u1",
    rejectedAt: "2026-06-15T12:00:00.000Z",
  };

  it("keeps the rejection details when an offer is created directly as rejected", () => {
    const offer = buildOffer({ name: "Contract A", amount: 100, status: "rejected", ...rejection });
    expect(offer.status).toBe("rejected");
    expect(offer.rejectionReason).toBe("Price too high");
    expect(offer.rejectionReasonId).toBe("price");
    expect(offer.rejectedBy).toBe("Sara");
    expect(offer.rejectedById).toBe("u1");
    expect(offer.rejectedAt).toBe("2026-06-15T12:00:00.000Z");
  });

  it("ignores rejection details on offers that are not rejected", () => {
    const offer = buildOffer({ name: "Contract A", status: "pending", ...rejection });
    expect(offer.rejectionReason).toBe("");
    expect(offer.rejectionReasonId).toBeUndefined();
    expect(offer.rejectedBy).toBeUndefined();
    expect(offer.rejectedAt).toBeUndefined();
  });

  it("leaves the shape of a normal offer unchanged", () => {
    const offer = buildOffer({ name: "Contract A", amount: "1500" });
    expect(offer.status).toBe("pending");
    expect(offer.rejectionReason).toBe("");
    expect(Object.keys(offer).sort()).toEqual([
      "amount", "createdAt", "currency", "id", "name", "offerDate", "offerNumber",
      "rejectionReason", "status", "supplierIds", "supplierNames",
    ]);
  });

  it("defaults a rejected offer with no reason to an empty reason (legacy behavior)", () => {
    const offer = buildOffer({ name: "Contract A", status: "rejected" });
    expect(offer.rejectionReason).toBe("");
    expect(offer.rejectionReasonId).toBeUndefined();
  });
});

describe("describeOfferForAudit", () => {
  const t = STRINGS.en;

  it("returns an empty string for a missing offer", () => {
    expect(describeOfferForAudit(null, t)).toBe("");
    expect(describeOfferForAudit(undefined, t)).toBe("");
  });

  it("describes name, number, amount, currency and status in one line", () => {
    const line = describeOfferForAudit(
      { name: "Spray contract", offerNumber: "A-12", amount: 2500, currency: "USD", status: "purchased" },
      t
    );
    expect(line).toBe(`Spray contract · #A-12 · 2,500 $ · ${t.offerStatuses.purchased}`);
  });

  it("appends the rejection reason only for rejected offers", () => {
    const rejected = describeOfferForAudit(
      { name: "X", amount: 10, currency: "EGP", status: "rejected", rejectionReason: "Price too high" },
      t
    );
    expect(rejected.endsWith("(Price too high)")).toBe(true);
    const pending = describeOfferForAudit(
      { name: "X", amount: 10, currency: "EGP", status: "pending", rejectionReason: "stale" },
      t
    );
    expect(pending).not.toContain("stale");
  });

  it("falls back to EGP for an unknown currency and tolerates a missing amount", () => {
    const line = describeOfferForAudit({ name: "Old offer", status: "pending", currency: "XXX" }, t);
    expect(line).toBe(`Old offer · 0 ${t.currencies.EGP} · ${t.offerStatuses.pending}`);
  });
});
