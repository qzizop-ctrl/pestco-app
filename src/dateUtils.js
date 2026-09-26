// ============================================================================
// Date parsing and formatting helpers. Split out of the old helpers.js
// (which mixed date logic with Excel import, form diffing, offers, etc.)
// so date-related code lives in one place. No React/Firebase.
// ============================================================================

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
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
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

// Today's date as yyyy-mm-dd in the user's LOCAL time zone.
// Never build this from `new Date().toISOString().slice(0, 10)`: toISOString()
// is UTC, so in Egypt (UTC+2/+3) anything logged between midnight and 2–3 AM
// local time would be stamped with yesterday's date. Same convention as
// toISODate() above, which already reads local getFullYear/getMonth/getDate.
export function todayLocalISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function fmtReminder(dt, locale) {
  try {
    const d = new Date(dt);
    return d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" });
  } catch {
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
  } catch {
    return "";
  }
}

export function fmtActivityDate(dt, locale) {
  try {
    const d = new Date(dt);
    return d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" });
  } catch {
    return dt;
  }
}
