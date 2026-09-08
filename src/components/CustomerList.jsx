// ============================================================================
// Customer list screen (search, filters, reminders banners, the list
// itself), extracted from App.jsx. Presentational only.
// ============================================================================

import React from "react";
import {
  Search, WifiOff, Bell, AlertTriangle, Clock, Phone, MessageCircle,
  Tag, ListFilter, Building2, Plus,
} from "lucide-react";
import { VisitCard } from "./Shared";
import {
  PRIMARY, PRIMARY_MID, TEXT, MUTED, DANGER, GOLD, LINE, SURFACE, STATUS_COLORS,
  SECTOR_IDS, STAGE_IDS, STALE_ACTIVITY_DAYS,
  sectorColor, stageColor, fmtReminder,
} from "../constants";

export default function CustomerListScreen({
  t,
  isOnline,
  dueReminders,
  staleOffers,
  staleCustomers,
  openDetail,
  query,
  setQuery,
  todaysCustomers,
  totalCustomers,
  sectorCounts,
  sectorFilter,
  setSectorFilter,
  stageFilter,
  setStageFilter,
  allTags,
  tagFilter,
  setTagFilter,
  missingDataOnly,
  setMissingDataOnly,
  missingDataCount,
  loaded,
  filtered,
  togglePin,
  canEdit,
  openNew,
}) {
  return (
    <div className="px-4 pt-4 pb-24">
      {!isOnline && (
        <div
          className="flex items-center gap-2"
          style={{
            background: "rgba(219,154,44,.12)",
            border: "1px solid rgba(219,154,44,.4)",
            borderRadius: 12,
            padding: "8px 12px",
            marginBottom: 12,
          }}
        >
          <WifiOff size={14} color={STATUS_COLORS.today} />
          <span className="text-xs font-bold" style={{ color: "#8C6110" }}>{t.offlineBanner}</span>
        </div>
      )}

      {dueReminders.length > 0 && (
        <div
          style={{
            background: "rgba(196,68,58,.1)",
            border: "1px solid rgba(196,68,58,.35)",
            borderRadius: 14,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Bell size={16} color={STATUS_COLORS.overdue} />
            <span className="text-sm font-bold" style={{ color: STATUS_COLORS.overdue }}>
              {t.dueCalls(dueReminders.length)}
            </span>
          </div>
          {dueReminders.map((v) => (
            <button
              key={v.id}
              onClick={() => openDetail(v)}
              className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
              style={{ padding: "6px 0" }}
            >
              <span className="text-sm font-bold" style={{ color: TEXT }}>{v.companyName}</span>
              <span className="text-xs" style={{ color: MUTED }}>{fmtReminder(v.callDateTime, t.locale)}</span>
            </button>
          ))}
        </div>
      )}

      {staleOffers.length > 0 && (
        <div
          style={{
            background: "rgba(219,154,44,.1)",
            border: "1px solid rgba(219,154,44,.35)",
            borderRadius: 14,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} color={STATUS_COLORS.today} />
            <span className="text-sm font-bold" style={{ color: "#8C6110" }}>
              {t.staleOffersBanner(staleOffers.length)}
            </span>
          </div>
          {staleOffers.map((o) => (
            <button
              key={o.id}
              onClick={() => openDetail(o.customer)}
              className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
              style={{ padding: "6px 0" }}
            >
              <span className="text-sm font-bold" style={{ color: TEXT }}>{o.customer.companyName}</span>
              <span className="text-xs" style={{ color: MUTED }}>{o.name}</span>
            </button>
          ))}
        </div>
      )}

      {staleCustomers.length > 0 && (
        <div
          style={{
            background: "rgba(219,154,44,.1)",
            border: "1px solid rgba(219,154,44,.35)",
            borderRadius: 14,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} color={STATUS_COLORS.today} />
            <span className="text-sm font-bold" style={{ color: "#8C6110" }}>
              {t.staleBadge} ({staleCustomers.length})
            </span>
          </div>
          {staleCustomers.map((v) => (
            <button
              key={v.id}
              onClick={() => openDetail(v)}
              className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
              style={{ padding: "6px 0" }}
            >
              <span className="text-sm font-bold" style={{ color: TEXT }}>{v.companyName}</span>
              <span className="text-xs" style={{ color: MUTED }}>{t.staleHint(STALE_ACTIVITY_DAYS)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative mb-4">
        <Search
          size={16}
          color={MUTED}
          style={{ position: "absolute", [t.dir === "rtl" ? "right" : "left"]: 12, top: "50%", transform: "translateY(-50%)" }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 34, borderRadius: 14 }}
        />
      </div>

      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <div className="flex items-center gap-2 mb-2">
          <Clock size={15} color={PRIMARY_MID} />
          <span className="text-sm font-bold" style={{ color: TEXT }}>{t.todaysCustomersTitle}</span>
        </div>
        {todaysCustomers.length === 0 ? (
          <p className="text-xs text-center py-2" style={{ color: MUTED }}>{t.noTodaysCustomers}</p>
        ) : (
          todaysCustomers.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between"
              style={{ padding: "8px 0", borderTop: `1px dashed ${LINE}` }}
            >
              <button
                onClick={() => openDetail(v)}
                className={`btn-press flex-1 ${t.dir === "rtl" ? "text-right" : "text-left"}`}
              >
                <p className="text-sm font-bold" style={{ margin: 0, color: TEXT }}>{v.companyName}</p>
                <p className="text-xs" style={{ margin: 0, color: MUTED }}>{fmtReminder(v.callDateTime, t.locale)}</p>
              </button>
              <div className="flex items-center gap-2">
                {v.phone && (
                  <a
                    href={`tel:${v.phone}`}
                    className="btn-press flex items-center justify-center"
                    style={{ width: 30, height: 30, borderRadius: 9, background: "#E5F1EA", color: "#2F9E58" }}
                    aria-label={t.phoneRow}
                  >
                    <Phone size={13} />
                  </a>
                )}
                {v.phone && (
                  <a
                    href={`https://wa.me/${v.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-press flex items-center justify-center"
                    style={{ width: 30, height: 30, borderRadius: 9, background: "#E4F5EA", color: "#25A245" }}
                    aria-label={t.whatsapp}
                  >
                    <MessageCircle size={13} />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold" style={{ color: TEXT }}>{t.totalCustomersLabel}</span>
          <span className="text-sm font-extrabold" style={{ color: PRIMARY }}>{totalCustomers}</span>
        </div>
        <div className="flex flex-col gap-1">
          {SECTOR_IDS.map((id) => (
            <div key={id} className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: MUTED }}>{t.sectors[id]}</span>
              <span className="text-xs font-extrabold" style={{ color: sectorColor(id) }}>{sectorCounts[id]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2" style={{ overflowX: "auto" }}>
        {["all", ...SECTOR_IDS].map((id) => {
          const isActive = sectorFilter === id;
          const label = id === "all" ? t.sectorAll : t.sectors[id];
          const count = id === "all" ? totalCustomers : sectorCounts[id];
          return (
            <button
              key={id}
              onClick={() => setSectorFilter(id)}
              className="btn-press font-bold text-xs"
              style={{
                flexShrink: 0,
                padding: "8px 16px",
                borderRadius: 999,
                border: `1.4px solid ${isActive ? PRIMARY : LINE}`,
                background: isActive ? PRIMARY : SURFACE,
                color: isActive ? "#fff" : MUTED,
              }}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-2" style={{ overflowX: "auto" }}>
        {["all", ...STAGE_IDS].map((id) => {
          const isActive = stageFilter === id;
          const label = id === "all" ? t.pipelineAll : t.stages[id];
          const bg = id === "all" ? (isActive ? PRIMARY : SURFACE) : (isActive ? stageColor(id) : SURFACE);
          return (
            <button
              key={id}
              onClick={() => setStageFilter(id)}
              className="btn-press font-bold text-xs"
              style={{
                flexShrink: 0,
                padding: "8px 16px",
                borderRadius: 999,
                border: `1.4px solid ${isActive ? bg : LINE}`,
                background: bg,
                color: isActive ? "#fff" : MUTED,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {allTags.length > 0 && (
        <div className="flex items-center gap-2 mb-4" style={{ overflowX: "auto" }}>
          <button
            onClick={() => setTagFilter("all")}
            className="btn-press font-bold text-xs flex items-center gap-1"
            style={{
              flexShrink: 0,
              padding: "8px 16px",
              borderRadius: 999,
              border: `1.4px solid ${tagFilter === "all" ? PRIMARY : LINE}`,
              background: tagFilter === "all" ? PRIMARY : SURFACE,
              color: tagFilter === "all" ? "#fff" : MUTED,
            }}
          >
            <Tag size={12} /> {t.tagsAll}
          </button>
          {allTags.map((tag) => {
            const isActive = tagFilter === tag;
            return (
              <button
                key={tag}
                onClick={() => setTagFilter(tag)}
                className="btn-press font-bold text-xs"
                style={{
                  flexShrink: 0,
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: `1.4px solid ${isActive ? GOLD : LINE}`,
                  background: isActive ? GOLD : SURFACE,
                  color: isActive ? "#fff" : MUTED,
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4" style={{ overflowX: "auto" }}>
        <button
          onClick={() => setMissingDataOnly((m) => !m)}
          className="btn-press font-bold text-xs flex items-center gap-1"
          style={{
            flexShrink: 0,
            padding: "8px 16px",
            borderRadius: 999,
            border: `1.4px solid ${missingDataOnly ? DANGER : LINE}`,
            background: missingDataOnly ? DANGER : SURFACE,
            color: missingDataOnly ? "#fff" : MUTED,
          }}
        >
          <ListFilter size={12} /> {t.missingDataFilter} ({missingDataCount})
        </button>
      </div>

      {!loaded && <p className="text-sm text-center py-8" style={{ color: MUTED }}>{t.loading}</p>}

      {loaded && filtered.length === 0 && (
        <div className="text-center py-16">
          <Building2 size={40} color="#C7C4B6" className="mx-auto mb-2" />
          <p className="font-bold" style={{ color: TEXT }}>{t.noVisits}</p>
          <p className="text-sm mt-1" style={{ color: MUTED }}>{t.noVisitsHint}</p>
        </div>
      )}

      {filtered.map((v) => (
        <VisitCard key={v.id} visit={v} onOpen={openDetail} onTogglePin={togglePin} canEdit={canEdit} t={t} />
      ))}

      {canEdit && (
        <button
          onClick={openNew}
          className="btn-press flex items-center justify-center"
          style={{
            position: "fixed",
            bottom: 84,
            left: 20,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: GOLD,
            color: "#fff",
            border: "none",
            boxShadow: "0 10px 20px rgba(192,138,62,.4)",
            zIndex: 20,
          }}
          aria-label={t.newVisit}
        >
          <Plus size={26} />
        </button>
      )}
    </div>
  );
}
