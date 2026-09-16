// ============================================================================
// Extracted from Dashboard.jsx as part of splitting it into smaller files.
// Pure presentational component — no dependency on Dashboard's internal
// state, so it was safe to pull out mechanically.
// ============================================================================
import React from "react";
import { MUTED, SURFACE_SUBTLE } from "../theme";

// A thin horizontal bar split into colored segments by proportion, plus a
// small legend row underneath. Used on the Offers cards to show converted
// vs. still-pending vs. rejected at a glance, without adding more cards.
export default function SplitBar({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.amount, 0);
  return (
    <div style={{ marginTop: 10 }}>
      <div
        className="flex"
        style={{ height: 6, borderRadius: 999, overflow: "hidden", background: SURFACE_SUBTLE }}
      >
        {total > 0 &&
          segments
            .filter((s) => s.amount > 0)
            .map((s) => (
              <div key={s.key} style={{ width: `${(s.amount / total) * 100}%`, background: s.color }} />
            ))}
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 10, marginTop: 6 }}>
        {segments.map((s) => (
          <div key={s.key} className="flex items-center" style={{ gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: s.color, flexShrink: 0 }} />
            <span className="text-xs font-bold" style={{ color: MUTED }}>{s.label}: {s.display}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
