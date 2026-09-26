import { Trash2, LayoutDashboard } from "lucide-react";
import { TEXT, MUTED, DANGER, LINE, SURFACE, SURFACE_SUBTLE, PRIMARY } from "../../theme";

export default function MembersCard({ t, members, dashboardAccess, setMemberDashboardAccess, confirmAction, revokeAccess }) {
  return (
    <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
      <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.manageAccess}</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>{t.membersTitle}</p>

      {Object.keys(members).length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noMembers}</p>
      )}

      {Object.entries(members).map(([email, role]) => {
        const hasDashboardAccess = dashboardAccess?.[email] === true;
        return (
          <div
            key={email}
            className="flex items-center justify-between"
            style={{ padding: "8px 0", borderBottom: `0.5px solid ${LINE}` }}
          >
            <div>
              <p className="text-sm font-bold" style={{ color: TEXT }}>{email}</p>
              <p className="text-xs" style={{ color: MUTED }}>{role === "editor" ? t.roleEditor : t.roleViewer}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Off by default for everyone but the owner — this is the
                  only place Dashboard access for another person can be
                  turned on, independent of their editor/viewer role. */}
              <button
                onClick={() => setMemberDashboardAccess(email, !hasDashboardAccess)}
                className="btn-press flex items-center gap-1 font-bold"
                aria-label={`${t.dashboardAccessLabel}: ${hasDashboardAccess ? t.dashboardAccessOn : t.dashboardAccessOff}`}
                title={t.dashboardAccessHint}
                style={{
                  fontSize: 11,
                  padding: "5px 9px",
                  borderRadius: 999,
                  border: `1.4px solid ${hasDashboardAccess ? PRIMARY : LINE}`,
                  background: hasDashboardAccess ? PRIMARY : SURFACE_SUBTLE,
                  color: hasDashboardAccess ? "#fff" : MUTED,
                }}
              >
                <LayoutDashboard size={12} />
                {hasDashboardAccess ? t.dashboardAccessOn : t.dashboardAccessOff}
              </button>
              <button
                onClick={() => confirmAction(t.removeConfirm, () => revokeAccess(email), { danger: true })}
                className="btn-press"
                style={{ color: DANGER }}
                aria-label={t.delete}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
