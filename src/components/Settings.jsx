// ============================================================================
// Settings screen, extracted from App.jsx.
//
// Presentational only — every handler (grantAccess, revokeAccess,
// exportAllToExcel, etc.) and every piece of state still lives in App.jsx
// and is passed down as props. Nothing about how the app talks to Firestore
// or Excel changed; only the JSX moved.
// ============================================================================

import { useState } from "react";
import { Copy, Trash2, Download, Upload, UserCheck, Eye, X, LayoutDashboard, History, ChevronRight, Search } from "lucide-react";
import { PRIMARY, PRIMARY_MID, TEXT, MUTED, DANGER, GOLD, LINE, SURFACE, SURFACE_SUBTLE } from "../theme";

// One row in the "manage tags" card — shared by the customers and
// suppliers tabs, since both need the exact same rename/merge UI, just
// pointed at a different data source and rename function.
function TagRow({ tag, count, isEditing, draft, onDraftChange, onStartEdit, onSave, onCancel, busy, t }) {
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
  dashboardAccess,
  setMemberDashboardAccess,
  revokeAccess,
  pendingSignups,
  isReviewer,
  isPrimaryAdmin,
  primaryAdminEmail,
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
  importProgress,
  fileInputRef,
  handleImportFile,
  exportSuppliersAllToExcel,
  exportSuppliersFilteredToExcel,
  filteredSuppliersCount,
  triggerSupplierImportPicker,
  importingSuppliers,
  supplierImportProgress,
  supplierFileInputRef,
  handleImportSupplierFile,
  newMemberEmail,
  setNewMemberEmail,
  newMemberRole,
  setNewMemberRole,
  grantAccess,
  openAuditLog,
  allTags,
  tagCounts,
  renameTag,
  tagBusy,
  allSupplierTags,
  supplierTagCounts,
  renameSupplierTag,
  supplierTagBusy,
}) {
  const [editingTag, setEditingTag] = useState(null);
  const [tagDraft, setTagDraft] = useState("");
  const [tagTab, setTagTab] = useState("customers");
  const [tagSearch, setTagSearch] = useState("");
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
          <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.tagManagementTitle}</p>
          <p className="text-xs mb-3" style={{ color: MUTED }}>{t.tagManagementHint}</p>

          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => { setTagTab("customers"); setEditingTag(null); setTagDraft(""); setTagSearch(""); }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg"
              style={{
                background: tagTab === "customers" ? GOLD : SURFACE_SUBTLE,
                color: tagTab === "customers" ? "#fff" : MUTED,
                border: `1px solid ${tagTab === "customers" ? GOLD : LINE}`,
              }}
            >
              {t.tagTabCustomers}
            </button>
            <button
              onClick={() => { setTagTab("suppliers"); setEditingTag(null); setTagDraft(""); setTagSearch(""); }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg"
              style={{
                background: tagTab === "suppliers" ? GOLD : SURFACE_SUBTLE,
                color: tagTab === "suppliers" ? "#fff" : MUTED,
                border: `1px solid ${tagTab === "suppliers" ? GOLD : LINE}`,
              }}
            >
              {t.tagTabSuppliers}
            </button>
          </div>

          {(() => {
            const activeTags = tagTab === "customers" ? allTags : allSupplierTags;
            const activeCounts = tagTab === "customers" ? tagCounts : supplierTagCounts;
            const activeBusy = tagTab === "customers" ? tagBusy : supplierTagBusy;
            const activeRename = tagTab === "customers" ? renameTag : renameSupplierTag;
            const q = tagSearch.trim().toLowerCase();
            const visibleTags = q ? activeTags.filter((tag) => tag.toLowerCase().includes(q)) : activeTags;

            if (activeTags.length === 0) {
              return <p className="text-xs" style={{ color: MUTED }}>{t.tagsEmpty}</p>;
            }

            return (
              <>
                {/* Only worth the extra row once the list is long enough
                    that scrolling to find a tag is actually annoying —
                    same threshold as the supplier picker sheet. */}
                {activeTags.length > 6 && (
                  <div className="relative mb-3">
                    <Search
                      size={15}
                      color={MUTED}
                      style={{ position: "absolute", [t.dir === "rtl" ? "right" : "left"]: 12, top: "50%", transform: "translateY(-50%)" }}
                    />
                    <input
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      placeholder={t.tagSearchPlaceholder}
                      style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 32, borderRadius: 10, width: "100%" }}
                    />
                  </div>
                )}

                {visibleTags.length === 0 ? (
                  <p className="text-xs text-center py-2" style={{ color: MUTED }}>{t.noTagSearchResults}</p>
                ) : (
                  <div className="flex flex-col gap-2" style={{ maxHeight: 320, overflowY: "auto" }}>
                    {visibleTags.map((tag) => (
                      <TagRow
                        key={tag}
                        tag={tag}
                        count={activeCounts[tag]}
                        isEditing={editingTag === tag}
                        draft={tagDraft}
                        onDraftChange={setTagDraft}
                        onStartEdit={() => { setEditingTag(tag); setTagDraft(tag); }}
                        onSave={() => {
                          activeRename(tag, tagDraft);
                          setEditingTag(null);
                          setTagDraft("");
                        }}
                        onCancel={() => { setEditingTag(null); setTagDraft(""); }}
                        busy={activeBusy}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </>
            );
          })()}
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
      )}

      {(isOwnerAccount || isReviewer) && (
        <button
          onClick={openAuditLog}
          className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
          style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}
        >
          <div className="flex items-center gap-2">
            <History size={17} color={PRIMARY} />
            <div>
              <p className="font-bold text-sm" style={{ color: TEXT }}>{t.auditLogBtn}</p>
              <p className="text-xs" style={{ color: MUTED }}>{t.auditLogHint}</p>
            </div>
          </div>
          <ChevronRight size={16} color={MUTED} style={{ transform: t.dir === "rtl" ? "none" : "rotate(180deg)" }} />
        </button>
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

          {(adminEmails || []).map((email) => {
            // Match by the explicit primaryAdminEmail, not array position —
            // relying on "whoever's first in the array" was the bug that
            // let a newly added admin end up seeing the primary's email.
            const isPrimary = primaryAdminEmail && email === primaryAdminEmail;
            // The primary admin's email is only ever shown to the primary
            // admin themself — everyone else just doesn't get this row at
            // all, per the request that it stay invisible to other admins.
            if (isPrimary && !isPrimaryAdmin) return null;
            const canRemoveThis = isPrimaryAdmin && !isPrimary && (adminEmails || []).length > 1;
            return (
              <div
                key={email}
                className="flex items-center justify-between"
                style={{ padding: "8px 0", borderBottom: `0.5px solid ${LINE}` }}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm" style={{ color: TEXT }}>{email}</p>
                  {isPrimary && (
                    <span
                      className="text-xs font-bold"
                      style={{ background: "rgba(196,68,58,.08)", color: GOLD, borderRadius: 999, padding: "2px 8px" }}
                      title={t.primaryAdminHint}
                    >
                      {t.primaryAdminBadge}
                    </span>
                  )}
                </div>
                {canRemoveThis && (
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
            );
          })}

          {!isPrimaryAdmin && (adminEmails || []).length > 0 && (
            <p className="text-xs mt-2" style={{ color: MUTED }}>{t.primaryAdminHiddenNote}</p>
          )}

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
                <Upload size={16} />{" "}
                {importing
                  ? importProgress && importProgress.total > 0
                    ? t.importProgress(importProgress.done, importProgress.total)
                    : t.importing
                  : t.importBtn}
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
                <Upload size={16} />{" "}
                {importingSuppliers
                  ? supplierImportProgress && supplierImportProgress.total > 0
                    ? t.importSuppliersProgress(supplierImportProgress.done, supplierImportProgress.total)
                    : t.importingSuppliers
                  : t.importSuppliersBtn}
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
