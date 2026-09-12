// ============================================================================
// Bottom sheet listing every customer with a pending "last_change" (an edit
// awaiting the owner's اعتماد/تراجع decision). Reached by tapping the bell
// icon next to the filters button on the customer list — owner-only, same
// as the approve/rollback controls themselves in CustomerDetail.jsx.
// ============================================================================

import React from "react";
import { Bell, ChevronRight } from "lucide-react";
import { TEXT, MUTED, LINE, SURFACE, GOLD, fmtActivityDate } from "../constants";

export default function PendingEditsSheet({ t, open, onClose, pendingEdits, openDetail }) {
  if (!open) return null;

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
          padding: "10px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
          width: "100%",
          maxWidth: 480,
          maxHeight: "82vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-center" style={{ paddingBottom: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: LINE }} />
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} color={GOLD} />
          <span className="text-sm font-bold" style={{ color: TEXT }}>{t.pendingEditsTitle}</span>
          {pendingEdits.length > 0 && (
            <span
              className="text-xs font-extrabold"
              style={{ background: GOLD, color: "#fff", borderRadius: 999, padding: "2px 8px" }}
            >
              {pendingEdits.length}
            </span>
          )}
        </div>

        {pendingEdits.length === 0 ? (
          <div className="text-sm" style={{ color: MUTED, padding: "8px 0 16px" }}>
            {t.pendingEditsEmpty}
          </div>
        ) : (
          <div className="flex flex-col" style={{ paddingBottom: 8 }}>
            {pendingEdits.map((v) => {
              const who = v.last_change?.updatedBy || v.last_change?.changed_by || "";
              const when = v.last_change?.updatedAt || v.last_change?.updated_at || "";
              const isDelete = v.last_change?.type === "delete";
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    openDetail(v);
                    onClose();
                  }}
                  className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                  style={{ padding: "12px 4px", borderBottom: `1px solid ${LINE}` }}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold" style={{ color: TEXT }}>{v.companyName}</span>
                      {isDelete && (
                        <span
                          className="text-xs font-extrabold"
                          style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 999, padding: "1px 7px" }}
                        >
                          {t.pendingDeleteLabel}
                        </span>
                      )}
                    </div>
                    {who && (
                      <span className="text-xs" style={{ color: MUTED }}>
                        {t.pendingEditsBy(who, when ? fmtActivityDate(when, t.locale) : "")}
                      </span>
                    )}
                  </div>
                  <ChevronRight
                    size={16}
                    color={MUTED}
                    style={{ transform: t.dir === "rtl" ? "rotate(180deg)" : "none" }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
