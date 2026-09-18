// ============================================================================
// Unified Admin Audit Log — a single, filterable, cross-record history of
// every important customer/supplier operation (create, edit, delete,
// restore, edit approved, edit rolled back), owner/reviewer only.
//
// This is additive to the existing per-record "last_change" pending-review
// banner (see PendingChangeBanner.jsx / useLastChangeActions.js): that
// mechanism is a single pending-edit slot that gets cleared once approved
// or rolled back, so nothing about past (already-resolved) changes stuck
// around anywhere central. Every mutation now also writes an immutable
// entry here (see useAuditLog.js#logAudit), so this screen is what the
// owner can actually browse back through.
// ============================================================================

import { useMemo, useState } from "react";
import { History, ChevronDown, ChevronUp, ChevronRight, Building2, Truck } from "lucide-react";
import { TEXT, MUTED, LINE, SURFACE, SURFACE_SUBTLE, PRIMARY, DANGER, SUCCESS } from "../theme";
import { AUDIT_ACTION_IDS } from "../domain";
import { fmtActivityDate } from "../helpers";
import { useAuditLogFeed } from "../hooks/useAuditLog";
import { SkeletonList } from "./Shared";

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="btn-press font-bold text-xs"
      style={{
        padding: "7px 12px",
        borderRadius: 999,
        border: `1.4px solid ${active ? PRIMARY : LINE}`,
        background: active ? PRIMARY : SURFACE_SUBTLE,
        color: active ? "#fff" : MUTED,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

const ACTION_COLORS = {
  create: SUCCESS,
  update: "#DB9A2C",
  delete: DANGER,
  restore: "#2E6B8F",
  approve: SUCCESS,
  rollback: DANGER,
};

export default function AuditLogScreen({
  t, ownerUid, isOwnerAccount, isReviewer, openDetail, openEditSupplier, visits, suppliers,
}) {
  const enabled = isOwnerAccount || isReviewer;
  const { entries, loaded, error } = useAuditLogFeed({ ownerUid, enabled });

  const [entityFilter, setEntityFilter] = useState("all"); // all | customer | supplier
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const users = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => e.changedBy && set.add(e.changedBy));
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (entityFilter !== "all" && e.entityType !== entityFilter) return false;
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (userFilter !== "all" && e.changedBy !== userFilter) return false;
      if (dateFrom && e.at && e.at.slice(0, 10) < dateFrom) return false;
      if (dateTo && e.at && e.at.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [entries, entityFilter, actionFilter, userFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setEntityFilter("all");
    setActionFilter("all");
    setUserFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    entityFilter !== "all" || actionFilter !== "all" || userFilter !== "all" || dateFrom || dateTo;

  const openEntity = (entry) => {
    if (entry.entityType === "customer") {
      const v = visits.find((x) => x.id === entry.entityId);
      if (v) openDetail(v);
    } else if (entry.entityType === "supplier") {
      const s = suppliers.find((x) => x.id === entry.entityId);
      if (s) openEditSupplier(s);
    }
  };

  if (!enabled) return null;

  return (
    <div className="px-4 pt-4 pb-10">
      <div className="flex items-center gap-2 mb-1">
        <History size={17} color={PRIMARY} />
        <span className="font-bold text-base" style={{ color: TEXT }}>{t.auditLogTitle}</span>
      </div>
      <p className="text-xs mb-4" style={{ color: MUTED }}>{t.auditLogHint}</p>

      {/* Filters */}
      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 12, marginBottom: 16 }}>
        <div className="flex items-center flex-wrap gap-2 mb-2">
          <Chip active={entityFilter === "all"} onClick={() => setEntityFilter("all")}>{t.auditLogFilterAll}</Chip>
          <Chip active={entityFilter === "customer"} onClick={() => setEntityFilter("customer")}>{t.auditLogEntityCustomer}</Chip>
          <Chip active={entityFilter === "supplier"} onClick={() => setEntityFilter("supplier")}>{t.auditLogEntitySupplier}</Chip>
        </div>

        <div className="flex items-center flex-wrap gap-2 mb-3">
          <Chip active={actionFilter === "all"} onClick={() => setActionFilter("all")}>{t.auditLogFilterAll}</Chip>
          {AUDIT_ACTION_IDS.map((id) => (
            <Chip key={id} active={actionFilter === id} onClick={() => setActionFilter(id)}>
              {t.auditLogActions[id]}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: MUTED }}>{t.auditLogFilterUser}</label>
            <select className="field-bare" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} style={{ width: "100%" }}>
              <option value="all">{t.auditLogFilterAll}</option>
              {users.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div />
          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: MUTED }}>{t.auditLogFilterFrom}</label>
            <input type="date" className="field-bare" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: MUTED }}>{t.auditLogFilterTo}</label>
            <input type="date" className="field-bare" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: "100%" }} />
          </div>
        </div>

        {hasActiveFilters && (
          <button onClick={clearFilters} className="btn-press text-xs font-bold" style={{ color: DANGER }}>
            {t.auditLogClearFilters}
          </button>
        )}
      </div>

      {/* List */}
      {!loaded ? (
        <SkeletonList count={4} />
      ) : error ? (
        <p className="text-sm text-center py-6" style={{ color: DANGER }}>{t.auditLogLoadError}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: MUTED }}>{t.auditLogEmpty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const fieldLabels = entry.entityType === "supplier" ? t.supplierChangeFieldLabels : t.customerChangeFieldLabels;
            const changeEntries = entry.changes ? Object.entries(entry.changes) : [];
            const color = ACTION_COLORS[entry.action] || MUTED;
            return (
              <div key={entry.id} style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 12 }}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className={`btn-press w-full ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {entry.entityType === "supplier" ? <Truck size={13} color={MUTED} /> : <Building2 size={13} color={MUTED} />}
                      <span className="text-sm font-bold truncate" style={{ color: TEXT }}>
                        {entry.entityName || (entry.entityType === "supplier" ? t.noSupplierName : t.noCompanyName)}
                      </span>
                    </div>
                    <span
                      className="text-xs font-extrabold flex-shrink-0"
                      style={{ background: color, color: "#fff", borderRadius: 999, padding: "3px 9px" }}
                    >
                      {t.auditLogActions[entry.action] || entry.action}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs" style={{ color: MUTED }}>{entry.changedBy || t.unknownUser}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: MUTED }}>
                        {entry.at ? fmtActivityDate(entry.at, t.locale) : ""}
                      </span>
                      {changeEntries.length > 0 && (isExpanded ? <ChevronUp size={14} color={MUTED} /> : <ChevronDown size={14} color={MUTED} />)}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="flex flex-col gap-2 mt-2">
                    {changeEntries.length > 0 && (
                      <div className="flex flex-col gap-1.5 text-xs" style={{ background: SURFACE_SUBTLE, borderRadius: 10, padding: 10 }}>
                        {changeEntries.map(([field, val]) => {
                          const label = fieldLabels[field] || field;
                          const oldValue = typeof val === "object" && val !== null ? val.old_value : undefined;
                          const newValue = typeof val === "object" && val !== null ? val.new_value : val;
                          return (
                            <div key={field} className="flex items-center gap-2 border-b last:border-0 pb-1" style={{ borderColor: LINE }}>
                              <span className="font-semibold" style={{ color: MUTED, minWidth: 90 }}>{label}:</span>
                              {oldValue !== undefined && (
                                <>
                                  <span className="line-through font-bold px-1.5 py-0.5 rounded" style={{ background: "#FEE2E2", color: DANGER }}>
                                    {String(oldValue || "—")}
                                  </span>
                                  <span>←</span>
                                </>
                              )}
                              <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: "#D1FAE5", color: "#047857" }}>
                                {String(newValue !== undefined && newValue !== null ? newValue : "—")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button
                      onClick={() => openEntity(entry)}
                      className="btn-press flex items-center justify-center gap-1 text-xs font-bold"
                      style={{ color: PRIMARY, padding: "4px 0" }}
                    >
                      {entry.entityType === "supplier" ? t.titleEditSupplier : t.titleDetail}
                      <ChevronRight size={13} style={{ transform: t.dir === "rtl" ? "none" : "rotate(180deg)" }} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
