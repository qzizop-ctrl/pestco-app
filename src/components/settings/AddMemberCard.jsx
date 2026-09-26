import { MUTED, LINE, SURFACE, PRIMARY } from "../../theme";

export default function AddMemberCard({
  t,
  newMemberEmail,
  setNewMemberEmail,
  newMemberRole,
  setNewMemberRole,
  grantAccess,
}) {
  return (
    <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16 }}>
      <label>{t.addMemberEmail}</label>
      <input
        type="email"
        value={newMemberEmail}
        onChange={(e) => setNewMemberEmail(e.target.value)}
        placeholder={t.emailPlaceholder}
      />
      <div style={{ marginTop: 10 }}>
        <label>{t.addMemberRole}</label>
        <select value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)}>
          <option value="viewer">{t.roleViewer}</option>
          <option value="editor">{t.roleEditor}</option>
        </select>
      </div>
      <button
        onClick={async () => {
          if (!newMemberEmail.trim()) return;
          await grantAccess(newMemberEmail, newMemberRole);
          setNewMemberEmail("");
        }}
        className="btn-press font-bold"
        style={{ background: PRIMARY, color: "#fff", borderRadius: 14, padding: "12px 0", marginTop: 12, width: "100%" }}
      >
        {t.addMemberBtn}
      </button>
      <p className="text-xs mt-2" style={{ color: MUTED }}>{t.memberInviteHint}</p>
    </div>
  );
}
