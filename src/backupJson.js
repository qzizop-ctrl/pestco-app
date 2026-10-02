// ============================================================================
// Pure helpers for the full JSON backup (see hooks/useJsonBackup.js).
//
// The Excel export / weekly Excel backup only keeps ~11 columns per customer:
// no offers (amounts, statuses, rejection reasons), no activity log, no visit
// history, no pending last_change, no audit trail. This builds a lossless dump
// of the raw Firestore documents instead, so nothing the app stores is missing
// from a backup. Free of React / Firebase so it is easy to unit-test.
// ============================================================================

export const BACKUP_FORMAT = "pestco-backup";
export const BACKUP_VERSION = 1;

// Firestore Timestamps (anything with toDate()) and Dates become ISO strings;
// undefined / functions are dropped; everything else is copied structurally.
// JSON.stringify alone would turn a Timestamp into { seconds, nanoseconds },
// which no longer says what it is.
export function serializeForBackup(value) {
  if (value === undefined || typeof value === "function") return undefined;
  if (value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "object") return value;
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) {
    return value.map((v) => {
      const out = serializeForBackup(v);
      return out === undefined ? null : out;
    });
  }
  const out = {};
  Object.keys(value).forEach((k) => {
    const v = serializeForBackup(value[k]);
    if (v !== undefined) out[k] = v;
  });
  return out;
}

// auditLog: array of entries, or null when it could not be read (then
// `auditLogError` says why — the backup is still worth saving without it).
export function buildBackup({
  ownerUid, exportedBy, visits, suppliers, auditLog, auditLogError, auditLogTruncated, now = new Date(),
}) {
  const v = serializeForBackup(visits || []);
  const s = serializeForBackup(suppliers || []);
  const a = auditLog ? serializeForBackup(auditLog) : null;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    ownerUid: ownerUid || null,
    exportedBy: exportedBy || null,
    counts: {
      visits: v.length,
      suppliers: s.length,
      auditLog: a ? a.length : null,
    },
    ...(auditLogError ? { auditLogError: String(auditLogError) } : {}),
    ...(auditLogTruncated ? { auditLogTruncated: true } : {}),
    visits: v,
    suppliers: s,
    auditLog: a,
  };
}

export function backupFileName(dateISO) {
  return `pestco_full_backup_${dateISO}.json`;
}

// btoa() only takes Latin-1, and the data is Arabic: encode to UTF-8 bytes
// first, in chunks so a large backup doesn't overflow the call stack.
export function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCodePoint.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
