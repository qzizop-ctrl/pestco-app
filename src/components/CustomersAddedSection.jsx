import { stageColor, TEXT, MUTED, LINE, GOLD, SURFACE } from "../theme";

// The list of individual customers behind the Dashboard's "Customers
// added" summary card — pulled out of Dashboard.jsx alongside
// OffersListSection, same reasoning (pure presentational, no internal
// state of its own).
export default function CustomersAddedSection({ t, customersAddedLabel, periodCustomersList, onOpenCustomer }) {
  return (
    <div>
      <p className="font-bold text-sm mb-2" style={{ color: TEXT }}>{customersAddedLabel}</p>
      {periodCustomersList.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noVisits}</p>
      ) : (
        periodCustomersList.map((v) => {
          const stageId = v.stage || "";
          return (
            <button
              key={v.id}
              onClick={() => onOpenCustomer(v)}
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
                <span className="font-bold text-sm" style={{ color: TEXT }}>{v.companyName || t.noCompanyName}</span>
                {stageId && (
                  <span
                    className="text-xs font-bold"
                    style={{ background: stageColor(stageId), color: "#fff", borderRadius: 999, padding: "3px 9px" }}
                  >
                    {t.stages[stageId]}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-bold" style={{ color: GOLD }}>
                  {t.sectors[v.sector] || t.sectors.private}
                </span>
                <span className="text-xs" style={{ color: MUTED }}>
                  {v.visitDate ? `${t.dashLastVisit} ${v.visitDate}` : t.noVisitYet}
                </span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
