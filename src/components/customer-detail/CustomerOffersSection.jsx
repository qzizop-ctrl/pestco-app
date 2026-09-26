import { Wallet, Trash2, Truck } from "lucide-react";
import { TagChip } from "../Shared";
import { PRIMARY_MID, TEXT, MUTED, DANGER, GOLD, LINE, SURFACE, SURFACE_SUBTLE, offerStatusColor } from "../../theme";
import { CURRENCY_IDS, OFFER_STATUS_IDS } from "../../domain";
import { fmtMoney } from "../../formatMoney";

export default function CustomerOffersSection({
  t,
  active,
  canEdit,
  activeOffersValueText,
  activeOffers,
  expandedOfferId,
  setExpandedOfferId,
  updateOfferStatus,
  deleteOffer,
  newOffer,
  setNewOffer,
  addOffer,
  setSupplierPickerOpen,
}) {
  return (
    <div style={{ borderTop: `0.5px solid ${LINE}`, marginTop: 12, paddingTop: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-sm font-bold"><Wallet size={15} /> {t.offersLabel}</span>
        {activeOffersValueText && (
          <span className="text-xs font-bold" style={{ color: PRIMARY_MID }}>
            {activeOffersValueText}
          </span>
        )}
      </div>

      {activeOffers.length === 0 ? (
        <p className="text-sm text-center py-2" style={{ color: MUTED }}>{t.noOffers}</p>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          {activeOffers.map((offer) => {
            const isExpanded = expandedOfferId === offer.id;
            return (
              <div key={offer.id} style={{ background: SURFACE_SUBTLE, borderRadius: 12, padding: 10 }}>
                <button
                  onClick={() => setExpandedOfferId(isExpanded ? null : offer.id)}
                  className={`btn-press w-full ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold" style={{ color: TEXT }}>
                      {offer.name}{offer.offerNumber ? ` — ${offer.offerNumber}` : ""}
                    </span>
                    <span
                      className="text-xs font-bold flex-shrink-0"
                      style={{
                        background: offerStatusColor(offer.status),
                        color: "#fff",
                        borderRadius: 999,
                        padding: "3px 9px",
                      }}
                    >
                      {t.offerStatuses[offer.status] || offer.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs" style={{ color: MUTED }}>{offer.offerDate}</span>
                    <span className="text-sm font-extrabold" style={{ color: PRIMARY_MID }}>
                      {fmtMoney(offer.amount, t.locale)} {t.currencies[offer.currency] || t.currencies.EGP}
                    </span>
                  </div>
                  {offer.status === "rejected" && offer.rejectionReason && (
                    <p className="text-xs mt-1" style={{ color: DANGER, margin: "4px 0 0" }}>
                      {t.rejectionReasonRow} {offer.rejectionReason}
                    </p>
                  )}
                  {offer.supplierNames && offer.supplierNames.length > 0 && (
                    <div className="flex items-center gap-1 text-xs mt-1" style={{ color: PRIMARY_MID }}>
                      <Truck size={13} />
                      {t.offerSuppliersCount(offer.supplierNames.length)}
                    </div>
                  )}
                </button>

                {isExpanded && offer.supplierNames && offer.supplierNames.length > 0 && (
                  <div className="flex items-center flex-wrap gap-1" style={{ marginTop: 8 }}>
                    {offer.supplierNames.map((name) => (
                      <TagChip key={name} label={name} />
                    ))}
                  </div>
                )}

                {isExpanded && canEdit && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${LINE}` }}>
                    <p className="text-xs font-bold mb-2" style={{ color: MUTED }}>{t.changeStatusLabel}</p>
                    <div className="flex items-center flex-wrap gap-1">
                      {OFFER_STATUS_IDS.map((sid) => {
                        const isActive = offer.status === sid;
                        return (
                          <button
                            key={sid}
                            onClick={() => updateOfferStatus(active, offer, sid)}
                            className="btn-press text-xs font-bold"
                            style={{
                              padding: "4px 10px",
                              borderRadius: 999,
                              border: `1.2px solid ${isActive ? offerStatusColor(sid) : LINE}`,
                              background: isActive ? offerStatusColor(sid) : SURFACE,
                              color: isActive ? "#fff" : MUTED,
                            }}
                          >
                            {t.offerStatuses[sid]}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => deleteOffer(active, offer)}
                      className="btn-press flex items-center gap-1 text-xs font-bold"
                      style={{ color: DANGER, marginTop: 10 }}
                    >
                      <Trash2 size={13} /> {t.delete}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-col gap-2" style={{ background: SURFACE_SUBTLE, borderRadius: 12, padding: 10 }}>
          <input
            value={newOffer.name}
            onChange={(e) => setNewOffer({ ...newOffer, name: e.target.value })}
            placeholder={t.offerNamePlaceholder}
          />
          <div className="flex items-center gap-2">
            <input
              value={newOffer.offerNumber}
              onChange={(e) => setNewOffer({ ...newOffer, offerNumber: e.target.value })}
              placeholder={t.offerNumberLabel}
            />
            <input
              type="number"
              value={newOffer.amount}
              onChange={(e) => setNewOffer({ ...newOffer, amount: e.target.value })}
              placeholder={t.offerAmountLabel}
            />
            <select
              value={newOffer.currency}
              onChange={(e) => setNewOffer({ ...newOffer, currency: e.target.value })}
            >
              {CURRENCY_IDS.map((cid) => (
                <option key={cid} value={cid}>{t.currencies[cid]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={newOffer.offerDate}
              onChange={(e) => setNewOffer({ ...newOffer, offerDate: e.target.value })}
            />
            <select
              value={newOffer.status}
              onChange={(e) => setNewOffer({ ...newOffer, status: e.target.value })}
            >
              {OFFER_STATUS_IDS.map((sid) => (
                <option key={sid} value={sid}>{t.offerStatuses[sid]}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setSupplierPickerOpen(true)}
            className="btn-press flex items-center justify-center gap-1 text-xs font-bold"
            style={{
              border: `1px dashed ${GOLD}`,
              color: "#7A5420",
              background: SURFACE_SUBTLE,
              borderRadius: 8,
              padding: "8px 0",
            }}
          >
            <Truck size={14} />
            {(newOffer.supplierNames || []).length > 0
              ? t.offerSuppliersCount(newOffer.supplierNames.length)
              : t.offerSuppliersBtn}
          </button>

          <button
            onClick={() => addOffer(active)}
            className="btn-press font-bold text-sm"
            style={{ background: PRIMARY_MID, color: "#fff", borderRadius: 10, padding: "10px 0" }}
          >
            {t.addOfferBtn}
          </button>
        </div>
      )}
    </div>
  );
}
