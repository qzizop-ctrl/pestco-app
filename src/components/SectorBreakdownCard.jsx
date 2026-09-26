import { sectorColor, TEXT, MUTED, LINE, SURFACE, SURFACE_SUBTLE } from "../theme";
import { fmtUnifiedOrSplit } from "../offerHelpers";

// `breakdown` is the array computeSectorBreakdown() returns — one entry
// per SECTOR_IDS value, each already computed with the same
// computePeriodStats() the rest of the Dashboard uses (see
// dashboardCalculations.js), just called once per sector instead of once
// for the currently-selected sector. Rendered as a small table rather
// than more cards — four sectors' worth of full SummaryCards would be a
// lot of vertical space for what's fundamentally a side-by-side
// comparison.
export default function SectorBreakdownCard({ t, breakdown, exchangeRate, unifyCurrency }) {
  const anyActivity = breakdown.some((s) => s.visitsCount > 0 || s.offersCount > 0);

  return (
    <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
      <p className="font-bold text-sm" style={{ color: TEXT }}>{t.dashSectorBreakdown}</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>{t.dashSectorBreakdownHint}</p>

      {!anyActivity ? (
        <p className="text-sm text-center py-3" style={{ color: MUTED }}>{t.dashSectorBreakdownEmpty}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
            <thead>
              <tr>
                <th style={{ textAlign: t.dir === "rtl" ? "right" : "left", padding: "4px 6px", fontSize: 11, color: MUTED }}>
                  {t.dashSector}
                </th>
                <th style={{ textAlign: "center", padding: "4px 6px", fontSize: 11, color: MUTED }}>{t.dashCardVisits}</th>
                <th style={{ textAlign: "center", padding: "4px 6px", fontSize: 11, color: MUTED }}>{t.dashCardOffersCount}</th>
                <th style={{ textAlign: "center", padding: "4px 6px", fontSize: 11, color: MUTED }}>{t.dashCardOffersValue}</th>
                <th style={{ textAlign: "center", padding: "4px 6px", fontSize: 11, color: MUTED }}>{t.dashWinRate}</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((s) => (
                <tr key={s.id} style={{ background: SURFACE_SUBTLE }}>
                  <td style={{ padding: "8px 6px", borderRadius: t.dir === "rtl" ? "0 10px 10px 0" : "10px 0 0 10px" }}>
                    <span className="flex items-center gap-2 text-xs font-bold" style={{ color: TEXT }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sectorColor(s.id), flexShrink: 0 }} />
                      {t.sectors[s.id]}
                    </span>
                  </td>
                  <td className="text-xs font-bold text-center" style={{ color: TEXT, padding: "8px 6px" }}>{s.visitsCount}</td>
                  <td className="text-xs font-bold text-center" style={{ color: TEXT, padding: "8px 6px" }}>{s.offersCount}</td>
                  <td className="text-xs font-bold text-center" style={{ color: TEXT, padding: "8px 6px", whiteSpace: "nowrap" }}>
                    {fmtUnifiedOrSplit(s.offersValueTotals, t, exchangeRate, unifyCurrency) || "—"}
                  </td>
                  <td
                    className="text-xs font-extrabold text-center"
                    style={{ color: TEXT, padding: "8px 6px", borderRadius: t.dir === "rtl" ? "10px 0 0 10px" : "0 10px 10px 0" }}
                  >
                    {s.winRate === null ? "—" : `${s.winRate.toFixed(0)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
