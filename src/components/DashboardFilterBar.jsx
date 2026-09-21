import { ChevronDown, TrendingUp, FileDown } from "lucide-react";
import { PRIMARY, TEXT, MUTED, LINE, GOLD, SURFACE, SURFACE_SUBTLE } from "../theme";
import { SECTOR_IDS } from "../domain";
import PeriodSheet from "./PeriodSheet";

// ---------------------------------------------------------------------------
// Extracted from Dashboard.jsx as part of splitting it into smaller files.
// The filter bar (period / sector / currency-unify toggle+rate /
// compare+export) — shared across all three Dashboard tabs since it drives
// every tab's data. Pure presentational piece: every value and setter it
// needs comes in as props, no internal derived state of its own beyond what
// the JSX needs to render.
// ---------------------------------------------------------------------------
export default function DashboardFilterBar({
  t, resolved,
  periodSheetOpen, setPeriodSheetOpen, period, availableYears, setPeriod,
  sector, setSector,
  exchangeRate, setExchangeRate, unifyCurrency, setUnifyCurrency,
  compare, setCompare,
  pdfBusy, handleExportPdf,
}) {
  return (
    <div className="flex flex-col gap-3 mb-4">
      <button
        onClick={() => setPeriodSheetOpen(true)}
        className="btn-press flex items-center justify-between"
        style={{
          background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12,
          padding: "12px 14px", width: "100%",
        }}
      >
        <span className="font-bold text-sm" style={{ color: TEXT }}>
          {t.dashPeriodLabel}: {resolved.pillLabel}
        </span>
        <ChevronDown size={18} color={MUTED} />
      </button>

      {periodSheetOpen && (
        <PeriodSheet
          t={t}
          period={period}
          availableYears={availableYears}
          onApply={setPeriod}
          onClose={() => setPeriodSheetOpen(false)}
        />
      )}

      <div>
        <label>{t.dashSector}</label>
        <select value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="all">{t.dashAllSectors}</option>
          {SECTOR_IDS.map((id) => (
            <option key={id} value={id}>{t.sectors[id]}</option>
          ))}
        </select>
      </div>

      <div
        style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12, padding: "10px 12px" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold" style={{ color: TEXT }}>{t.unifyCurrencyToggle}</p>
          <button
            onClick={() => exchangeRate && setUnifyCurrency((v) => !v)}
            aria-label={t.unifyCurrencyToggle}
            aria-pressed={unifyCurrency && !!exchangeRate}
            disabled={!exchangeRate}
            className="btn-press"
            style={{
              width: 40, height: 22, borderRadius: 11, position: "relative",
              background: unifyCurrency && exchangeRate ? GOLD : LINE,
              border: "none", opacity: exchangeRate ? 1 : 0.5,
              cursor: exchangeRate ? "pointer" : "not-allowed",
            }}
          >
            <span
              style={{
                position: "absolute", top: 2,
                left: unifyCurrency && exchangeRate ? 20 : 2,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "left .15s",
              }}
            />
          </button>
        </div>

        {/* The rate itself is entered right here, not in Settings — Settings
            is owner/admin-only, but anyone who can see the Dashboard (any
            member granted dashboard access) needs to be able to set their
            own rate to actually use the toggle above. */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs" style={{ color: MUTED }}>{t.exchangeRateLabel}:</span>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: MUTED }}>1$ =</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={exchangeRate ?? ""}
              onChange={(e) => setExchangeRate(e.target.value ? Number(e.target.value) : null)}
              style={{ width: 68, padding: "4px 6px", borderRadius: 8, border: `1px solid ${LINE}`, background: SURFACE_SUBTLE, color: TEXT, textAlign: "center", fontSize: 12 }}
            />
            <span className="text-xs" style={{ color: MUTED }}>{t.currencies.EGP}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setCompare((c) => !c)}
          className="btn-press flex items-center justify-center gap-2 font-bold text-xs"
          style={{
            flex: 1,
            border: `1.4px solid ${compare ? PRIMARY : LINE}`,
            background: compare ? PRIMARY : SURFACE,
            color: compare ? "#fff" : MUTED,
            borderRadius: 12,
            padding: "9px 0",
          }}
        >
          <TrendingUp size={14} /> {t.dashCompareToggle}
        </button>
        <button
          onClick={handleExportPdf}
          disabled={pdfBusy}
          className="btn-press flex items-center justify-center gap-2 font-bold text-xs"
          style={{
            flex: 1,
            border: `1.4px solid ${GOLD}`,
            background: pdfBusy ? SURFACE_SUBTLE : GOLD,
            color: pdfBusy ? MUTED : "#fff",
            borderRadius: 12,
            padding: "9px 0",
            opacity: pdfBusy ? 0.7 : 1,
          }}
        >
          <FileDown size={14} /> {pdfBusy ? t.dashPdfGenerating : t.dashExportPdfBtn}
        </button>
      </div>
    </div>
  );
}
