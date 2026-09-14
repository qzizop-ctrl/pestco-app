// ============================================================================
// Settings screen, extracted from App.jsx.
//
// Presentational only — every handler (grantAccess, revokeAccess,
// exportAllToExcel, etc.) and every piece of state still lives in App.jsx
// and is passed down as props. Nothing about how the app talks to Firestore
// or Excel changed; only the JSX moved.
// ============================================================================

import React, { useState } from "react";
import { Copy, Trash2, Download, Upload, UserCheck, Eye, X } from "lucide-react";
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
  pendingSignups,
  isReviewer,
  adminEmails,
  addAdminEmail,
  removeAdminEmail,
  reviewSignup,
  dismissSignup,
  confirmAction,
  exportAllToExcel,
  exportFilteredToExcel,
  filteredCount,
  triggerImportPicker,
  importing,
  fileInputRef,
  handleImportFile,
  exportSuppliersAllToExcel,
  exportSuppliersFilteredToExcel,
  filteredSuppliersCount,
  triggerSupplierImportPicker,
  importingSuppliers,
  supplierFileInputRef,
  handleImportSupplierFile,
  newMemberEmail,
  setNewMemberEmail,
  newMemberRole,
  setNewMemberRole,
  grantAccess,
}) {
  const [exportTab, setExportTab] = useState("customers");
  const [newAdminEmail, setNewAdminEmail] = useState("");
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

      {isReviewer && (
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
      )}

      {isReviewer && (
        <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
          <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.adminsTitle}</p>
          <p className="text-xs mb-3" style={{ color: MUTED }}>{t.adminsHint}</p>

          {(adminEmails || []).map((email) => (
            <div
              key={email}
              className="flex items-center justify-between"
              style={{ padding: "8px 0", borderBottom: `0.5px solid ${LINE}` }}
            >
              <p className="text-sm" style={{ color: TEXT }}>{email}</p>
              {(adminEmails || []).length > 1 && (
                <button
                  onClick={() => confirmAction(t.removeAdminConfirm, () => removeAdminEmail(email), { danger: true })}
                  className="btn-press"
                  style={{ color: MUTED }}
                  aria-label={t.delete}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}

          {(adminEmails || []).length <= 1 && (
            <p className="text-xs mt-2" style={{ color: MUTED }}>{t.lastAdminHint}</p>
          )}

          <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder={t.addAdminPlaceholder}
              className="field-bare"
              style={{ flex: 1, border: `1px solid ${LINE}`, borderRadius: 10, padding: "8px 10px", fontSize: 13 }}
            />
            <button
              onClick={() => {
                const email = newAdminEmail.trim();
                if (!email) return;
                addAdminEmail(email);
                setNewAdminEmail("");
              }}
              className="btn-press font-bold"
              style={{ background: PRIMARY, color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: 13 }}
            >
              {t.addAdminBtn}
            </button>
          </div>
        </div>
      )}

      {canEdit && (
        <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
          <p className="font-bold text-base mb-3" style={{ color: TEXT }}>{t.excelTitle}</p>

          {/* مفتاح تبديل بدل ما نضيف صف أزرار تاني ثابت — بيبان بس أزرار
              التبويب المختار، فمساحة الكارت بتفضل زي ما هي. */}
          <div className="flex items-center" style={{ background: SURFACE_SUBTLE, borderRadius: 999, padding: 3, marginBottom: 14 }}>
            <button
              onClick={() => setExportTab("customers")}
              className="btn-press font-bold"
              style={{
                flex: 1,
                fontSize: 12,
                padding: "7px 0",
                borderRadius: 999,
                background: exportTab === "customers" ? PRIMARY_MID : "transparent",
                color: exportTab === "customers" ? "#fff" : MUTED,
              }}
            >
              {t.exportTabCustomers}
            </button>
            <button
              onClick={() => setExportTab("suppliers")}
              className="btn-press font-bold"
              style={{
                flex: 1,
                fontSize: 12,
                padding: "7px 0",
                borderRadius: 999,
                background: exportTab === "suppliers" ? PRIMARY_MID : "transparent",
                color: exportTab === "suppliers" ? "#fff" : MUTED,
              }}
            >
              {t.exportTabSuppliers}
            </button>
          </div>

          {exportTab === "customers" ? (
            <>
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
            </>
          ) : (
            <>
              <button
                onClick={exportSuppliersAllToExcel}
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
                <Download size={16} /> {t.exportSuppliersAllBtn}
              </button>

              <button
                onClick={exportSuppliersFilteredToExcel}
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
                <Download size={16} /> {t.exportSuppliersFilteredBtn(filteredSuppliersCount)}
              </button>

              <button
                onClick={triggerSupplierImportPicker}
                disabled={importingSuppliers}
                className="btn-press flex items-center justify-center gap-2 font-bold"
                style={{
                  background: SURFACE,
                  border: `1px solid ${PRIMARY_MID}`,
                  color: PRIMARY_MID,
                  borderRadius: 14,
                  padding: "12px 0",
                  width: "100%",
                  opacity: importingSuppliers ? 0.6 : 1,
                }}
              >
                <Upload size={16} /> {importingSuppliers ? t.importingSuppliers : t.importSuppliersBtn}
              </button>
              <input
                ref={supplierFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportSupplierFile}
                style={{ display: "none" }}
              />
              <p className="text-xs mt-2" style={{ color: MUTED }}>{t.importSuppliersHint}</p>
            </>
          )}
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
