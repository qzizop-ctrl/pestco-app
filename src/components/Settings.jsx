// ============================================================================
// Settings screen, extracted from App.jsx.
//
// Presentational only — every handler (grantAccess, revokeAccess,
// exportAllToExcel, etc.) and every piece of state still lives in App.jsx
// and is passed down as props. Nothing about how the app talks to Firestore
// or Excel changed; only the JSX moved.
//
// This file itself is just the orchestrator: each card below used to be a
// section of one ~700-line file. They now live under ./settings/ as
// self-contained components (their own local state where they had any —
// tag editing, the export tab toggle, the new-admin input — stays inside
// each card instead of cluttering this one). This file's only job is
// deciding which cards apply to who and threading the right slice of
// props to each.
// ============================================================================

import WorkspaceSwitcherCard from "./settings/WorkspaceSwitcherCard";
import TagManagementCard from "./settings/TagManagementCard";
import DuplicatesCard from "./settings/DuplicatesCard";
import MembersCard from "./settings/MembersCard";
import AuditLogLink from "./settings/AuditLogLink";
import PendingSignupsCard from "./settings/PendingSignupsCard";
import AdminsCard from "./settings/AdminsCard";
import ImportExportCard from "./settings/ImportExportCard";
import AddMemberCard from "./settings/AddMemberCard";

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
  return (
    <div className="px-4 pt-4 pb-24">
      {availableOwners.length > 1 && (
        <WorkspaceSwitcherCard
          availableOwners={availableOwners}
          ownerUid={ownerUid}
          user={user}
          switchOwnerWorkspace={switchOwnerWorkspace}
        />
      )}

      {canEdit && (
        <TagManagementCard
          t={t}
          allTags={allTags}
          tagCounts={tagCounts}
          renameTag={renameTag}
          tagBusy={tagBusy}
          allSupplierTags={allSupplierTags}
          supplierTagCounts={supplierTagCounts}
          renameSupplierTag={renameSupplierTag}
          supplierTagBusy={supplierTagBusy}
        />
      )}

      {canEdit && (
        <DuplicatesCard
          t={t}
          showDuplicates={showDuplicates}
          setShowDuplicates={setShowDuplicates}
          duplicateGroups={duplicateGroups}
          openDetail={openDetail}
        />
      )}

      {isOwnerAccount && (
        <MembersCard
          t={t}
          members={members}
          dashboardAccess={dashboardAccess}
          setMemberDashboardAccess={setMemberDashboardAccess}
          confirmAction={confirmAction}
          revokeAccess={revokeAccess}
        />
      )}

      {(isOwnerAccount || isReviewer) && <AuditLogLink t={t} openAuditLog={openAuditLog} />}

      {isReviewer && (
        <PendingSignupsCard
          t={t}
          pendingSignups={pendingSignups}
          confirmAction={confirmAction}
          dismissSignup={dismissSignup}
          reviewSignup={reviewSignup}
        />
      )}

      {isReviewer && (
        <AdminsCard
          t={t}
          adminEmails={adminEmails}
          primaryAdminEmail={primaryAdminEmail}
          isPrimaryAdmin={isPrimaryAdmin}
          confirmAction={confirmAction}
          removeAdminEmail={removeAdminEmail}
          addAdminEmail={addAdminEmail}
        />
      )}

      {canEdit && (
        <ImportExportCard
          t={t}
          exportAllToExcel={exportAllToExcel}
          exportFilteredToExcel={exportFilteredToExcel}
          filteredCount={filteredCount}
          triggerImportPicker={triggerImportPicker}
          importing={importing}
          importProgress={importProgress}
          fileInputRef={fileInputRef}
          handleImportFile={handleImportFile}
          exportSuppliersAllToExcel={exportSuppliersAllToExcel}
          exportSuppliersFilteredToExcel={exportSuppliersFilteredToExcel}
          filteredSuppliersCount={filteredSuppliersCount}
          triggerSupplierImportPicker={triggerSupplierImportPicker}
          importingSuppliers={importingSuppliers}
          supplierImportProgress={supplierImportProgress}
          supplierFileInputRef={supplierFileInputRef}
          handleImportSupplierFile={handleImportSupplierFile}
        />
      )}

      {isOwnerAccount && (
        <AddMemberCard
          t={t}
          newMemberEmail={newMemberEmail}
          setNewMemberEmail={setNewMemberEmail}
          newMemberRole={newMemberRole}
          setNewMemberRole={setNewMemberRole}
          grantAccess={grantAccess}
        />
      )}
    </div>
  );
}
