// ============================================================================
// Excel import helpers: matching an imported cell value to a known id,
// normalizing Excel date cells, and splitting duplicate rows on import.
// Split out of the old helpers.js.
// ============================================================================
import { SECTOR_IDS, ROLE_IDS, STAGE_IDS } from "./domain";
import { STRINGS } from "./i18n";
import { toISODate } from "./dateUtils";
import { corePhoneDigits } from "./customerDuplicates";

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

// Splits Excel-import rows into ones worth writing and duplicates to skip.
// A row is a duplicate when its phone (compared by corePhoneDigits, so
// +20 / 0020 / leading-0 variants match) equals the phone of an existing
// non-deleted record, or of an earlier row in the same file. Rows without a
// phone are never treated as duplicates. This also makes re-running an
// import that failed half way safe: rows already written are skipped.
export function splitImportDuplicates(rows, existing, getPhone) {
  const seen = new Set();
  (existing || []).forEach((e) => {
    if (e && !e.deleted) {
      const key = corePhoneDigits(e.phone);
      if (key) seen.add(key);
    }
  });
  const kept = [];
  let skipped = 0;
  rows.forEach((row) => {
    const key = corePhoneDigits(getPhone(row));
    if (key && seen.has(key)) {
      skipped += 1;
      return;
    }
    if (key) seen.add(key);
    kept.push(row);
  });
  return { kept, skipped };
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
