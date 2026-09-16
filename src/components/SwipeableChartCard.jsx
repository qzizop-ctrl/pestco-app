// ============================================================================
// Extracted from Dashboard.jsx as part of splitting it into smaller files.
// Pure presentational + local-state component — no dependency on
// Dashboard's internal state, so it was safe to pull out mechanically.
// ============================================================================
import React, { useState, useRef } from "react";
import { SURFACE, LINE, PRIMARY, TEXT } from "../theme";

// Wraps a set of charts (visits performance, offers value trend in EGP,
// offers value trend in USD — whichever apply) in a single card the person
// swipes between horizontally, instead of stacking every chart vertically.
// Only the active chart's title shows up top; dots below mark which page
// you're on. `pages` is an array of { title, node }, already filtered down
// to the charts that actually have data (see hasEGPOffers/hasUSDOffers
// below) so a 1-page case just renders without any swipe chrome.
export default function SwipeableChartCard({ pages }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef(null);

  if (pages.length === 0) return null;

  // scrollLeft's sign flips between browsers under `direction: rtl`
  // (0 → -max in spec-compliant browsers, 0 → +max in older ones), so we
  // only ever look at its magnitude relative to the track's own width —
  // that ratio is direction-agnostic and lands on the right page either way.
  const handleScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    setActive(Math.max(0, Math.min(pages.length - 1, i)));
  };

  return (
    <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
      <p className="font-bold text-sm mb-2" style={{ color: TEXT }}>{pages[active].title}</p>
      <div
        ref={trackRef}
        onScroll={pages.length > 1 ? handleScroll : undefined}
        style={{
          display: "flex",
          overflowX: pages.length > 1 ? "auto" : "hidden",
          scrollSnapType: pages.length > 1 ? "x mandatory" : "none",
          scrollbarWidth: "none",
        }}
      >
        {pages.map((page, i) => (
          <div key={i} style={{ flex: "0 0 100%", scrollSnapAlign: "start", minWidth: 0 }}>
            {page.node}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-1" style={{ marginTop: 6 }}>
          {pages.map((_, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: i === active ? PRIMARY : LINE,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
