// ============================================================================
// Extracted from Dashboard.jsx (which had grown past 990 lines) as part of
// splitting it into smaller files. Pure presentational + local-state
// component — no dependency on Dashboard's internal state, so it was safe
// to pull out mechanically.
// ============================================================================
import React, { useState } from "react";
import { X } from "lucide-react";
import { PRIMARY, TEXT, MUTED, LINE, SURFACE } from "../theme";

// Bottom sheet for choosing the dashboard's period. Edits a local draft
// (mode / custom type / picked months) that's only written back to the
// parent's committed `period` state when "Apply" is tapped — matches the
// existing FilterSheet's overlay look so it feels consistent with the rest
// of the app, but with its own apply step since a half-picked custom range
// shouldn't affect the numbers on screen until it's confirmed.
export default function PeriodSheet({ t, period, availableYears, onApply, onClose }) {
  const [mode, setMode] = useState(period.mode);
  const [customType, setCustomType] = useState(period.customType);
  const [year, setYear] = useState(period.year);
  const [single, setSingle] = useState(period.single);
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);

  const options = [
    { id: "month", label: t.dashPeriodCurrentMonth },
    { id: "q3", label: t.dashPeriodLast3 },
    { id: "q6", label: t.dashPeriodLast6 },
    { id: "year", label: t.dashPeriodWholeYear },
    { id: "custom", label: t.dashPeriodCustom },
  ];

  function apply() {
    onApply({ mode, customType, year, single, from, to });
    onClose();
  }

  return (
    <div
      className="flex items-end justify-center"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 90 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: SURFACE,
          borderRadius: "18px 18px 0 0",
          padding: "16px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
          width: "100%",
          maxWidth: 480,
          maxHeight: "78vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-base" style={{ color: TEXT }}>{t.dashPeriodChoose}</span>
          <button onClick={onClose} className="btn-press flex items-center justify-center" style={{ color: MUTED }} aria-label={t.back}>
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col">
          {options.map((opt) => {
            const isActive = opt.id === mode;
            return (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className="btn-press flex items-center justify-between"
                style={{
                  padding: "12px 4px",
                  borderBottom: `1px solid ${LINE}`,
                  background: "transparent",
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? TEXT : MUTED,
                }}
              >
                <span>{opt.label}</span>
                {isActive && <span style={{ color: PRIMARY, fontWeight: 900 }}>✓</span>}
              </button>
            );
          })}
        </div>

        {mode === "year" && (
          <div style={{ marginTop: 12 }}>
            <label>{t.dashYear}</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {mode === "custom" && (
          <div style={{ marginTop: 12 }}>
            <div className="flex" style={{ gap: 6, marginBottom: 10 }}>
              {[{ id: "single", label: t.dashPeriodCustomSingle }, { id: "range", label: t.dashPeriodCustomRange }].map((m) => {
                const isActive = m.id === customType;
                return (
                  <button
                    key={m.id}
                    onClick={() => setCustomType(m.id)}
                    className="btn-press font-bold"
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 999,
                      fontSize: 12,
                      border: `1.4px solid ${isActive ? PRIMARY : LINE}`,
                      background: isActive ? PRIMARY : SURFACE,
                      color: isActive ? "#fff" : MUTED,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {customType === "single" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <select
                  value={single.month}
                  onChange={(e) => setSingle((s) => ({ ...s, month: Number(e.target.value) }))}
                >
                  {t.months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select
                  value={single.year}
                  onChange={(e) => setSingle((s) => ({ ...s, year: Number(e.target.value) }))}
                >
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex items-center" style={{ gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
                  <select
                    value={from.month}
                    onChange={(e) => setFrom((f) => ({ ...f, month: Number(e.target.value) }))}
                  >
                    {t.months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select
                    value={from.year}
                    onChange={(e) => setFrom((f) => ({ ...f, year: Number(e.target.value) }))}
                  >
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <span style={{ color: MUTED, fontSize: 13, fontWeight: 700 }}>{t.dashPeriodTo}</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
                  <select
                    value={to.month}
                    onChange={(e) => setTo((tt) => ({ ...tt, month: Number(e.target.value) }))}
                  >
                    {t.months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select
                    value={to.year}
                    onChange={(e) => setTo((tt) => ({ ...tt, year: Number(e.target.value) }))}
                  >
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={apply}
          className="btn-press w-full font-bold"
          style={{ marginTop: 16, background: PRIMARY, color: "#fff", borderRadius: 12, padding: "11px 0" }}
        >
          {t.dashPeriodApply}
        </button>
      </div>
    </div>
  );
}
