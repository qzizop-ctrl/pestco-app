import { AlertTriangle } from "lucide-react";
import { STATUS_COLORS, TEXT, MUTED, LINE, SURFACE } from "../theme";

// `staleOffers` here is already the Dashboard-sector-filtered slice of the
// app-wide list computed in useFilteredData.js (see Dashboard.jsx) — same
// { ...offer, customer } shape AlertsCenter.jsx renders, same
// STALE_OFFER_DAYS threshold, so "stale" always means the same thing
// everywhere in the app. Deliberately NOT scoped by the Dashboard's period
// picker: "an offer nobody has touched in 30+ days" is a right-now
// condition, not something that should disappear just because the person
// is looking at last month's numbers.
export default function StaleOffersCard({ t, staleOffers, onOpenCustomer }) {
  if (!staleOffers || staleOffers.length === 0) return null;

  return (
    <div
      style={{
        background: SURFACE, border: `1px solid ${STATUS_COLORS.today}`, borderRadius: 16,
        padding: 14, marginBottom: 20,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={16} color={STATUS_COLORS.today} />
        <span className="font-bold text-sm" style={{ color: TEXT }}>{t.dashStaleOffersTitle}</span>
      </div>
      <p className="text-xs mb-2" style={{ color: "#8C6110" }}>{t.staleOffersBanner(staleOffers.length)}</p>
      <div className="flex flex-col">
        {staleOffers.map((o) => (
          <button
            key={o.id}
            onClick={() => onOpenCustomer(o.customer)}
            className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
            style={{ padding: "7px 2px", borderTop: `1px dashed ${LINE}` }}
          >
            <span className="text-sm font-bold" style={{ color: TEXT }}>{o.customer.companyName}</span>
            <span className="text-xs" style={{ color: MUTED }}>{o.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
