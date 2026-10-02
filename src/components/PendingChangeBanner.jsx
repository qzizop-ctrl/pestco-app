import { Trash2, AlertTriangle, Check, RotateCcw } from "lucide-react";
import { DANGER, SUCCESS, TEXT, MUTED, LINE, SURFACE } from "../theme";
import { formatChangeValue } from "../lastChange";

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
const IGNORE_KEYS = new Set([
  "changed_by", "updatedBy", "updatedById", "updated_at", "updatedAt",
  "changes", "details", "last_change", "addedVisitEntryIds",
]);

// The copy differs slightly between customers and suppliers; pick it once
// here instead of repeating `kind === "supplier" ? ... : ...` in the render.
function bannerText(t, kind) {
  const supplier = kind === "supplier";
  return {
    fieldLabels: supplier ? t.supplierChangeFieldLabels : t.customerChangeFieldLabels,
    pendingEditTitle: supplier ? t.pendingEditTitleSupplier : t.pendingEditTitleCustomer,
    deletePendingTitle: supplier ? t.deletePendingTitleSupplier : t.deletePendingTitle,
    deletePendingBy: supplier ? t.deletePendingBySupplier : t.deletePendingBy,
    restoreLabel: supplier ? t.restoreSupplierBtn : t.restoreCustomerBtn,
  };
}

function formatWhen(value, locale) {
  return value ? new Date(value).toLocaleString(locale) : "";
}

function ActionButton({ onClick, disabled, background, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
      style={{ background, color: "#fff", borderRadius: 10, padding: "8px 0", opacity: disabled ? 0.6 : 1 }}
    >
      {children}
    </button>
  );
}

// Field-by-field diff of a pending edit (or a note when there is nothing
// readable to diff).
function ChangeDetails({ t, rawChanges, fieldLabels }) {
  if (!rawChanges || typeof rawChanges !== "object") {
    return <div style={{ color: MUTED }}>{t.genericEditNote}</div>;
  }
  const entries = Object.entries(rawChanges).filter(([k]) => !IGNORE_KEYS.has(k));
  if (entries.length === 0) {
    return <div style={{ color: MUTED }}>{t.editNoDetailsNote}</div>;
  }
  return entries.map(([field, val]) => {
    const label = fieldLabels[field] || field;
    const oldValue = typeof val === "object" && val !== null ? val.old_value : undefined;
    const newValue = typeof val === "object" && val !== null ? val.new_value : val;
    return (
      <div key={field} className="flex items-center gap-2 border-b border-gray-100 last:border-0 pb-1">
        <span className="font-semibold min-w-[90px]" style={{ color: MUTED }}>{label}:</span>
        {oldValue !== undefined && (
          <>
            <span className="line-through font-bold px-1.5 py-0.5 rounded" style={{ background: "#FEE2E2", color: DANGER }}>
              {formatChangeValue(oldValue)}
            </span>
            <span>←</span>
          </>
        )}
        <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: "#D1FAE5", color: "#047857" }}>
          {formatChangeValue(newValue)}
        </span>
      </div>
    );
  });
}

function PendingDeleteBanner({ t, text, changedAt, changedBy, loadingAction, onConfirmDelete, onRestore }) {
  return (
    <div
      className="mb-4 shadow-sm"
      style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 16, padding: 14 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-xs flex items-center gap-1" style={{ color: "#991B1B" }}>
          <Trash2 size={15} color={DANGER} /> {text.deletePendingTitle}
        </span>
        <span className="text-xs" style={{ color: MUTED }}>{formatWhen(changedAt, t.locale)}</span>
      </div>

      <div className="text-xs mb-3" style={{ color: TEXT }}>{text.deletePendingBy(changedBy)}</div>

      <div className="flex gap-2">
        <ActionButton onClick={onConfirmDelete} disabled={loadingAction} background={DANGER}>
          <Trash2 size={14} /> {t.confirmDeleteFinalBtn}
        </ActionButton>
        <ActionButton onClick={onRestore} disabled={loadingAction} background={SUCCESS}>
          <RotateCcw size={14} /> {text.restoreLabel}
        </ActionButton>
      </div>
    </div>
  );
}

function PendingEditBanner({ t, text, lastChange, changedAt, changedBy, loadingAction, onApprove, onRollback }) {
  const rawChanges = lastChange.changes || lastChange.details || lastChange;

  return (
    <div className="mb-4 shadow-sm" style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 16, padding: 14 }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-xs flex items-center gap-1" style={{ color: "#92400E" }}>
          <AlertTriangle size={15} color="#D97706" /> {text.pendingEditTitle}
        </span>
        <span className="text-xs" style={{ color: MUTED }}>{formatWhen(changedAt, t.locale)}</span>
      </div>

      <div className="text-xs mb-2" style={{ color: TEXT }}>{t.pendingEditBy(changedBy)}</div>

      <div className="flex flex-col gap-1.5 text-xs mb-3" style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 10, padding: 10 }}>
        <ChangeDetails t={t} rawChanges={rawChanges} fieldLabels={text.fieldLabels} />
      </div>

      <div className="flex gap-2">
        <ActionButton onClick={onApprove} disabled={loadingAction} background={SUCCESS}>
          <Check size={14} /> {t.approveEditBtn}
        </ActionButton>
        <ActionButton onClick={onRollback} disabled={loadingAction} background={DANGER}>
          <RotateCcw size={14} /> {t.rollbackEditBtn}
        </ActionButton>
      </div>
    </div>
  );
}

export default function PendingChangeBanner({
  t, kind, lastChange, loadingAction,
  onApprove, onRollback, onConfirmDelete, onRestore,
}) {
  if (!lastChange) return null;

  const text = bannerText(t, kind);
  const changedAt = lastChange.updated_at || lastChange.updatedAt;
  const changedBy = lastChange.changed_by || lastChange.updatedBy || t.unknownUser;

  if (lastChange.type === "delete") {
    return (
      <PendingDeleteBanner
        t={t} text={text} changedAt={changedAt} changedBy={changedBy}
        loadingAction={loadingAction} onConfirmDelete={onConfirmDelete} onRestore={onRestore}
      />
    );
  }

  return (
    <PendingEditBanner
      t={t} text={text} lastChange={lastChange} changedAt={changedAt} changedBy={changedBy}
      loadingAction={loadingAction} onApprove={onApprove} onRollback={onRollback}
    />
  );
}
