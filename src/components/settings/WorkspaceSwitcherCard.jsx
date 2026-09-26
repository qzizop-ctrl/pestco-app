import { SURFACE, LINE, TEXT, MUTED, SURFACE_SUBTLE } from "../../theme";

// Only rendered when the account has access to more than one workspace —
// gated in the parent (Settings.jsx), not here.
export default function WorkspaceSwitcherCard({ availableOwners, ownerUid, user, switchOwnerWorkspace }) {
  return (
    <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
      <p className="font-bold text-base mb-1" style={{ color: TEXT }}>مساحات العمل</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>اختار الشركة/الحساب الذي تريد العمل عليه.</p>
      <select
        value={ownerUid || ""}
        onChange={(e) => switchOwnerWorkspace(e.target.value)}
        style={{ width: "100%", padding: "12px", borderRadius: 12, border: `1px solid ${LINE}`, background: SURFACE_SUBTLE, color: TEXT }}
      >
        {availableOwners.map((workspace, index) => (
          <option key={workspace.uid} value={workspace.uid}>
            {workspace.uid === user?.uid ? "حسابي (Owner)" : `مساحة عمل ${index + 1} — ${workspace.role === "editor" ? "Editor" : "Viewer"}`}
          </option>
        ))}
      </select>
    </div>
  );
}
