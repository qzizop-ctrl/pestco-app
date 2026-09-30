import { describe, it, expect } from "vitest";
import { corePhoneDigits, findDuplicateGroups, isStaleCustomer } from "./customerDuplicates";
import { parseVisitDate, toJsDate } from "./dateUtils";

// Reference copy of the pre-cache lastActivityDate/isStaleCustomer logic, to
// prove the cached version answers identically.
function referenceIsStale(visit, days) {
  const dates = [];
  const vd = parseVisitDate(visit.visitDate);
  if (vd) dates.push(vd);
  if (visit.callDateTime) {
    const cd = new Date(visit.callDateTime);
    if (!isNaN(cd)) dates.push(cd);
  }
  (visit.activityLog || []).forEach((entry) => {
    if (entry.at) {
      const d = new Date(entry.at);
      if (!isNaN(d)) dates.push(d);
    }
  });
  const created = toJsDate(visit.createdAt);
  if (created) dates.push(created);
  if (dates.length === 0) return true;
  const last = new Date(Math.max(...dates.map((d) => d.getTime())));
  return (Date.now() - last.getTime()) / (1000 * 3600 * 24) > days;
}

const DAY = 24 * 3600 * 1000;
const ago = (days) => new Date(Date.now() - days * DAY);

describe("isStaleCustomer (cached per record)", () => {
  const samples = [
    {},
    { visitDate: "2000-01-01" },
    { visitDate: ago(2).toISOString().slice(0, 10) },
    { callDateTime: ago(40).toISOString() },
    { callDateTime: "not a date", visitDate: "also not a date" },
    { activityLog: [{ at: ago(90).toISOString() }, { at: ago(5).toISOString() }, { at: "bad" }, { text: "no at" }] },
    { createdAt: ago(10) },
    { createdAt: { toDate: () => ago(100) } },
    { visitDate: "2000-01-01", activityLog: [{ at: ago(20).toISOString() }] },
  ];

  it("answers exactly like the original implementation, for several thresholds", () => {
    for (const v of samples) {
      for (const days of [1, 7, 30, 365]) {
        expect(isStaleCustomer(v, days)).toBe(referenceIsStale(v, days));
      }
    }
  });

  it("asking twice about the same record gives the same answer (cache hit)", () => {
    const v = { visitDate: ago(50).toISOString().slice(0, 10) };
    expect(isStaleCustomer(v, 30)).toBe(true);
    expect(isStaleCustomer(v, 30)).toBe(true);
    expect(isStaleCustomer(v, 100)).toBe(false); // same cached date, different threshold
  });

  it("an edited record (a NEW object, as the snapshot cache produces) is re-evaluated", () => {
    const before = { id: "a", visitDate: "2000-01-01" };
    expect(isStaleCustomer(before, 30)).toBe(true);
    const after = { ...before, visitDate: ago(1).toISOString().slice(0, 10) };
    expect(isStaleCustomer(after, 30)).toBe(false);
  });
});

describe("findDuplicateGroups (cached keys)", () => {
  it("still groups by phone variants and by normalized name", () => {
    const a = { id: "a", companyName: "شركة النور", phone: "01012345678" };
    const b = { id: "b", companyName: "النور", phone: "+20 101 234 5678" };
    const c = { id: "c", companyName: "Other", phone: "0100000000" };
    const groups = findDuplicateGroups([a, b, c]);
    expect(groups.map((g) => g.reason).sort()).toEqual(["name", "phone"]);
    groups.forEach((g) => expect(g.customers.map((x) => x.id).sort()).toEqual(["a", "b"]));
  });

  it("a record edited into a duplicate (new object) is picked up on the next call", () => {
    const a = { id: "a", companyName: "Alpha", phone: "0101111111" };
    const b = { id: "b", companyName: "Beta", phone: "0102222222" };
    expect(findDuplicateGroups([a, b])).toEqual([]);
    const b2 = { ...b, phone: "0101111111" };
    const groups = findDuplicateGroups([a, b2]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe("phone");
  });

  it("company names that collide with Object.prototype members don't crash or group wrongly", () => {
    const list = [
      { id: "1", companyName: "constructor", phone: "" },
      { id: "2", companyName: "__proto__", phone: "" },
      { id: "3", companyName: "toString", phone: "" },
    ];
    expect(findDuplicateGroups(list)).toEqual([]);
    const dup = findDuplicateGroups([...list, { id: "4", companyName: "Constructor", phone: "" }]);
    expect(dup).toHaveLength(1);
    expect(dup[0].customers.map((x) => x.id).sort()).toEqual(["1", "4"]);
  });

  it("corePhoneDigits is unchanged", () => {
    expect(corePhoneDigits("+20 101 234 5678")).toBe("1012345678");
  });
});
