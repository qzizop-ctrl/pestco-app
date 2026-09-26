// ============================================================================
// Phone/company-name normalization, duplicate-customer detection, and
// staleness (no recent activity) detection. Split out of the old helpers.js.
// ============================================================================
import { parseVisitDate, toJsDate } from "./dateUtils";

// Normalizes a phone number to its core digits, ignoring +2 / 0020 / leading 0 variations
export function corePhoneDigits(phone) {
  let d = (phone || "").replace(/[^0-9]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("20") && d.length > 10) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

// Generic Arabic business-entity words that don't help identify *which*
// company a name refers to (e.g. "شركة الاسكندرية" and "الاسكندرية" are
// almost certainly the same customer) — stripped as whole words after
// normalization below, never as a substring, so a company genuinely named
// just "مجموعة" isn't reduced to nothing. Written in their normalized form
// (ة already folded to ه) since that's what they're compared against.
const AR_ENTITY_WORDS = ["شركه", "مؤسسه", "مجموعه", "مصنع", "معرض", "مكتب"];

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
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[-_.,،]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return s
    .split(" ")
    .filter((w) => w && !AR_ENTITY_WORDS.includes(w))
    .join(" ");
}

// Groups customers that share a phone number or a near-identical company
// name, so they can be reviewed and merged/cleaned up in one place.
export function findDuplicateGroups(visits) {
  const phoneGroups = {};
  const nameGroups = {};

  visits.forEach((v) => {
    const phone = corePhoneDigits(v.phone);
    if (phone) {
      if (!phoneGroups[phone]) phoneGroups[phone] = [];
      phoneGroups[phone].push(v);
    }
    const name = normalizeCompanyName(v.companyName);
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
// a scheduled call, a logged activity entry, or the record's creation.
function lastActivityDate(visit) {
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
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

// True if a customer has had no recorded activity in over `days` days
// (or never had any activity at all).
export function isStaleCustomer(visit, days) {
  const last = lastActivityDate(visit);
  if (!last) return true;
  const diffDays = (Date.now() - last.getTime()) / (1000 * 3600 * 24);
  return diffDays > days;
}
