import { X, UserCheck, Eye } from "lucide-react";
import { TEXT, MUTED, LINE, SURFACE, PRIMARY, PRIMARY_MID } from "../../theme";

export default function PendingSignupsCard({ t, pendingSignups, confirmAction, dismissSignup, reviewSignup }) {
  return (
    <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
      <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.pendingSignupsTitle}</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>{t.pendingSignupsHint}</p>

      {pendingSignups.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noPendingSignups}</p>
      )}

      {pendingSignups.map((row) => (
        <div
          key={row.uid}
          style={{ padding: "10px 0", borderBottom: `0.5px solid ${LINE}` }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <p className="text-sm font-bold" style={{ color: TEXT }}>{row.email}</p>
            <button
              onClick={() => confirmAction(t.dismissSignupConfirm, () => dismissSignup(row.uid), { danger: true })}
              className="btn-press"
              style={{ color: MUTED }}
              aria-label={t.delete}
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => reviewSignup(row.uid, row.email, "editor")}
              className="btn-press flex items-center justify-center gap-1 font-bold"
              style={{ flex: 1, background: PRIMARY, color: "#fff", borderRadius: 12, padding: "10px 0", fontSize: 12 }}
            >
              <UserCheck size={14} /> {t.grantEditorBtn}
            </button>
            <button
              onClick={() => reviewSignup(row.uid, row.email, "viewer")}
              className="btn-press flex items-center justify-center gap-1 font-bold"
              style={{ flex: 1, background: SURFACE, border: `1px solid ${PRIMARY_MID}`, color: PRIMARY_MID, borderRadius: 12, padding: "10px 0", fontSize: 12 }}
            >
              <Eye size={14} /> {t.grantViewerBtn}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
