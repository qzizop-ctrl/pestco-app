import { STAGE_IDS } from "../domain";
import { parseVisitDate, fmtUnifiedOrSplit, sumOffersByCurrency } from "../helpers";

// ---------------------------------------------------------------------------
// Extracted from App.jsx. Pure derived state for whichever customer's detail
// screen is currently open (`active` — may be null when no detail screen is
// open, in which case everything here safely falls back to empty values).
// Recomputed on every render like it always was; nothing here is expensive
// enough to warrant memoizing.
// ---------------------------------------------------------------------------
export function useActiveCustomerView({ active, t, exchangeRate, unifyCurrency }) {
  const activeStageIdx = active ? STAGE_IDS.indexOf(active.stage || "") : -1;

  const activityLog = active
    ? [...(active.activityLog || [])].sort((a, b) => (a.at < b.at ? 1 : -1))
    : [];

  const activeOffers = active
    ? [...(active.offers || [])].sort((a, b) => {
        const da = parseVisitDate(a.offerDate);
        const db = parseVisitDate(b.offerDate);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      })
    : [];

  const activeOffersTotals = sumOffersByCurrency(activeOffers);
  const activeOffersValueText = fmtUnifiedOrSplit(activeOffersTotals, t, exchangeRate, unifyCurrency);

  return { activeStageIdx, activityLog, activeOffers, activeOffersValueText };
}
