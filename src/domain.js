// ============================================================================
// Domain-shape constants: the fixed id lists that drive sectors/roles/
// stages/offer statuses/currencies, numeric thresholds and limits, and the
// blank-record shape used to initialize the customer/supplier forms.
// Split out of the old constants.js.
// ============================================================================

export const STALE_OFFER_DAYS = 30;

export const STALE_ACTIVITY_DAYS = 90;

// Upper bound on rows accepted by a single Excel import (visits or
// suppliers). Two reasons: a very large file run sequentially used to be
// slow with no feedback, and it protects against pasting in the wrong file
// (e.g. thousands of rows) by mistake. Comfortably above any realistic
// manual import; someone with more data should split the file.
export const MAX_IMPORT_ROWS = 2000;

// Firestore's writeBatch() hard limit is 500 operations; kept a bit under
// that so a batch that also needed a stray extra write would still fit.
export const IMPORT_BATCH_SIZE = 400;

export const ROLE_IDS = ["purchasing", "it", "technical", "other"];

export const SECTOR_IDS = ["construction", "education", "consultants", "private"];

export const STAGE_IDS = ["survey", "quote", "install", "maintenance"];

export const OFFER_STATUS_IDS = ["pending", "purchased", "rejected", "installed"];

export const CURRENCY_IDS = ["EGP", "USD"];

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
