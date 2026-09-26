import { offerStatusColor, PRIMARY, PRIMARY_MID, TEXT, MUTED, LINE, SURFACE } from "../theme";
import { OFFER_STATUS_IDS } from "../domain";
import { fmtMoney, fmtUnifiedOrSplit } from "../helpers";

// The "Offers" section of the Dashboard: status filter tabs + the list of
// offers in the selected period/status, plus the running total footer.
// Pulled out of Dashboard.jsx (which had grown large again after the
// PeriodSheet/SplitBar/SummaryCard/SwipeableChartCard split) — pure
// presentational piece with no internal state of its own, same reasoning
// as those.
export default function OffersListSection({
  t, offersList, offerStatusFilter, setOfferStatusFilter, offersListValueTotals, visits, onOpenCustomer,
  exchangeRate, unifyCurrency,
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-bold text-sm" style={{ color: TEXT }}>{t.dashOffersSection}</p>
      </div>
      <div
        className="flex items-center gap-2 mb-3"
        style={{
          overflowX: "auto",
          // Fades the two edges so a partially-visible tab reads as
          // "more to scroll" instead of looking like a cut-off layout bug.
          WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)",
          maskImage: "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)",
        }}
      >
        {["all", ...OFFER_STATUS_IDS].map((id) => {
          const isActive = offerStatusFilter === id;
          const label = id === "all" ? t.dashOfferFilterAll : t.offerStatuses[id];
          const bg = id === "all" ? PRIMARY : offerStatusColor(id);
          return (
            <button
              key={id}
              onClick={() => setOfferStatusFilter(id)}
              className="btn-press font-bold text-xs"
              style={{
                flexShrink: 0,
                padding: "7px 14px",
                borderRadius: 999,
                border: `1.4px solid ${isActive ? bg : LINE}`,
                background: isActive ? bg : SURFACE,
                color: isActive ? "#fff" : MUTED,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {offersList.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noOffers}</p>
      ) : (
        <>
          {offersList.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                const parent = visits.find((v) => v.id === o.customerId);
                if (parent) onOpenCustomer(parent);
              }}
              className={`btn-press w-full ${t.dir === "rtl" ? "text-right" : "text-left"}`}
              style={{
                display: "block",
                background: SURFACE,
                border: `1px solid ${LINE}`,
                borderRadius: 14,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm" style={{ color: TEXT }}>{o.customerName}</span>
                <span
                  className="text-xs font-bold"
                  style={{ background: offerStatusColor(o.status), color: "#fff", borderRadius: 999, padding: "3px 9px" }}
                >
                  {t.offerStatuses[o.status] || o.status}
                </span>
              </div>
              <p className="text-sm mt-1" style={{ color: MUTED, margin: "4px 0 0" }}>
                {o.name}{o.offerNumber ? ` — ${o.offerNumber}` : ""}
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs" style={{ color: MUTED }}>{o.offerDate}</span>
                <span className="text-sm font-extrabold" style={{ color: PRIMARY_MID }}>
                  {fmtMoney(o.amount, t.locale)} {t.currencies[o.currency] || t.currencies.EGP}
                </span>
              </div>
            </button>
          ))}
          <div
            className="flex items-center justify-between"
            style={{ padding: "10px 4px", borderTop: `1px dashed ${LINE}`, marginTop: 4 }}
          >
            <span className="text-xs font-bold" style={{ color: MUTED }}>
              {t.dashOffersTotalLabel}: {offersList.length}
            </span>
            <span className="text-sm font-extrabold" style={{ color: TEXT }}>
              {t.dashOffersTotalValueLabel}: {fmtUnifiedOrSplit(offersListValueTotals, t, exchangeRate, unifyCurrency, { showAllIfEmpty: true })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
