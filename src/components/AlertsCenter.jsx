// ============================================================================
// Collapsible "alerts center" for the customer list screen.
//
// Previously the offline banner, due-reminders banner, stale-offers banner,
// and stale-customers banner were four separate blocks stacked directly on
// the screen above the list, every time, whether or not there was anything
// urgent. This folds all four into one header the user can expand — badged
// with a total count and colored by the most urgent thing inside — so the
// list itself is reachable without scrolling past a wall of banners first.
//
// Renders nothing at all when there's genuinely nothing to show (online,
// and all three lists empty), instead of an empty collapsed header taking
// up space for no reason.
// ============================================================================

import React, { useState } from "react";
import { Bell, ChevronDown, WifiOff, AlertTriangle } from "lucide-react";
import {
  TEXT, MUTED, LINE, SURFACE, STATUS_COLORS, STALE_ACTIVITY_DAYS,
  fmtReminder,
} from "../constants";

export default function AlertsCenter({
  t, isOnline, dueReminders, staleOffers, staleCustomers, openDetail,
}) {
  const totalCount = dueReminders.length + staleOffers.length + staleCustomers.length + (isOnline ? 0 : 1);
  // Starts open automatically when there's something time-critical (an
  // overdue/due-today call) so it isn't hidden behind an extra tap; any
  // other combination (only stale items, or just an offline notice) starts
  // collapsed since it's informational rather than urgent.
  const [expanded, setExpanded] = useState(dueReminders.length > 0);

  if (totalCount === 0) return null;

  const headerColor = dueReminders.length > 0
    ? STATUS_COLORS.overdue
    : (staleOffers.length > 0 || staleCustomers.length > 0 || !isOnline)
      ? STATUS_COLORS.today
      : MUTED;

  return (
    <div
      style={{
        background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14,
        marginBottom: 14, overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="btn-press w-full flex items-center justify-between"
        style={{ padding: "12px 14px" }}
      >
        <span className="flex items-center gap-2">
          <Bell size={16} color={headerColor} />
          <span className="text-sm font-bold" style={{ color: TEXT }}>{t.alertsCenterTitle}</span>
          <span
            className="text-xs font-extrabold"
            style={{ background: headerColor, color: "#fff", borderRadius: 999, padding: "2px 8px" }}
          >
            {totalCount}
          </span>
        </span>
        <ChevronDown
          size={16}
          color={MUTED}
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        />
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          {!isOnline && (
            <div className="flex items-center gap-2" style={{ paddingTop: 4 }}>
              <WifiOff size={14} color={STATUS_COLORS.today} />
              <span className="text-xs font-bold" style={{ color: "#8C6110" }}>{t.offlineBanner}</span>
            </div>
          )}

          {dueReminders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Bell size={14} color={STATUS_COLORS.overdue} />
                <span className="text-xs font-bold" style={{ color: STATUS_COLORS.overdue }}>
                  {t.dueCalls(dueReminders.length)}
                </span>
              </div>
              {dueReminders.map((v) => (
                <button
                  key={v.id}
                  onClick={() => openDetail(v)}
                  className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                  style={{ padding: "5px 0" }}
                >
                  <span className="text-sm font-bold" style={{ color: TEXT }}>{v.companyName}</span>
                  <span className="text-xs" style={{ color: MUTED }}>{fmtReminder(v.callDateTime, t.locale)}</span>
                </button>
              ))}
            </div>
          )}

          {staleOffers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} color={STATUS_COLORS.today} />
                <span className="text-xs font-bold" style={{ color: "#8C6110" }}>
                  {t.staleOffersBanner(staleOffers.length)}
                </span>
              </div>
              {staleOffers.map((o) => (
                <button
                  key={o.id}
                  onClick={() => openDetail(o.customer)}
                  className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                  style={{ padding: "5px 0" }}
                >
                  <span className="text-sm font-bold" style={{ color: TEXT }}>{o.customer.companyName}</span>
                  <span className="text-xs" style={{ color: MUTED }}>{o.name}</span>
                </button>
              ))}
            </div>
          )}

          {staleCustomers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} color={STATUS_COLORS.today} />
                <span className="text-xs font-bold" style={{ color: "#8C6110" }}>
                  {t.staleBadge} ({staleCustomers.length})
                </span>
              </div>
              {staleCustomers.map((v) => (
                <button
                  key={v.id}
                  onClick={() => openDetail(v)}
                  className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                  style={{ padding: "5px 0" }}
                >
                  <span className="text-sm font-bold" style={{ color: TEXT }}>{v.companyName}</span>
                  <span className="text-xs" style={{ color: MUTED }}>{t.staleHint(STALE_ACTIVITY_DAYS)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
