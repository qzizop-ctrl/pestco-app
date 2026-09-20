import { describe, it, expect } from "vitest";
import {
  collectSupplierTags,
  collectSupplierCategories,
  buildOffer,
  sumOffersByCurrency,
  fmtOffersTotals,
  visitStatus,
  fmtMoney,
  corePhoneDigits,
  buildWhatsAppLink,
  findDuplicateGroups,
  isStaleCustomer,
  getVisitEvents,
} from "./helpers";
import { STRINGS } from "./i18n";

// findSectorId/findRoleId/findStageId/parseTagsCell/parseVisitDate/toISODate/
// normalizeExcelDate are already covered in helpers.excelImport.test.js —
// not repeated here.

describe("collectSupplierTags / collectSupplierCategories", () => {
  it("dedupes and sorts tags across suppliers, ignoring missing tags", () => {
    const suppliers = [
      { tags: ["b", "a"] },
      { tags: ["a", "c"] },
      {},
    ];
    expect(collectSupplierTags(suppliers)).toEqual(["a", "b", "c"]);
  });

  it("dedupes, trims, sorts, and drops empty categories", () => {
    const suppliers = [{ category: " Pesticides " }, { category: "Pesticides" }, { category: "" }, {}];
    expect(collectSupplierCategories(suppliers)).toEqual(["Pesticides"]);
  });
});

describe("buildOffer / sumOffersByCurrency / fmtOffersTotals", () => {
  it("defaults currency to EGP and coerces amount to a number", () => {
    const offer = buildOffer({ name: "Contract A", amount: "1500" });
    expect(offer.currency).toBe("EGP");
    expect(offer.amount).toBe(1500);
    expect(offer.status).toBe("pending");
    expect(offer.supplierIds).toEqual([]);
  });

  it("keeps a valid non-default currency", () => {
    const offer = buildOffer({ amount: 10, currency: "USD" });
    expect(offer.currency).toBe("USD");
  });

  it("sums offers per currency, treating an unknown/missing currency as EGP", () => {
    const offers = [
      { amount: 100, currency: "EGP" },
      { amount: 50, currency: "USD" },
      { amount: 25 }, // no currency field -> EGP
    ];
    expect(sumOffersByCurrency(offers)).toEqual({ EGP: 125, USD: 50 });
  });

  it("fmtOffersTotals omits zero currencies by default and returns '' when everything is zero", () => {
    const t = STRINGS.ar;
    expect(fmtOffersTotals({ EGP: 0, USD: 0 }, t)).toBe("");
    const text = fmtOffersTotals({ EGP: 1000, USD: 0 }, t);
    expect(text).toContain("1,000");
    expect(text).not.toContain(t.currencies.USD);
  });

  it("fmtOffersTotals shows every currency at 0 when showAllIfEmpty is set", () => {
    const t = STRINGS.ar;
    const text = fmtOffersTotals({ EGP: 0, USD: 0 }, t, { showAllIfEmpty: true });
    expect(text).toContain(t.currencies.EGP);
    expect(text).toContain(t.currencies.USD);
  });
});

describe("visitStatus", () => {
  it("returns 'none' when there's no scheduled call", () => {
    expect(visitStatus({})).toBe("none");
  });

  it("returns 'overdue' for a call time in the past", () => {
    expect(visitStatus({ callDateTime: "2000-01-01T10:00:00" })).toBe("overdue");
  });

  it("returns 'upcoming' for a call time far in the future", () => {
    const future = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
    expect(visitStatus({ callDateTime: future })).toBe("upcoming");
  });
});

describe("fmtMoney", () => {
  it("adds thousands separators", () => {
    expect(fmtMoney(12000)).toBe("12,000");
  });

  it("handles negatives and non-finite input", () => {
    expect(fmtMoney(-500)).toBe("-500");
    expect(fmtMoney(NaN)).toBe("0");
    expect(fmtMoney(undefined)).toBe("0");
  });

  it("keeps decimal fractions", () => {
    expect(fmtMoney(1234.5)).toBe("1,234.5");
  });
});

describe("corePhoneDigits / buildWhatsAppLink", () => {
  it("strips a leading 00 country-code prefix", () => {
    expect(corePhoneDigits("0020101234567")).toBe("101234567");
  });

  it("strips a bare 20 country code when the number is long enough", () => {
    expect(corePhoneDigits("201012345678")).toBe("1012345678");
  });

  it("strips a single leading 0 (local format)", () => {
    expect(corePhoneDigits("01012345678")).toBe("1012345678");
  });

  it("returns '' for an empty/undefined phone", () => {
    expect(corePhoneDigits("")).toBe("");
    expect(corePhoneDigits(undefined)).toBe("");
  });

  it("builds a wa.me link from the digits only, without stripping any prefix", () => {
    expect(buildWhatsAppLink("+20 (10) 123-4567")).toBe("https://wa.me/20101234567");
  });
});

describe("findDuplicateGroups", () => {
  it("groups customers sharing the same normalized phone number", () => {
    const visits = [
      { id: "1", companyName: "A Co", phone: "01012345678" },
      { id: "2", companyName: "B Co", phone: "0020101234 5678" },
      { id: "3", companyName: "C Co", phone: "01099999999" },
    ];
    const groups = findDuplicateGroups(visits);
    const phoneGroup = groups.find((g) => g.reason === "phone");
    expect(phoneGroup.customers.map((c) => c.id).sort()).toEqual(["1", "2"]);
  });

  it("groups customers sharing a near-identical company name", () => {
    const visits = [
      { id: "1", companyName: "  Acme   Co " },
      { id: "2", companyName: "acme co" },
      { id: "3", companyName: "Other Co" },
    ];
    const groups = findDuplicateGroups(visits);
    const nameGroup = groups.find((g) => g.reason === "name");
    expect(nameGroup.customers.map((c) => c.id).sort()).toEqual(["1", "2"]);
  });

  it("groups Arabic company names across alef/taa-marbuta spelling and entity-word variants", () => {
    const visits = [
      { id: "1", companyName: "شركة الإسكندرية" },
      { id: "2", companyName: "الاسكندريه" },
      { id: "3", companyName: "مؤسسة القاهرة" },
    ];
    const groups = findDuplicateGroups(visits);
    const nameGroup = groups.find((g) => g.reason === "name");
    expect(nameGroup.customers.map((c) => c.id).sort()).toEqual(["1", "2"]);
  });

  it("returns no groups when nothing overlaps", () => {
    const visits = [
      { id: "1", companyName: "A", phone: "01011111111" },
      { id: "2", companyName: "B", phone: "01022222222" },
    ];
    expect(findDuplicateGroups(visits)).toEqual([]);
  });
});

describe("isStaleCustomer", () => {
  it("is stale (true) when there's no recorded activity at all", () => {
    expect(isStaleCustomer({}, 30)).toBe(true);
  });

  it("is not stale right after a visit today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isStaleCustomer({ visitDate: today }, 30)).toBe(false);
  });

  it("is stale when the last visit is older than the threshold", () => {
    expect(isStaleCustomer({ visitDate: "2000-01-01" }, 30)).toBe(true);
  });
});

describe("getVisitEvents", () => {
  it("prefers visitHistory when present", () => {
    const history = [{ id: "a", date: "2024-01-01" }];
    expect(getVisitEvents({ visitHistory: history, visitDate: "2024-02-02" })).toBe(history);
  });

  it("falls back to a single legacy event built from visitDate", () => {
    expect(getVisitEvents({ visitDate: "2024-02-02" })).toEqual([
      { id: "legacy", date: "2024-02-02", at: null },
    ]);
  });

  it("returns an empty array when there's nothing to show", () => {
    expect(getVisitEvents({})).toEqual([]);
  });
});
