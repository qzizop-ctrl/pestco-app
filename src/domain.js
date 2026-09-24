// ============================================================================
// Domain-shape constants: the fixed id lists that drive sectors/roles/
// stages/offer statuses/currencies, numeric thresholds and limits, and the
// blank-record shape used to initialize the customer/supplier forms.
// Split out of the old constants.js.
// ============================================================================

export const STALE_OFFER_DAYS = 30;

export const STALE_ACTIVITY_DAYS = 90;

// Upper bound on how many entries a single customer's activity timeline
// keeps. Past this, the OLDEST entry is dropped whenever a new one is
// added (see useActivityLog.js#makeAppendActivity) — this stays a plain
// array field on the visit document (see buildActivity/activityLog), so
// without a cap a long-lived customer could in principle push the whole
// document toward Firestore's 1MB-per-document limit. Comfortably above
// what any real customer accumulates in normal use.
export const ACTIVITY_LOG_CAP = 50;

// Upper bound on rows accepted by a single Excel import (visits or
// suppliers). Two reasons: a very large file run sequentially used to be
// slow with no feedback, and it protects against pasting in the wrong file
// (e.g. thousands of rows) by mistake. Comfortably above any realistic
// manual import; someone with more data should split the file.
export const MAX_IMPORT_ROWS = 2000;

// Firestore's writeBatch() hard limit is 500 operations. Every imported row
// is TWO writes now (the record + its audit-log entry), so 200 rows = 400
// operations, leaving headroom under the limit.
export const IMPORT_BATCH_SIZE = 200;

export const ROLE_IDS = ["purchasing", "it", "technical", "other"];

export const SECTOR_IDS = ["construction", "education", "consultants", "private"];

export const STAGE_IDS = ["survey", "quote", "install", "maintenance"];

export const OFFER_STATUS_IDS = ["pending", "purchased", "rejected", "installed"];

export const CURRENCY_IDS = ["EGP", "USD"];

// Predefined offer-rejection reasons a rep chooses from in
// RejectionReasonModal, instead of relying only on free text — see
// src/dashboardCalculations.js#computeRejectionReasonsReport, which groups
// rejected offers by this id for the Dashboard's rejection-reasons report.
// "other" always keeps its free-text field (offer.rejectionReason) for the
// actual detail; every other id here just stores its own localized label
// in offer.rejectionReason so old rendering code (CustomerDetail.jsx) needs
// no change. Offers saved before this feature existed have no
// rejectionReasonId at all — they're treated as "other" everywhere this id
// is grouped on, so old free-text reasons still count instead of vanishing.
export const REJECTION_REASON_IDS = [
  "price", "timing", "chose_other_supplier", "project_postponed",
  "not_needed_now", "payment_terms", "other",
];

// What kind of write an audit-log entry records.
export const AUDIT_ACTION_IDS = ["create", "update", "delete", "restore", "approve", "rollback"];

export const emptyForm = {
  id: null,
  companyName: "",
  contactName: "",
  sector: "",
  role: "purchasing",
  stage: "",
  tagsInput: "",
  phone: "",
  email: "",
  visitDate: "",
  notes: "",
  callDateTime: "",
  notified: false,
  activityLog: [],
  offers: [],
  visitHistory: [],
  isPinned: false,
};

export const emptySupplierForm = {
  id: null,
  name: "",
  contactName: "",
  phone: "",
  email: "",
  category: "",
  tagsInput: "",
  notes: "",
  isPinned: false,
};
