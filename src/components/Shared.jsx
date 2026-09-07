// ============================================================================
// Shared, self-contained presentational components extracted from App.jsx.
// These take only props — no dependency on App's internal state — so they
// were safe to pull out mechanically as the first step of splitting the
// single 2800+ line App.jsx file into smaller pieces.
// ============================================================================

import React from "react";
import {
  X, Phone, Calendar, User, Star, MessageCircle,
  Settings, LayoutDashboard, Users as UsersIcon, Truck, Shield,
} from "lucide-react";
import {
  PRIMARY, TEXT, MUTED, DANGER, GOLD, GOLD_SOFT, LINE, SURFACE,
  STATUS_COLORS, STALE_ACTIVITY_DAYS,
  stageColor, visitStatus, fmtReminder, isStaleCustomer,
} from "../constants";

export function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.5].forEach((delay) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.18, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + 0.4);
    });
  } catch (e) {
    /* الجهاز لا يدعم تشغيل صوت / device doesn't support audio */
  }
}

export function Logo({ size = 36 }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size, background: "rgba(255,255,255,0.12)", borderRadius: 12 }}
    >
      <Shield size={size * 0.6} color="#F6F3EC" />
    </div>
  );
}

export function TagChip({ label, onRemove }) {
  return (
    <span
      className="flex items-center gap-1 text-xs font-bold"
      style={{ background: GOLD_SOFT, color: "#7A5420", borderRadius: 999, padding: "3px 8px" }}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="btn-press flex items-center justify-center"
          style={{ color: "#7A5420" }}
          aria-label="x"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}

export function VisitCard({ visit, onOpen, onTogglePin, canEdit, t }) {
  const status = visitStatus(visit);
  const statusColor = STATUS_COLORS[status];
  const statusLabel = {
    overdue: t.statusOverdue,
    today: t.statusToday,
    upcoming: t.statusUpcoming,
    none: t.statusNone,
  }[status];
  const sectorLabel = t.sectors[visit.sector] || t.sectors.private;
  const stageId = visit.stage || "";
  const stageLabel = stageId ? (t.stages[stageId] || "") : "";
  const tags = visit.tags || [];
  const stale = isStaleCustomer(visit, STALE_ACTIVITY_DAYS);

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className="w-full"
      style={{
        background: SURFACE,
        borderRadius: 16,
        border: `1px solid ${LINE}`,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,.04)",
        position: "relative",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          [t.dir === "rtl" ? "right" : "left"]: 0,
          width: 5,
          background: statusColor,
        }}
      />
      {canEdit && (
        <button
          onClick={stop(() => onTogglePin(visit))}
          className="btn-press flex items-center justify-center"
          style={{
            position: "absolute",
            top: 10,
            [t.dir === "rtl" ? "left" : "right"]: 10,
            width: 28,
            height: 28,
            zIndex: 2,
            color: visit.isPinned ? GOLD : "#C7C4B6",
          }}
          aria-label={visit.isPinned ? t.unpinBtn : t.pinBtn}
        >
          <Star size={17} fill={visit.isPinned ? GOLD : "none"} />
        </button>
      )}
      <button
        onClick={() => onOpen(visit)}
        className={`btn-press w-full ${t.dir === "rtl" ? "text-right" : "text-left"}`}
        style={{
          padding: t.dir === "rtl" ? "14px 14px 14px 10px" : "14px 10px 14px 14px",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div style={{ [t.dir === "rtl" ? "paddingLeft" : "paddingRight"]: 32 }}>
            <p className="font-extrabold text-base" style={{ margin: 0, color: TEXT }}>
              {visit.companyName || t.noCompanyName}
            </p>
            <p className="text-xs font-bold" style={{ margin: "2px 0 0", color: GOLD }}>
              {sectorLabel}
            </p>
          </div>
          <span
            className="text-xs font-extrabold"
            style={{
              background: statusColor,
              color: "#fff",
              borderRadius: 999,
              padding: "4px 10px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {statusLabel}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-1 mt-2">
          {stageLabel && (
            <span
              className="text-xs font-bold"
              style={{ background: stageColor(stageId), color: "#fff", borderRadius: 999, padding: "3px 9px" }}
            >
              {stageLabel}
            </span>
          )}
          {!visit.phone && (
            <span
              className="text-xs font-bold"
              style={{ background: "rgba(196,68,58,.12)", color: DANGER, borderRadius: 999, padding: "3px 9px" }}
            >
              {t.missingPhoneBadge}
            </span>
          )}
          {!visit.email && (
            <span
              className="text-xs font-bold"
              style={{ background: "rgba(196,68,58,.12)", color: DANGER, borderRadius: 999, padding: "3px 9px" }}
            >
              {t.missingEmailBadge}
            </span>
          )}
          {stale && (
            <span
              className="text-xs font-bold"
              style={{ background: "rgba(219,154,44,.15)", color: "#8C6110", borderRadius: 999, padding: "3px 9px" }}
              title={t.staleHint(STALE_ACTIVITY_DAYS)}
            >
              {t.staleBadge}
            </span>
          )}
          {tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
          {tags.length > 3 && (
            <span className="text-xs" style={{ color: MUTED }}>+{tags.length - 3}</span>
          )}
        </div>

        <div className="flex items-center gap-1 mt-2" style={{ color: MUTED }}>
          <User size={13} />
          <span className="text-sm">{visit.contactName || t.noContactName}</span>
        </div>

        <div
          className="flex items-center justify-between"
          style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${LINE}` }}
        >
          <div className="flex items-center gap-1" style={{ color: MUTED, fontSize: 12 }}>
            <Calendar size={13} />
            {status === "none" ? (
              <span>{visit.visitDate || t.noVisitYet}</span>
            ) : (
              <span>{fmtReminder(visit.callDateTime, t.locale)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {visit.phone && (
              <a
                href={`tel:${visit.phone}`}
                onClick={stop(() => {})}
                className="btn-press flex items-center justify-center"
                style={{ width: 32, height: 32, borderRadius: 10, background: "#E5F1EA", color: "#2F9E58" }}
                aria-label={t.phoneRow}
              >
                <Phone size={14} />
              </a>
            )}
            {visit.phone && (
              <a
                href={`https://wa.me/${visit.phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={stop(() => {})}
                className="btn-press flex items-center justify-center"
                style={{ width: 32, height: 32, borderRadius: 10, background: "#E4F5EA", color: "#25A245" }}
                aria-label={t.whatsapp}
              >
                <MessageCircle size={14} />
              </a>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

export function BottomNav({ screen, setScreen, t, isOwnerAccount }) {
  const items = [
    { id: "dashboard", label: t.navDashboard, icon: LayoutDashboard },
    { id: "list", label: t.navCustomers, icon: UsersIcon },
    { id: "suppliers", label: t.navSuppliers, icon: Truck },
    ...(isOwnerAccount ? [{ id: "settings", label: t.navSettings, icon: Settings }] : []),
  ];
  return (
    <div
      className="flex items-center"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: SURFACE,
        borderTop: `1px solid ${LINE}`,
        zIndex: 15,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = screen === id;
        return (
          <button
            key={id}
            onClick={() => setScreen(id)}
            className="btn-press flex-1 flex flex-col items-center gap-1"
            style={{ padding: "10px 0 8px", color: isActive ? PRIMARY : MUTED }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
            <span className="text-xs font-bold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
