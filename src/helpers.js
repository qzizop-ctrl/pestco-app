// ============================================================================
// Pure helper functions: Excel/date parsing and normalization, building
// activity/offer/visit-history entries, formatting (money, dates,
// reminders), and small data-shape utilities (tags, duplicate detection,
// WhatsApp links). No React/Firebase — split out of the old constants.js.
// ============================================================================
import { SECTOR_IDS, ROLE_IDS, STAGE_IDS, CURRENCY_IDS } from "./domain";
import { STRINGS } from "./i18n";

// Compares two loose "1.2.3"-style version strings numerically, part by
// part (NOT a string compare — "1.9.0" must read as older than "1.10.0",
// which "<" on the raw strings gets wrong). Missing/non-numeric parts
// count as 0, and extra parts on the longer string still count (so
// "1.2.1" > "1.2"). Returns -1 / 0 / 1 like a normal comparator. Used by
// useAppVersionGate to decide whether this build is older than the
// minimum version published in Firestore — see that hook and
// firestore.rules' config/appVersion.
export function compareVersions(a, b) {
  const partsA = String(a || "0").split(".");
  const partsB = String(b || "0").split(".");
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const na = parseInt(partsA[i], 10) || 0;
    const nb = parseInt(partsB[i], 10) || 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

// Splits a comma separated Excel cell into a clean tag array.
// Shared by both customer tags and supplier product tags.
export function parseTagsCell(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Collects the sorted, de-duplicated set of tags across a list of suppliers
// (their `tags` array), for populating the supplier "filter by product" list.
export function collectSupplierTags(suppliers) {
  const set = new Set();
  (suppliers || []).forEach((s) => (s.tags || []).forEach((t) => t && set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// Distinct, non-empty category values already entered across suppliers
// (e.g. "مبيدات", "معدات") — used to build the category filter chips on the
// suppliers list. Free-text like tags, not a fixed enum, so it only ever
// shows categories someone has actually typed in.
export function collectSupplierCategories(suppliers) {
  const set = new Set();
  (suppliers || []).forEach((s) => s.category && set.add(s.category.trim()));
  return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

// Matches an imported Excel cell value (Arabic or English label, or raw id) to a sector id
export function findSectorId(value) {
  const v = (value || "").toString().trim();
  if (SECTOR_IDS.includes(v)) return v;
  for (const langKey of Object.keys(STRINGS)) {
    const map = STRINGS[langKey].sectors;
    const found = Object.entries(map).find(([, label]) => label === v);
    if (found) return found[0];
  }
  return "private";
}

// Matches an imported Excel cell value (Arabic or English label, or raw id) to a role id
export function findRoleId(value) {
  const v = (value || "").toString().trim();
  if (ROLE_IDS.includes(v)) return v;
  for (const langKey of Object.keys(STRINGS)) {
    const map = STRINGS[langKey].roles;
    const found = Object.entries(map).find(([, label]) => label === v);
    if (found) return found[0];
  }
  return "other";
}

// Matches an imported Excel cell value (Arabic or English label, or raw id) to a pipeline stage id
export function findStageId(value) {
  const v = (value || "").toString().trim();
  if (STAGE_IDS.includes(v)) return v;
  for (const langKey of Object.keys(STRINGS)) {
    const map = STRINGS[langKey].stages;
    const found = Object.entries(map).find(([, label]) => label === v);
    if (found) return found[0];
  }
  return "survey";
}

// Parses a visitDate/offerDate value that might be stored as ISO (yyyy-mm-dd,
// from the date input) or as raw text like "d-m-yyyy" / "dd-mm-yyyy" (from
// older Excel imports), returning a real Date object so sorting/date-range
// filtering is correct regardless of which format is stored.
export function parseVisitDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d) ? null : d;
  }
  const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// Normalizes any supported date format back to ISO yyyy-mm-dd, the format
// the <input type="date"> control expects.
export function toISODate(str) {
  const d = parseVisitDate(str);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Normalizes an Excel cell (Date object or string) into a yyyy-mm-dd date string
export function normalizeExcelDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
  }
  return toISODate(val) || String(val).trim();
}

// Normalizes an Excel cell (Date object or string) into a yyyy-mm-ddThh:mm datetime-local string
export function normalizeExcelDateTime(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}T${pad(val.getHours())}:${pad(val.getMinutes())}`;
  }
  return String(val).trim();
}

// Builds a unique activity-log entry for a visit's timeline
export function buildActivity(type, text) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    text,
    at: new Date().toISOString(),
  };
}

// Builds a unique visit-history entry, used to track that an actual visit
// happened on a given date (as opposed to just "the current visitDate"),
// so the Dashboard can count real visit events per customer over time.
//
// `location`, when provided, is a plain { lat, lng } object captured from
// the device's GPS at the moment the visit was logged (see src/geo.js).
// It's optional and stored as `null` when unavailable (permission denied,
// unsupported device, or timed out) — older entries simply don't have this
// field at all, which every reader here already treats as "no location".
export function buildVisitEntry(date, location) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: date || new Date().toISOString().slice(0, 10),
    at: new Date().toISOString(),
    location: location || null,
  };
}

// Returns the list of visit events for a customer. Falls back to a single
// event built from visitDate for customers that predate visit-history
// tracking, so old data still counts correctly.
export function getVisitEvents(visit) {
  if (visit.visitHistory && visit.visitHistory.length) return visit.visitHistory;
  if (visit.visitDate) return [{ id: "legacy", date: visit.visitDate, at: null }];
  return [];
}

// Builds a unique offer entry for a customer's offers list
export function buildOffer({ name, offerNumber, amount, offerDate, status, currency, supplierIds, supplierNames }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || "",
    offerNumber: offerNumber || "",
    amount: Number(amount) || 0,
    currency: CURRENCY_IDS.includes(currency) ? currency : "EGP",
    offerDate: offerDate || "",
    status: status || "pending",
    rejectionReason: "",
    // Many-to-many link to suppliers. supplierNames is a snapshot taken at
    // save time (same pattern as everywhere else names get denormalized in
    // this app) so a later rename/delete of a supplier doesn't change what
    // an already-saved offer displays.
    supplierIds: Array.isArray(supplierIds) ? supplierIds : [],
    supplierNames: Array.isArray(supplierNames) ? supplierNames : [],
    createdAt: new Date().toISOString(),
  };
}

// Sums a list of offers per currency, e.g. { EGP: 12000, USD: 500 }.
// Offers with no currency field (created before multi-currency support)
// are treated as EGP.
export function sumOffersByCurrency(offers) {
  const totals = {};
  CURRENCY_IDS.forEach((id) => (totals[id] = 0));
  (offers || []).forEach((o) => {
    const cur = CURRENCY_IDS.includes(o.currency) ? o.currency : "EGP";
    totals[cur] += Number(o.amount) || 0;
  });
  return totals;
}

// Formats a per-currency totals map (from sumOffersByCurrency) into a
// human-readable string, e.g. "12,000 جنيه + 500 دولار". Omits currencies
// with a zero total; returns "" if everything is zero — unless
// showAllIfEmpty is set, in which case an all-zero total renders every
// currency at 0 (e.g. "0 جنيه + 0 دولار") instead of collapsing to "".
export function fmtOffersTotals(totals, t, { showAllIfEmpty = false } = {}) {
  const nonZeroIds = CURRENCY_IDS.filter((id) => totals[id]);
  const ids = nonZeroIds.length > 0 ? nonZeroIds : (showAllIfEmpty ? CURRENCY_IDS : []);
  const joined = ids
    .map((id) => `${fmtMoney(totals[id] || 0, t.locale)} ${t.currencies[id]}`)
    .join(" + ");
  if (!joined) return joined;
  // Wrap in Unicode isolate marks (LRI ... PDI) so the amount+currency
  // sequence is treated as a single left-to-right block by the bidi
  // algorithm. Without this, joining two currency segments with " + "
  // (e.g. "0 EG + 0 $") gets visually reordered/scrambled when rendered
  // inside an RTL (Arabic) container — each segment becomes its own bidi
  // run and the runs get flipped relative to each other. Isolating the
  // whole string keeps it left-to-right and in the same order in every
  // locale.
  return `\u2066${joined}\u2069`;
}

export function visitStatus(visit) {
  if (!visit.callDateTime) return "none";
  const call = new Date(visit.callDateTime);
  const now = new Date();
  if (call.getTime() < now.getTime()) return "overdue";
  const sameDay =
    call.getFullYear() === now.getFullYear() &&
    call.getMonth() === now.getMonth() &&
    call.getDate() === now.getDate();
  if (sameDay) return "today";
  return "upcoming";
}

export function fmtReminder(dt, locale) {
  try {
    const d = new Date(dt);
    return d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" });
  } catch (e) {
    return dt;
  }
}

// Formats a Firestore createdAt timestamp (or a plain Date/string) into a
// locale-aware "date added" display string.
// Converts a Firestore createdAt timestamp (or a plain Date/string) into a
// JS Date, or null if it's missing/invalid. Shared by fmtCreatedAt and any
// code that needs to filter/compare by creation date.
export function toJsDate(ts) {
  if (!ts) return null;
  const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return isNaN(d) ? null : d;
}

export function fmtCreatedAt(ts, locale) {
  const d = toJsDate(ts);
  if (!d) return "";
  try {
    return d.toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" });
  } catch (e) {
    return "";
  }
}

export function fmtActivityDate(dt, locale) {
  try {
    const d = new Date(dt);
    return d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" });
  } catch (e) {
    return dt;
  }
}

// Always renders Western (Latin) digits, even under the "ar-EG" locale,
// which would otherwise switch to Arabic-Indic numerals (٠١٢٣...) and mix
// with the plain Western digits used elsewhere in the app (e.g. raw counts
// rendered without formatting). Keeping every on-screen number in the same
// digit system avoids that inconsistency.
//
// This is done with plain string manipulation instead of
// Number.toLocaleString(), even with "en-US" forced. Some Android WebView
// builds (notably the stripped-down ICU shipped with certain Capacitor/
// Android combinations) ignore the locale argument entirely and fall back
// to the device's system language — so on an Arabic-language phone,
// toLocaleString("en-US") can still silently produce Arabic-Indic digits
// and an Arabic decimal separator. Building the string by hand (digits,
// comma, period — nothing else) sidesteps ICU/locale behavior altogether
// and guarantees the same output on every device. The `locale` param is
// kept for call-site compatibility but no longer affects the output.
export function fmtMoney(n, locale) {
  try {
    let num = Number(n);
    if (!isFinite(num)) num = 0;
    const negative = num < 0;
    num = Math.abs(num);
    // Match toLocaleString's default rounding (up to 3 fraction digits).
    num = Math.round(num * 1000) / 1000;
    const [intPart, decPart] = num.toString().split(".");
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (negative ? "-" : "") + withThousands + (decPart ? "." + decPart : "");
  } catch (e) {
    return String(n || 0);
  }
}

// Normalizes a phone number to its core digits, ignoring +2 / 0020 / leading 0 variations
export function corePhoneDigits(phone) {
  let d = (phone || "").replace(/[^0-9]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("20") && d.length > 10) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

// Plain wa.me link, used as the <a href> so the button stays a real,
// right-clickable/shareable link. On Android the actual click is instead
// routed through openWhatsApp() in src/nativeWhatsApp.js, which opens
// WhatsApp Business directly via a native Android Intent — a WebView has no
// way to target one specific app from a link string alone (an "intent://"
// URL looks like it should work, but Capacitor's WebView doesn't parse that
// special Chrome-only syntax, so it silently does nothing).
export function buildWhatsAppLink(phone) {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}`;
}

// Normalizes a company name for duplicate-matching (trim, lowercase, collapse spaces)
export function normalizeCompanyName(name) {
  return (name || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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
export function lastActivityDate(visit) {
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
