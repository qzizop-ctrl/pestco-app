import React from "react";
import { Trash2, AlertTriangle, Check, RotateCcw } from "lucide-react";
import { DANGER, SUCCESS, TEXT, MUTED, LINE, SURFACE } from "../constants";

// Shown to the workspace owner (or reviewer) only, on either a customer or
// a supplier record that has a pending last_change: either a pending delete
// (approve permanently, or restore) or a pending edit (approve/clear, or
// roll back to the previous values with a field-by-field diff).
//
// Previously this JSX — including the Arabic copy and the field-label
// dictionary — was duplicated almost verbatim between CustomerDetail.jsx
// and Suppliers.jsx, with the copy hardcoded in Arabic even though the rest
// of both files render entirely from `t`. Both now render through here,
// driven by `t` like everything else, so English mode actually covers this
// banner too.
//
// kind: "customer" | "supplier" — picks the right title/labels/field map.
// lastChange: the record's `last_change` field.
// loadingAction / onApprove / onRollback / onConfirmDelete / onRestore:
// wired straight to useLastChangeActions().
export default function PendingChangeBanner({
  t, kind, lastChange, loadingAction,
  onApprove, onRollback, onConfirmDelete, onRestore,
}) {
  if (!lastChange) return null;

  const isPendingDelete = lastChange.type === "delete";
  const fieldLabels = kind === "supplier" ? t.supplierChangeFieldLabels : t.customerChangeFieldLabels;
  const pendingEditTitle = kind === "supplier" ? t.pendingEditTitleSupplier : t.pendingEditTitleCustomer;
  const deletePendingTitle = kind === "supplier" ? t.deletePendingTitleSupplier : t.deletePendingTitle;
  const deletePendingBy = kind === "supplier" ? t.deletePendingBySupplier : t.deletePendingBy;
  const restoreLabel = kind === "supplier" ? t.restoreSupplierBtn : t.restoreCustomerBtn;

  const changedAt = lastChange.updated_at || lastChange.updatedAt;
  const changedBy = lastChange.changed_by || lastChange.updatedBy || t.unknownUser;

  if (isPendingDelete) {
    return (
      <div
        className="mb-4 shadow-sm"
        style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 16, padding: 14 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-xs flex items-center gap-1" style={{ color: "#991B1B" }}>
            <Trash2 size={15} color={DANGER} /> {deletePendingTitle}
          </span>
          <span className="text-xs" style={{ color: MUTED }}>
            {changedAt ? new Date(changedAt).toLocaleString(t.locale) : ""}
          </span>
        </div>

        <div className="text-xs mb-3" style={{ color: TEXT }}>{deletePendingBy(changedBy)}</div>

        <div className="flex gap-2">
          <button
            onClick={onConfirmDelete}
            disabled={loadingAction}
            className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
            style={{ background: DANGER, color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loadingAction ? 0.6 : 1 }}
          >
            <Trash2 size={14} /> {t.confirmDeleteFinalBtn}
          </button>
          <button
            onClick={onRestore}
            disabled={loadingAction}
            className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
            style={{ background: SUCCESS, color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loadingAction ? 0.6 : 1 }}
          >
            <RotateCcw size={14} /> {restoreLabel}
          </button>
        </div>
      </div>
    );
  }

  const ignoreKeys = ["changed_by", "updatedBy", "updatedById", "updated_at", "updatedAt", "changes", "details", "last_change"];
  const rawChanges = lastChange.changes || lastChange.details || lastChange;
  const entries =
    rawChanges && typeof rawChanges === "object"
      ? Object.entries(rawChanges).filter(([k]) => !ignoreKeys.includes(k))
      : null;

  return (
    <div className="mb-4 shadow-sm" style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 16, padding: 14 }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-xs flex items-center gap-1" style={{ color: "#92400E" }}>
          <AlertTriangle size={15} color="#D97706" /> {pendingEditTitle}
        </span>
        <span className="text-xs" style={{ color: MUTED }}>
          {changedAt ? new Date(changedAt).toLocaleString(t.locale) : ""}
        </span>
      </div>

      <div className="text-xs mb-2" style={{ color: TEXT }}>{t.pendingEditBy(changedBy)}</div>

      <div className="flex flex-col gap-1.5 text-xs mb-3" style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 10, padding: 10 }}>
        {!rawChanges || typeof rawChanges !== "object" ? (
          <div style={{ color: MUTED }}>{t.genericEditNote}</div>
        ) : entries.length === 0 ? (
          <div style={{ color: MUTED }}>{t.editNoDetailsNote}</div>
        ) : (
          entries.map(([field, val]) => {
            const label = fieldLabels[field] || field;
            const oldValue = typeof val === "object" && val !== null ? val.old_value : undefined;
            const newValue = typeof val === "object" && val !== null ? val.new_value : val;
            return (
              <div key={field} className="flex items-center gap-2 border-b border-gray-100 last:border-0 pb-1">
                <span className="font-semibold min-w-[90px]" style={{ color: MUTED }}>{label}:</span>
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
          })
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onApprove}
          disabled={loadingAction}
          className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
          style={{ background: SUCCESS, color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loadingAction ? 0.6 : 1 }}
        >
          <Check size={14} /> {t.approveEditBtn}
        </button>
        <button
          onClick={onRollback}
          disabled={loadingAction}
          className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
          style={{ background: DANGER, color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loadingAction ? 0.6 : 1 }}
        >
          <RotateCcw size={14} /> {t.rollbackEditBtn}
        </button>
      </div>
    </div>
  );
}
