import { useState, Fragment } from "react";
import { ChevronLeft, TrendingUp, TrendingDown } from "lucide-react";
import { stageColor, offerStatusColor, PRIMARY, TEXT, MUTED, LINE, SURFACE, SURFACE_SUBTLE } from "../theme";
import { STAGE_IDS, OFFER_STATUS_IDS } from "../domain";
import { fmtOffersTotals } from "../helpers";
import { pctChange } from "../dashboardCalculations";

// Merges what used to be three separate full-width cards on the Dashboard
// (Sales Pipeline, Sales Performance, Rejection Reasons Analytics) into one
// tabbed card. They were split apart before, but stacked vertically that
// way meant: (a) a lot of scrolling to get past three cards' worth of
// content to reach the Offers/Customers lists below, and (b) the
// Rejection-Reasons card is really just a drill-down of the "rejected"
// segment inside Sales Performance, so keeping it a full separate card
// buried the connection between the two. Tabs (not swipe-snap like
// SwipeableChartCard) because these panels have very different, variable
// heights — a fixed-height swipe track doesn't fit a table that can be
// 2 rows or 20.
export default function SalesAnalysisCard({ t, stats, prevStats, compare, rejectionReport }) {
  const tabs = [
    { key: "pipeline", label: t.dashPipeline },
    { key: "performance", label: t.dashSalesPerformance },
    {
      key: "rejection",
      label: t.dashRejectionReport,
      badge: rejectionReport.total > 0 ? rejectionReport.total : null,
    },
  ];
  const [active, setActive] = useState("pipeline");

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
                    background: isActive ? "rgba(255,255,255,.28)" : "#C4443A",
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
            const valueText = fmtOffersTotals(info.totals, t);
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
                        style={{ color: delta >= 0 ? "#2F9E58" : "#C4443A" }}
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
          <p className="text-xs mb-3" style={{ color: MUTED }}>{t.dashRejectionReportHint}</p>
          {rejectionReport.total === 0 ? (
            <p className="text-sm text-center py-3" style={{ color: MUTED }}>{t.dashRejectionReportEmpty}</p>
          ) : (
            <>
              <div className="flex flex-col gap-2 mb-4">
                {rejectionReport.byReason.map((r) => (
                  <div key={r.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold" style={{ color: TEXT }}>{r.label}</span>
                      <span className="text-xs font-bold" style={{ color: MUTED }}>
                        {r.count} · {t.dashRejectionReportPct(r.pct)}
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: SURFACE_SUBTLE, overflow: "hidden" }}>
                      <div style={{ width: `${r.pct}%`, height: "100%", background: "#C4443A", borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>

              {rejectionReport.byRep.length > 1 && (
                <>
                  <p className="text-xs font-bold mb-2" style={{ color: MUTED }}>{t.dashRejectionReportByRep}</p>
                  <div className="flex flex-wrap" style={{ gap: 8 }}>
                    {rejectionReport.byRep.map((r) => (
                      <div
                        key={r.name}
                        className="flex items-center justify-between"
                        style={{ flex: "1 1 45%", minWidth: 140, background: SURFACE_SUBTLE, borderRadius: 10, padding: "8px 10px" }}
                      >
                        <span className="text-xs font-bold" style={{ color: TEXT }}>{r.name}</span>
                        <span className="text-xs font-extrabold" style={{ color: "#C4443A" }}>{r.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
