// One row in the "manage tags" card — shared by the customers and
// suppliers tabs, since both need the exact same rename/merge UI, just
// pointed at a different data source and rename function.
import { X } from "lucide-react";
import { TEXT, MUTED, GOLD, LINE, SURFACE, SURFACE_SUBTLE } from "../../theme";

export default function TagRow({ tag, count, isEditing, draft, onDraftChange, onStartEdit, onSave, onCancel, busy, t }) {
  return (
    <div style={{ background: SURFACE_SUBTLE, border: `1px solid ${LINE}`, borderRadius: 10, padding: "8px 10px" }}>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            style={{ flex: 1, minWidth: 0, padding: "6px 8px", borderRadius: 8, border: `1px solid ${LINE}`, background: SURFACE, color: TEXT }}
          />
          <button
            disabled={busy || !draft.trim()}
            onClick={onSave}
            className="text-xs font-bold px-3 py-1.5 rounded-lg btn-press"
            style={{ background: GOLD, color: "#fff", opacity: busy || !draft.trim() ? 0.6 : 1, whiteSpace: "nowrap" }}
          >
            {t.tagRenameBtn}
          </button>
          <button onClick={onCancel} aria-label={t.cancelBtn} style={{ color: MUTED, padding: 4 }}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: TEXT }}>
            {tag} <span style={{ color: MUTED, fontWeight: 400 }}>({count || 0})</span>
          </span>
          <button
            disabled={busy}
            onClick={onStartEdit}
            className="text-xs font-bold"
            style={{ color: GOLD, opacity: busy ? 0.5 : 1 }}
          >
            {t.edit}
          </button>
        </div>
      )}
    </div>
  );
}
