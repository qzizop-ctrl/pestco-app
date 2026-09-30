import { describe, it, expect } from "vitest";
import { sortVisitsForList } from "./visitSort";
import { visitStatus } from "./activityHelpers";
import { parseVisitDate } from "./dateUtils";

// The comparator this module replaced, kept here verbatim as the reference:
// the optimized sort must produce exactly the same order.
function referenceSort(list) {
  return list.slice().sort((a, b) => {
    if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
    const sa = visitStatus(a);
    const sb = visitStatus(b);
    const order = { overdue: 0, today: 1, upcoming: 2, none: 3 };
    if (order[sa] !== order[sb]) return order[sa] - order[sb];
    const da = parseVisitDate(a.visitDate);
    const db = parseVisitDate(b.visitDate);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db - da;
  });
}

const DAY = 24 * 3600 * 1000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

// Small deterministic PRNG so failures are reproducible.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function randomVisits(n, seed) {
  const r = rng(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  return Array.from({ length: n }, (_, i) => ({
    id: `v${i}`,
    isPinned: r() < 0.1 ? true : pick([false, undefined]),
    callDateTime: pick([
      "",
      undefined,
      new Date(Date.now() - 3 * DAY).toISOString(), // overdue
      new Date(Date.now() + 60 * 1000).toISOString(), // today/upcoming
      new Date(Date.now() + 5 * DAY).toISOString(), // upcoming
    ]),
    // A small set of dates so there are plenty of ties (stability matters).
    visitDate: pick([iso(-10), iso(-10), iso(-3), iso(0), "12/03/2025", "", undefined, "not a date"]),
  }));
}

describe("sortVisitsForList", () => {
  it("returns a new array and leaves the input untouched", () => {
    const input = randomVisits(10, 1);
    const copy = input.slice();
    const out = sortVisitsForList(input);
    expect(out).not.toBe(input);
    expect(input).toEqual(copy);
  });

  it("handles an empty list", () => {
    expect(sortVisitsForList([])).toEqual([]);
  });

  it("puts pinned first, then overdue → today/upcoming → no reminder, then newest visit first", () => {
    const a = { id: "a", visitDate: iso(-5) }; // no reminder, older
    const b = { id: "b", visitDate: iso(-1) }; // no reminder, newer
    const c = { id: "c", visitDate: iso(-20), callDateTime: new Date(Date.now() - DAY).toISOString() }; // overdue
    const d = { id: "d", visitDate: iso(-20), isPinned: true }; // pinned wins over everything
    const e = { id: "e", visitDate: iso(-20), callDateTime: new Date(Date.now() + 5 * DAY).toISOString() }; // upcoming
    expect(sortVisitsForList([a, b, c, d, e]).map((v) => v.id)).toEqual(["d", "c", "e", "b", "a"]);
  });

  it("records without a valid visit date go last within their group, and keep their relative order", () => {
    const list = [
      { id: "x1", visitDate: "" },
      { id: "dated", visitDate: iso(-2) },
      { id: "x2", visitDate: "garbage" },
    ];
    expect(sortVisitsForList(list).map((v) => v.id)).toEqual(["dated", "x1", "x2"]);
  });

  it("is stable: fully tied records keep their incoming order", () => {
    const list = Array.from({ length: 50 }, (_, i) => ({ id: `t${i}`, visitDate: iso(-4) }));
    expect(sortVisitsForList(list).map((v) => v.id)).toEqual(list.map((v) => v.id));
  });

  it("produces exactly the same order as the original comparator on random data", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const visits = randomVisits(300, seed);
      expect(sortVisitsForList(visits).map((v) => v.id)).toEqual(referenceSort(visits).map((v) => v.id));
    }
  });
});
