import { MUTED, LINE, SURFACE } from "../theme";

// The "Filters" / "Pending edits" buttons next to the search box. Both share
// the same look: outlined when idle, filled with `accent` once `count` > 0,
// and collapsed away while the search box has focus to give it the room.
export default function PillButton({ onClick, icon: Icon, label, count, accent, badgeBg, badgeColor, searchActive }) {
  const active = count > 0;
  return (
    <button
      onClick={onClick}
      className="btn-press flex items-center justify-center gap-1 font-bold text-xs flex-shrink-0"
      style={{
        position: "relative",
        border: `1.4px solid ${active ? accent : LINE}`,
        background: active ? accent : SURFACE,
        color: active ? "#fff" : MUTED,
        borderRadius: 14,
        height: 44,
        overflow: "hidden",
        transition: "max-width 0.2s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease",
        maxWidth: searchActive ? 0 : 120,
        padding: searchActive ? "0" : "0 14px",
        opacity: searchActive ? 0 : 1,
        pointerEvents: searchActive ? "none" : "auto",
      }}
    >
      <Icon size={15} />
      {label}
      {active && (
        <span
          className="text-xs font-extrabold flex items-center justify-center"
          style={{ background: badgeBg, color: badgeColor, borderRadius: 999, minWidth: 16, height: 16, padding: "0 4px" }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
