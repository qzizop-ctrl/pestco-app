// ============================================================================
// Phone/company-name normalization, duplicate-customer detection, and
// staleness (no recent activity) detection. Split out of the old helpers.js.
// ============================================================================
import { parseVisitDate, toJsDate } from "./dateUtils";
import { corePhoneDigits } from "./phone";

// corePhoneDigits lives in phone.js (it also understands Arabic-Indic digits);
// re-exported here so existing imports keep working.
export { corePhoneDigits };

// Generic Arabic business-entity words that don't help identify *which*
// company a name refers to (e.g. "شركة الاسكندرية" and "الاسكندرية" are
// almost certainly the same customer) — stripped as whole words after
// normalization below, never as a substring, so a company genuinely named
// just "مجموعة" isn't reduced to nothing. Written in their normalized form
// (ة already folded to ه) since that's what they're compared against.
const AR_ENTITY_WORDS = new Set(["شركه", "مؤسسه", "مجموعه", "مصنع", "معرض", "مكتب"]);

// Normalizes a company name for duplicate-matching. Trims/collapses
// whitespace and lowercases as before, plus Arabic-specific folding so
// common spelling variants of the same name actually match instead of
// silently missing the duplicate:
// - strips tashkeel (diacritics) and the tatweel elongation mark
// - folds every alef variant (أ إ آ ٱ) to plain ا
// - folds taa marbuta (ة) to ه and alef maksura (ى) to ي — the two most
//   common typing inconsistencies in Arabic business names
// - treats -, _, . and Arabic/Latin commas as word separators
// - drops generic entity words (شركة/مؤسسة/...) so "شركة X" and "X" match
function normalizeCompanyName(name) {
  const s = (name || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    // taa marbuta -> ه and alef maksura -> ي in a single pass
    .replace(/[ةى]/g, (c) => (c === "ة" ? "ه" : "ي"))
    .replace(/[-_.,،]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return s
    .split(" ")
    .filter((w) => w && !AR_ENTITY_WORDS.has(w))
    .join(" ");
}

// Per-record cache for the derived values below. Records coming from
// useLiveData keep the SAME object between snapshots unless that document
// changed (see snapshotCache.js), so keying a WeakMap on the object means only
// edited records are re-derived; everything else is a lookup. Entries vanish
// with the object, and a changed record is a new object, so nothing can go
// stale. Records are never mutated in place (React state).
function memoByObject(fn) {
  const cache = new WeakMap();
  return (obj) => {
    if (obj === null || typeof obj !== "object") return fn(obj);
    let hit = cache.get(obj);
    if (hit === undefined) {
      hit = fn(obj);
      cache.set(obj, hit);
    }
    return hit;
  };
}

const duplicateKeys = memoByObject((v) => ({
  phone: corePhoneDigits(v.phone),
  name: normalizeCompanyName(v.companyName),
}));

// Groups customers that share a phone number or a near-identical company
// name, so they can be reviewed and merged/cleaned up in one place.
export function findDuplicateGroups(visits) {
  // Null-prototype maps: a company literally named "constructor" or
  // "__proto__" must not collide with Object.prototype members.
  const phoneGroups = Object.create(null);
  const nameGroups = Object.create(null);

  visits.forEach((v) => {
    const { phone, name } = duplicateKeys(v);
    if (phone) {
      if (!phoneGroups[phone]) phoneGroups[phone] = [];
      phoneGroups[phone].push(v);
    }
    if (name) {
      if (!nameGroups[name]) nameGroups[name] = [];
      nameGroups[name].push(v);
    }
  });

  const groups = [];
  Object.values(phoneGroups).forEach((g) => {
    if (g.length > 1) groups.push({ reason: "phone", customers: g });
  });
  Object.values(nameGroups).forEach((g) => {
    if (g.length > 1) groups.push({ reason: "name", customers: g });
  });
  return groups;
}

// The most recent moment of any recorded activity on a customer: a visit,
// a scheduled call, a logged activity entry, or the record's creation —
// as epoch milliseconds, or null if there is none. Cached per record (it
// parses every activity entry, and the list recomputes on every snapshot).
const lastActivityMs = memoByObject((visit) => {
  let max = null;
  const take = (d) => {
    if (!d) return;
    const ms = d.getTime();
    if (!Number.isNaN(ms) && (max === null || ms > max)) max = ms;
  };
  take(parseVisitDate(visit.visitDate));
  if (visit.callDateTime) take(new Date(visit.callDateTime));
  (visit.activityLog || []).forEach((entry) => {
    if (entry.at) take(new Date(entry.at));
  });
  take(toJsDate(visit.createdAt));
  return max;
});

// True if a customer has had no recorded activity in over `days` days
// (or never had any activity at all).
export function isStaleCustomer(visit, days) {
  const last = lastActivityMs(visit);
  if (last === null) return true;
  const diffDays = (Date.now() - last) / (1000 * 3600 * 24);
  return diffDays > days;
}
