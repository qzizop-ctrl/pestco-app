// ============================================================================
// Extracted from Dashboard.jsx as part of splitting it into smaller files.
// Pure presentational component — no dependency on Dashboard's internal
// state, so it was safe to pull out mechanically.
// ============================================================================
import { TrendingUp, TrendingDown } from "lucide-react";
import { SURFACE, LINE, GOLD_SOFT, MUTED, TEXT, SUCCESS, DASH_NEGATIVE } from "../theme";

// Longer combined values (e.g. two currencies: "12,000 EG + 500 $") don't fit
// this card's fixed width at the normal 22px size — whether they end up
// wrapping onto a second line or just barely fitting on one, scaling the
// font down by length keeps the card from overflowing or looking cramped
// either way.
function valueFontSizeFor(valueText) {
  if (valueText.length > 18) return 15;
  if (valueText.length > 12) return 18;
  return 22;
}

// `delta` is null (nothing to compare against), a number (percent change) or
// { points } (change in percentage points).
function DeltaBadge({ delta, t }) {
  if (delta === null) {
    return <span className="text-xs" style={{ color: MUTED }}>{t.dashNoComparisonData}</span>;
  }
  const isPoints = typeof delta === "object";
  const amount = isPoints ? delta.points : delta;
  const positive = amount >= 0;
  const TrendIcon = positive ? TrendingUp : TrendingDown;
  const sign = positive ? "+" : "";
  const text = isPoints
    ? `${sign}${amount.toFixed(0)} ${t.dashPointsSuffix}`
    : `${Math.abs(amount).toFixed(0)}%`;

  return (
    <span
      className="flex items-center gap-1 text-xs font-bold"
      style={{ color: positive ? SUCCESS : DASH_NEGATIVE }}
    >
      <TrendIcon size={12} />
      {text}
    </span>
  );
}

export default function SummaryCard({ icon: Icon, label, value, delta, subValue, extra, t }) {
  const valueText = typeof value === "string" ? value : String(value);
  const valueFontSize = valueFontSizeFor(valueText);

  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${LINE}`,
        borderRadius: 16,
        padding: 14,
        flex: "1 1 45%",
        minWidth: 140,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: 9, background: GOLD_SOFT, color: "#7A5420" }}
        >
          <Icon size={15} />
        </div>
        <span className="text-xs font-bold" style={{ color: MUTED }}>{label}</span>
      </div>
      <p className="font-extrabold" style={{ margin: 0, fontSize: valueFontSize, lineHeight: 1.25, color: TEXT }}>{value}</p>
      {subValue && (
        <p className="text-xs font-bold" style={{ margin: "2px 0 0", color: MUTED }}>{subValue}</p>
      )}
      {extra}
      {delta !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          <DeltaBadge delta={delta} t={t} />
        </div>
      )}
    </div>
  );
}
