import { useState, Fragment } from "react";
import { ChevronLeft, TrendingUp, TrendingDown } from "lucide-react";
import { stageColor, offerStatusColor, PRIMARY, PRIMARY_MID, TEXT, MUTED, LINE, SURFACE, SURFACE_SUBTLE, SUCCESS, DASH_NEGATIVE } from "../theme";
import { STAGE_IDS, OFFER_STATUS_IDS } from "../domain";
import { fmtUnifiedOrSplit } from "../helpers";
import { pctChange, computeStageConversionRates } from "../dashboardCalculations";

// Merges what used to be three separate full-width cards on the Dashboard
// (Sales Pipeline, Sales Performance, Rejection Reasons Analytics) into one
// tabbed card, plus a fourth "Top Clients" tab. They were split apart
// before, but stacked vertically that way meant: (a) a lot of scrolling to
// get past four cards' worth of content to reach the Offers/Customers
// lists below, and (b) the Rejection-Reasons card is really just a
// drill-down of the "rejected" segment inside Sales Performance, so
// keeping it a full separate card buried the connection between the two.
// Tabs (not swipe-snap like SwipeableChartCard) because these panels have
// very different, variable heights — a fixed-height swipe track doesn't
// fit a table that can be 2 rows or 20.
export default function SalesAnalysisCard({
  t, stats, prevStats, compare, rejectionReport, prevRejectionReport, topClients, prevTopClients, visits, onOpenCustomer,
  exchangeRate, unifyCurrency,
}) {
  const tabs = [
    { key: "pipeline", label: t.dashPipeline },
    { key: "performance", label: t.dashSalesPerformance },
    {
      key: "rejection",
      label: t.dashRejectionReport,
      badge: rejectionReport.total > 0 ? rejectionReport.total : null,
    },
    { key: "topClients", label: t.dashTopClients },
  ];
  const [active, setActive] = useState("pipeline");
  const stageConversion = computeStageConversionRates(stats.pipeline);

  // Lookups from the previous period's rejection report, keyed the same
  // way as the current one, so each reason/rep row can find its own prior
  // count — a reason/rep with no previous data falls back to 0 rather than
  // being dropped, which lets pctChange return its existing "no comparison
  // data" null the same way the other Dashboard cards handle a 0 baseline.
  const prevReasonCounts = new Map((prevRejectionReport?.byReason || []).map((r) => [r.id, r.count]));
  const prevRepCounts = new Map((prevRejectionReport?.byRep || []).map((r) => [r.name, r.count]));
  const rejectionTotalDelta = compare ? (prevRejectionReport ? pctChange(rejectionReport.total, prevRejectionReport.total) : null) : undefined;

  // Same idea for Top Clients — looked up by the same key computeTopClients
  // groups by, over the FULL previous-period list (not just its own top 5),
  // so a client only just cracking this period's top 5 can still be
  // compared against their own previous-period numbers.
  const prevClientCounts = new Map((prevTopClients || []).map((c) => [c.customerId || c.customerName, c.offersCount]));

  return (
    <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
      <div
        className="flex items-center gap-2 mb-3"
        style={{
          overflowX: "auto",
          WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)",
          maskImage: "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className="btn-press flex items-center gap-1.5 font-bold text-xs"
              style={{
                flexShrink: 0,
                padding: "7px 14px",
                borderRadius: 999,
                border: `1.4px solid ${isActive ? PRIMARY : LINE}`,
                background: isActive ? PRIMARY : SURFACE,
                color: isActive ? "#fff" : MUTED,
              }}
            >
              {tab.label}
              {tab.badge != null && (
                <span
                  className="text-xs font-extrabold"
                  style={{
                    background: isActive ? "rgba(255,255,255,.28)" : DASH_NEGATIVE,
                    color: "#fff",
                    borderRadius: 999,
                    padding: "1px 6px",
                    fontSize: 10,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {active === "pipeline" && (
        <div className="flex items-center" style={{ gap: 4, overflowX: "auto" }}>
          {[...STAGE_IDS, "none"].map((id, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const label = id === "none" ? t.stageNone : t.stages[id];
            const color = id === "none" ? MUTED : stageColor(id);
            const count = stats.pipeline[id] || 0;
            const isEmpty = count === 0;
            // Drop-off vs. the previous stage's count — "none" has no
            // place in that sequence, so it never gets a percentage.
            const conversion = id === "none" ? null : stageConversion.find((c) => c.id === id);
            // Pipeline is a stage snapshot (how many customers sit at each
            // stage right now), not a period-flow metric, but "compare to
            // previous month" still applies the same way the rest of the
            // Dashboard does: how many customers were at this stage when
            // the previous period's snapshot (prevStats) was computed.
            const prevCount = prevStats ? (prevStats.pipeline[id] || 0) : null;
            const stageDelta = compare ? (prevStats ? pctChange(count, prevCount) : null) : undefined;
            return (
              <Fragment key={id}>
                <div className="flex flex-col items-center" style={{ flexShrink: 0, minWidth: 66, opacity: isEmpty ? 0.45 : 1 }}>
                  <div
                    className="flex items-center justify-center font-extrabold"
                    style={{
                      width: isEmpty ? 36 : 44,
                      height: isEmpty ? 36 : 44,
                      borderRadius: "50%",
                      background: isEmpty ? SURFACE_SUBTLE : color,
                      color: isEmpty ? MUTED : "#fff",
                      border: isEmpty ? `1.4px solid ${LINE}` : "none",
                      fontSize: isEmpty ? 13 : 15,
                      transition: "width .15s, height .15s",
                    }}
                  >
                    {count}
                  </div>
                  <span className="text-xs font-bold mt-1 text-center" style={{ color: MUTED }}>{label}</span>
                  {conversion && conversion.pct !== null && (
                    <span className="text-xs font-bold" style={{ color: PRIMARY_MID }}>
                      {conversion.pct.toFixed(0)}%
                    </span>
                  )}
                  {stageDelta !== undefined && (
                    stageDelta === null ? (
                      <span className="text-xs" style={{ color: MUTED }}>—</span>
                    ) : (
                      <span
                        className="flex items-center gap-0.5 text-xs font-bold"
                        style={{ color: stageDelta >= 0 ? SUCCESS : DASH_NEGATIVE }}
                      >
                        {stageDelta >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {Math.abs(stageDelta).toFixed(0)}%
                      </span>
                    )
                  )}
                </div>
                {!isLast && (
                  <ChevronLeft
                    size={16}
                    color={LINE}
                    style={{ flexShrink: 0, transform: t.dir === "rtl" ? "none" : "rotate(180deg)" }}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      )}

      {active === "performance" && (
        <div className="flex flex-wrap" style={{ gap: 10 }}>
          {OFFER_STATUS_IDS.map((id) => {
            const info = stats.offersByStatus[id] || { count: 0, totals: {} };
            const valueText = fmtUnifiedOrSplit(info.totals, t, exchangeRate, unifyCurrency);
            const prevCount = prevStats ? (prevStats.offersByStatus[id] || { count: 0 }).count : null;
            const delta = compare ? (prevStats ? pctChange(info.count, prevCount) : null) : undefined;
            return (
              <div
                key={id}
                style={{
                  flex: "1 1 45%",
                  minWidth: 140,
                  background: SURFACE_SUBTLE,
                  borderRadius: 12,
                  padding: 10,
                  borderTop: `3px solid ${offerStatusColor(id)}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: MUTED }}>{t.offerStatuses[id]}</span>
                  <span className="font-extrabold" style={{ fontSize: 20, color: offerStatusColor(id) }}>{info.count}</span>
                </div>
                {valueText && (
                  <p className="text-xs font-bold mt-1" style={{ color: TEXT, margin: "4px 0 0" }}>{valueText}</p>
                )}
                {delta !== undefined && (
                  <div className="flex items-center gap-1 mt-1">
                    {delta === null ? (
                      <span className="text-xs" style={{ color: MUTED }}>{t.dashNoComparisonData}</span>
                    ) : (
                      <span
                        className="flex items-center gap-1 text-xs font-bold"
                        style={{ color: delta >= 0 ? SUCCESS : DASH_NEGATIVE }}
                      >
                        {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {Math.abs(delta).toFixed(0)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {active === "rejection" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs" style={{ color: MUTED }}>{t.dashRejectionReportHint}</p>
            {rejectionTotalDelta !== undefined && (
              rejectionTotalDelta === null ? (
                <span className="text-xs font-bold" style={{ color: MUTED }}>{t.dashNoComparisonData}</span>
              ) : (
                <span
                  className="flex items-center gap-1 text-xs font-bold"
                  style={{ color: rejectionTotalDelta <= 0 ? SUCCESS : DASH_NEGATIVE }}
                >
                  {rejectionTotalDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {Math.abs(rejectionTotalDelta).toFixed(0)}%
                </span>
              )
            )}
          </div>
          {rejectionReport.total === 0 ? (
            <p className="text-sm text-center py-3" style={{ color: MUTED }}>{t.dashRejectionReportEmpty}</p>
          ) : (
            <>
              <div className="flex flex-col gap-2 mb-4">
                {rejectionReport.byReason.map((r) => {
                  const reasonDelta = compare ? (prevRejectionReport ? pctChange(r.count, prevReasonCounts.get(r.id) || 0) : null) : undefined;
                  return (
                    <div key={r.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: TEXT }}>{r.label}</span>
                        <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: MUTED }}>
                          {r.count} · {t.dashRejectionReportPct(r.pct)}
                          {reasonDelta !== undefined && reasonDelta !== null && (
                            <span
                              className="flex items-center gap-0.5"
                              style={{ color: reasonDelta <= 0 ? SUCCESS : DASH_NEGATIVE }}
                            >
                              {reasonDelta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {Math.abs(reasonDelta).toFixed(0)}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: SURFACE_SUBTLE, overflow: "hidden" }}>
                        <div style={{ width: `${r.pct}%`, height: "100%", background: DASH_NEGATIVE, borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {rejectionReport.byRep.length > 1 && (
                <>
                  <p className="text-xs font-bold mb-2" style={{ color: MUTED }}>{t.dashRejectionReportByRep}</p>
                  <div className="flex flex-wrap" style={{ gap: 8 }}>
                    {rejectionReport.byRep.map((r) => {
                      const repDelta = compare ? (prevRejectionReport ? pctChange(r.count, prevRepCounts.get(r.name) || 0) : null) : undefined;
                      return (
                        <div
                          key={r.name}
                          className="flex items-center justify-between"
                          style={{ flex: "1 1 45%", minWidth: 140, background: SURFACE_SUBTLE, borderRadius: 10, padding: "8px 10px" }}
                        >
                          <span className="text-xs font-bold" style={{ color: TEXT }}>{r.name}</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold" style={{ color: DASH_NEGATIVE }}>{r.count}</span>
                            {repDelta !== undefined && repDelta !== null && (
                              <span
                                className="flex items-center gap-0.5 text-xs font-bold"
                                style={{ color: repDelta <= 0 ? SUCCESS : DASH_NEGATIVE }}
                              >
                                {repDelta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                {Math.abs(repDelta).toFixed(0)}%
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {active === "topClients" && (
        <div className="flex flex-col">
          {topClients.length === 0 ? (
            <p className="text-sm text-center py-3" style={{ color: MUTED }}>{t.dashTopClientsEmpty}</p>
          ) : (
            topClients.map((c, idx) => {
              // Offer count (not the mixed-currency value total) is what's
              // compared here — same reasoning computeTopClients itself
              // documents for why it never sorts by a combined EGP+USD
              // number: a single "value changed by X%" would be meaningless
              // across currencies. A client not present at all in the
              // previous period reads as a 0 baseline, which pctChange
              // already renders as "no comparison data" below.
              const key = c.customerId || c.customerName;
              const clientDelta = compare ? (prevTopClients ? pctChange(c.offersCount, prevClientCounts.get(key) || 0) : null) : undefined;
              return (
                <button
                  key={key}
                  onClick={() => {
                    const parent = visits.find((v) => v.id === c.customerId);
                    if (parent && onOpenCustomer) onOpenCustomer(parent);
                  }}
                  className={`btn-press w-full flex items-center gap-2 ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                  style={{ padding: "8px 2px", borderTop: idx > 0 ? `1px dashed ${LINE}` : "none" }}
                >
                  <span
                    className="flex items-center justify-center font-extrabold text-xs"
                    style={{ width: 22, height: 22, borderRadius: "50%", background: SURFACE_SUBTLE, color: MUTED, flexShrink: 0 }}
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1" style={{ minWidth: 0 }}>
                    <span className="block font-bold text-sm truncate" style={{ color: TEXT }}>{c.customerName}</span>
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                      {t.dashTopClientsOffersCount(c.offersCount)}
                      {clientDelta !== undefined && (
                        clientDelta === null ? (
                          <span>· {t.dashNoComparisonData}</span>
                        ) : (
                          <span
                            className="flex items-center gap-0.5 font-bold"
                            style={{ color: clientDelta >= 0 ? SUCCESS : DASH_NEGATIVE }}
                          >
                            {clientDelta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {Math.abs(clientDelta).toFixed(0)}%
                          </span>
                        )
                      )}
                    </span>
                  </span>
                  <span className="text-sm font-extrabold" style={{ color: PRIMARY_MID, flexShrink: 0 }}>
                    {fmtUnifiedOrSplit(c.totals, t, exchangeRate, unifyCurrency) || `0 ${t.dashCurrency}`}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
