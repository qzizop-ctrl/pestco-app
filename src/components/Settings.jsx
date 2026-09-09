// ============================================================================
// Settings screen, extracted from App.jsx.
//
// Presentational only — every handler (grantAccess, revokeAccess,
// exportAllToExcel, etc.) and every piece of state still lives in App.jsx
// and is passed down as props. Nothing about how the app talks to Firestore
// or Excel changed; only the JSX moved.
// ============================================================================

import React from "react";
import { Copy, Trash2, Download, Upload } from "lucide-react";
import {
  PRIMARY, PRIMARY_MID, TEXT, MUTED, DANGER, GOLD, LINE, SURFACE, SURFACE_SUBTLE,
} from "../constants";

export default function SettingsScreen({
  t,
  availableOwners,
  ownerUid,
  user,
  switchOwnerWorkspace,
  canEdit,
  showDuplicates,
  setShowDuplicates,
  duplicateGroups,
  openDetail,
  isOwnerAccount,
  members,
  revokeAccess,
  confirmAction,
  exportAllToExcel,
  exportFilteredToExcel,
  filteredCount,
  triggerImportPicker,
  importing,
  fileInputRef,
  handleImportFile,
  newMemberEmail,
  setNewMemberEmail,
  newMemberRole,
  setNewMemberRole,
  grantAccess,
}) {
  return (
    <div className="px-4 pt-4 pb-24">
      {availableOwners.length > 1 && (
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
      )}

      {canEdit && (
        <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
          <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.duplicatesTitle}</p>
          <p className="text-xs mb-3" style={{ color: MUTED }}>{t.duplicatesHint}</p>

          <button
            onClick={() => setShowDuplicates((s) => !s)}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: showDuplicates ? SURFACE : PRIMARY_MID,
              border: showDuplicates ? `1px solid ${PRIMARY_MID}` : "none",
              color: showDuplicates ? PRIMARY_MID : "#fff",
              borderRadius: 14,
              padding: "12px 0",
              width: "100%",
            }}
          >
            <Copy size={16} /> {t.duplicatesBtn}
          </button>

          {showDuplicates && (
            <div style={{ marginTop: 12 }}>
              {duplicateGroups.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noDuplicatesFound}</p>
              ) : (
                duplicateGroups.map((group, idx) => (
                  <div
                    key={idx}
                    style={{ background: SURFACE_SUBTLE, borderRadius: 12, padding: 10, marginBottom: 8 }}
                  >
                    <span className="text-xs font-bold" style={{ color: GOLD }}>
                      {group.reason === "phone" ? t.samePhoneReason : t.similarNameReason}
                    </span>
                    {group.customers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => openDetail(c)}
                        className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                        style={{ padding: "6px 0" }}
                      >
                        <span className="text-sm font-bold" style={{ color: TEXT }}>{c.companyName || t.noCompanyName}</span>
                        <span className="text-xs" style={{ color: MUTED }}>{c.phone || "—"}</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {isOwnerAccount && (
        <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
          <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.manageAccess}</p>
          <p className="text-xs mb-3" style={{ color: MUTED }}>{t.membersTitle}</p>

          {Object.keys(members).length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noMembers}</p>
          )}

          {Object.entries(members).map(([email, role]) => (
            <div
              key={email}
              className="flex items-center justify-between"
              style={{ padding: "8px 0", borderBottom: `0.5px solid ${LINE}` }}
            >
              <div>
                <p className="text-sm font-bold" style={{ color: TEXT }}>{email}</p>
                <p className="text-xs" style={{ color: MUTED }}>{role === "editor" ? t.roleEditor : t.roleViewer}</p>
              </div>
              <button
                onClick={() => confirmAction(t.removeConfirm, () => revokeAccess(email), { danger: true })}
                className="btn-press"
                style={{ color: DANGER }}
                aria-label={t.delete}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
          <p className="font-bold text-base mb-3" style={{ color: TEXT }}>{t.excelTitle}</p>

          <button
            onClick={exportAllToExcel}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: PRIMARY_MID,
              color: "#fff",
              borderRadius: 14,
              padding: "12px 0",
              width: "100%",
              marginBottom: 10,
            }}
          >
            <Download size={16} /> {t.exportAllBtn}
          </button>

          <button
            onClick={exportFilteredToExcel}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: SURFACE,
              border: `1px solid ${PRIMARY_MID}`,
              color: PRIMARY_MID,
              borderRadius: 14,
              padding: "12px 0",
              width: "100%",
              marginBottom: 10,
            }}
          >
            <Download size={16} /> {t.exportFilteredBtn(filteredCount)}
          </button>

          <button
            onClick={triggerImportPicker}
            disabled={importing}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: SURFACE,
              border: `1px solid ${PRIMARY_MID}`,
              color: PRIMARY_MID,
              borderRadius: 14,
              padding: "12px 0",
              width: "100%",
              opacity: importing ? 0.6 : 1,
            }}
          >
            <Upload size={16} /> {importing ? t.importing : t.importBtn}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFile}
            style={{ display: "none" }}
          />
          <p className="text-xs mt-2" style={{ color: MUTED }}>{t.importHint}</p>
        </div>
      )}

      {isOwnerAccount && (
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
      )}
    </div>
  );
}
