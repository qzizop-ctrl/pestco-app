// ============================================================================
// Offer building and per-currency totals. Split out of the old helpers.js.
// ============================================================================
import { CURRENCY_IDS } from "./domain";
import { fmtMoney } from "./formatMoney";

// Builds a unique offer entry for a customer's offers list
export function buildOffer({
  name, offerNumber, amount, offerDate, status, currency, supplierIds, supplierNames,
  rejectionReason, rejectionReasonId, rejectedBy, rejectedById, rejectedAt,
}) {
  const offer = {
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
  // An offer created directly as "rejected" (the new-offer form allows it)
  // carries the reason the rep just picked in the rejection modal. These
  // fields used to be silently dropped here, so such offers were saved with
  // no reason and fell out of the Dashboard's rejection-reasons report.
  // Same field names updateOfferStatus stamps when rejecting an existing
  // offer; only ever kept for status "rejected".
  if (offer.status === "rejected") {
    offer.rejectionReason = rejectionReason || "";
    if (rejectionReasonId) offer.rejectionReasonId = rejectionReasonId;
    if (rejectedBy) offer.rejectedBy = rejectedBy;
    if (rejectedById) offer.rejectedById = rejectedById;
    if (rejectedAt) offer.rejectedAt = rejectedAt;
  }
  return offer;
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

// Folds a per-currency totals map (from sumOffersByCurrency) into a single
// EGP number using a USD->EGP exchange rate, for the Dashboard's "unify
// currency" display toggle. Returns null when the rate isn't a valid
// positive number — the caller falls back to fmtOffersTotals' normal
// per-currency display in that case, same as if the toggle were off.
export function unifyOffersTotal(totals, rate) {
  const r = Number(rate);
  if (!(r > 0)) return null;
  const egp = totals.EGP || 0;
  const usd = totals.USD || 0;
  return egp + usd * r;
}

// Every place that shows an aggregated offers total (Dashboard cards, the
// PDF export, per-sector/per-member breakdowns, a customer's offers list)
// goes through this single function so "unify currency" behaves exactly
// the same everywhere instead of each call site re-implementing the same
// on/off/fallback logic. Falls back to the normal per-currency display
// (fmtOffersTotals) whenever unifying is off or the rate isn't set.
export function fmtUnifiedOrSplit(totals, t, exchangeRate, unifyCurrency, opts) {
  if (unifyCurrency) {
    const unified = unifyOffersTotal(totals, exchangeRate);
    if (unified !== null) return `${fmtMoney(unified, t.locale)} ${t.currencies.EGP}`;
  }
  return fmtOffersTotals(totals, t, opts);
}
