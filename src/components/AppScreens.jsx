import { Suspense, lazy } from "react";
import { SkeletonList } from "./Shared";
import { SuppliersListScreen, SupplierFormScreen } from "./Suppliers";
import SettingsScreen from "./Settings";
import CustomerListScreen from "./CustomerList";
import CustomerFormScreen from "./CustomerForm";
import CustomerDetailScreen from "./CustomerDetail";
import AuditLogScreen from "./AuditLog";

// Loaded lazily: the app's default screen is the customer list, not the
// Dashboard, so most sessions never need this chart-heavy screen (and its
// recharts dependency) in the initial bundle at all.
const Dashboard = lazy(() => import("../Dashboard"));

// Pure routing: given the current `screen` and every prop each destination
// screen needs, renders exactly one of them. No state or hooks of its own —
// everything here used to sit directly inside App.jsx (~200 lines of
// {screen === "x" && (...)} blocks); pulled out verbatim so App.jsx stays
// focused on wiring state/hooks together, and each screen's full prop list
// is visible in one place without scrolling past the others.
export default function AppScreens({
  active,
  activeOffers,
  activeOffersValueText,
  activeStageIdx,
  activeSupplierId,
  activityLog,
  addAdminEmail,
  addOffer,
  adminEmails,
  allSupplierCategories,
  allSupplierTags,
  allTags,
  availableAddedMonths,
  availableOwners,
  canEdit,
  canViewDashboard,
  changeStage,
  clearCallReminder,
  confirmAction,
  dashboardAccess,
  dateAddedFilter,
  dateAddedScopeTotal,
  deleteActivity,
  deleteOffer,
  deleteSupplier,
  deleteVisit,
  dismissSignup,
  dueReminders,
  duplicateGroups,
  errors,
  exchangeRate,
  expandedOfferId,
  exportAllToExcel,
  exportFilteredToExcel,
  exportSuppliersAllToExcel,
  exportSuppliersFilteredToExcel,
  fileInputRef,
  filtered,
  filteredSuppliers,
  form,
  grantAccess,
  handleImportFile,
  handleImportSupplierFile,
  importProgress,
  importing,
  importingSuppliers,
  isOnline,
  isOwnerAccount,
  isPrimaryAdmin,
  isReviewer,
  isSaving,
  lang,
  loaded,
  logVisitToday,
  members,
  missingDataCount,
  missingDataOnly,
  newActivityText,
  newMemberEmail,
  newMemberRole,
  newOffer,
  noVisitsCount,
  noVisitsOnly,
  openDetail,
  openEdit,
  openEditSupplier,
  openNew,
  openNewSupplier,
  openPendingEditItem,
  openPendingSupplierEditItem,
  ownerUid,
  pendingEdits,
  pendingSignups,
  pendingSupplierEdits,
  primaryAdminEmail,
  query,
  removeAdminEmail,
  removeTagFromForm,
  removeTagFromSupplierForm,
  renameSupplierTag,
  renameTag,
  reviewSignup,
  revokeAccess,
  saveForm,
  saveSupplierForm,
  screen,
  sectorCounts,
  sectorFilter,
  setDateAddedFilter,
  setExchangeRate,
  setExpandedOfferId,
  setForm,
  setMemberDashboardAccess,
  setMissingDataOnly,
  setNewActivityText,
  setNewMemberEmail,
  setNewMemberRole,
  setNewOffer,
  setNoVisitsOnly,
  setQuery,
  setScreen,
  setSectorFilter,
  setShowDuplicates,
  setStageFilter,
  setSupplierCategoryFilter,
  setSupplierForm,
  setSupplierPickerOpen,
  setSupplierQuery,
  setSupplierTagFilter,
  setTagFilter,
  setUnifyCurrency,
  showAlert,
  showDuplicates,
  stageFilter,
  staleCustomers,
  staleOffers,
  submitActivity,
  supplierCategoryFilter,
  supplierErrors,
  supplierFileInputRef,
  supplierForm,
  supplierImportProgress,
  supplierPickerOpen,
  supplierQuery,
  supplierTagFilter,
  suppliers,
  suppliersLoaded,
  switchOwnerWorkspace,
  supplierTagCounts,
  supplierTagBusy,
  t,
  tagBusy,
  tagCounts,
  tagFilter,
  toggleOfferSupplier,
  togglePin,
  togglePinSupplier,
  totalCustomers,
  unifyCurrency,
  triggerImportPicker,
  triggerSupplierImportPicker,
  updateOfferStatus,
  user,
  visibleSuppliers,
  visibleVisits,
  visits,
}) {
  return (
    <div key={screen} className="animate-screen-in">
    {screen === "dashboard" && canViewDashboard && (
      <Suspense fallback={<div className="px-4 pt-4"><SkeletonList count={3} /></div>}>
        <Dashboard
          visits={visibleVisits}
          lang={lang}
          onOpenCustomer={openDetail}
          showAlert={showAlert}
          staleOffers={staleOffers}
          exchangeRate={exchangeRate}
          setExchangeRate={setExchangeRate}
          unifyCurrency={unifyCurrency}
          setUnifyCurrency={setUnifyCurrency}
        />
      </Suspense>
    )}

    {screen === "list" && (
      <CustomerListScreen
        t={t}
        isOnline={isOnline}
        dueReminders={dueReminders}
        staleCustomers={staleCustomers}
        openDetail={openDetail}
        query={query}
        setQuery={setQuery}
        totalCustomers={totalCustomers}
        sectorCounts={sectorCounts}
        sectorFilter={sectorFilter}
        setSectorFilter={setSectorFilter}
        stageFilter={stageFilter}
        setStageFilter={setStageFilter}
        allTags={allTags}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        missingDataOnly={missingDataOnly}
        setMissingDataOnly={setMissingDataOnly}
        missingDataCount={missingDataCount}
        noVisitsOnly={noVisitsOnly}
        setNoVisitsOnly={setNoVisitsOnly}
        noVisitsCount={noVisitsCount}
        dateAddedFilter={dateAddedFilter}
        setDateAddedFilter={setDateAddedFilter}
        availableAddedMonths={availableAddedMonths}
        dateAddedScopeTotal={dateAddedScopeTotal}
        loaded={loaded}
        filtered={filtered}
        togglePin={togglePin}
        canEdit={canEdit}
        openNew={openNew}
        isOwnerAccount={isOwnerAccount}
        pendingEdits={pendingEdits}
        openPendingEditItem={openPendingEditItem}
      />
    )}

    {screen === "form" && canEdit && (
      <CustomerFormScreen
        t={t}
        form={form}
        setForm={setForm}
        errors={errors}
        removeTagFromForm={removeTagFromForm}
        saveForm={saveForm}
        saving={isSaving}
      />
    )}

    {screen === "detail" && active && (
      <CustomerDetailScreen
        t={t}
        active={active}
        ownerUid={ownerUid}
        user={user}
        canEdit={canEdit}
        isOwnerAccount={isOwnerAccount}
        togglePin={togglePin}
        activeStageIdx={activeStageIdx}
        changeStage={changeStage}
        clearCallReminder={clearCallReminder}
        logVisitToday={logVisitToday}
        activeOffersValueText={activeOffersValueText}
        activeOffers={activeOffers}
        expandedOfferId={expandedOfferId}
        setExpandedOfferId={setExpandedOfferId}
        updateOfferStatus={updateOfferStatus}
        deleteOffer={deleteOffer}
        newOffer={newOffer}
        setNewOffer={setNewOffer}
        addOffer={addOffer}
        suppliers={suppliers}
        supplierPickerOpen={supplierPickerOpen}
        setSupplierPickerOpen={setSupplierPickerOpen}
        toggleOfferSupplier={toggleOfferSupplier}
        activityLog={activityLog}
        newActivityText={newActivityText}
        setNewActivityText={setNewActivityText}
        submitActivity={submitActivity}
        deleteActivity={deleteActivity}
        openEdit={openEdit}
        deleteVisit={deleteVisit}
        setScreen={setScreen}
        showAlert={showAlert}
      />
    )}

    {screen === "suppliers" && (
      <SuppliersListScreen
        t={t}
        canEdit={canEdit}
        supplierQuery={supplierQuery}
        setSupplierQuery={setSupplierQuery}
        totalSuppliers={visibleSuppliers.length}
        allSupplierTags={allSupplierTags}
        supplierTagFilter={supplierTagFilter}
        setSupplierTagFilter={setSupplierTagFilter}
        allSupplierCategories={allSupplierCategories}
        supplierCategoryFilter={supplierCategoryFilter}
        setSupplierCategoryFilter={setSupplierCategoryFilter}
        suppliersLoaded={suppliersLoaded}
        filteredSuppliers={filteredSuppliers}
        togglePinSupplier={togglePinSupplier}
        openEditSupplier={openEditSupplier}
        openNewSupplier={openNewSupplier}
        isOwnerAccount={isOwnerAccount}
        pendingEdits={pendingSupplierEdits}
        openPendingEditItem={openPendingSupplierEditItem}
      />
    )}

    {screen === "supplier-form" && canEdit && (
      <SupplierFormScreen
        t={t}
        supplierForm={supplierForm}
        setSupplierForm={setSupplierForm}
        supplierErrors={supplierErrors}
        removeTagFromSupplierForm={removeTagFromSupplierForm}
        saveSupplierForm={saveSupplierForm}
        activeSupplierId={activeSupplierId}
        deleteSupplier={deleteSupplier}
        saving={isSaving}
        ownerUid={ownerUid}
        user={user}
        isOwnerAccount={isOwnerAccount}
        setScreen={setScreen}
        showAlert={showAlert}
      />
    )}

    {screen === "settings" && (isOwnerAccount || isReviewer) && (
      <SettingsScreen
        t={t}
        availableOwners={availableOwners}
        ownerUid={ownerUid}
        user={user}
        switchOwnerWorkspace={switchOwnerWorkspace}
        canEdit={canEdit}
        showDuplicates={showDuplicates}
        setShowDuplicates={setShowDuplicates}
        duplicateGroups={duplicateGroups}
        openDetail={openDetail}
        isOwnerAccount={isOwnerAccount}
        members={members}
        dashboardAccess={dashboardAccess}
        setMemberDashboardAccess={setMemberDashboardAccess}
        revokeAccess={revokeAccess}
        pendingSignups={pendingSignups}
        isReviewer={isReviewer}
        isPrimaryAdmin={isPrimaryAdmin}
        primaryAdminEmail={primaryAdminEmail}
        adminEmails={adminEmails}
        addAdminEmail={addAdminEmail}
        removeAdminEmail={removeAdminEmail}
        reviewSignup={reviewSignup}
        dismissSignup={dismissSignup}
        confirmAction={confirmAction}
        exportAllToExcel={exportAllToExcel}
        exportFilteredToExcel={exportFilteredToExcel}
        filteredCount={filtered.length}
        triggerImportPicker={triggerImportPicker}
        importing={importing}
        importProgress={importProgress}
        fileInputRef={fileInputRef}
        handleImportFile={handleImportFile}
        exportSuppliersAllToExcel={exportSuppliersAllToExcel}
        exportSuppliersFilteredToExcel={exportSuppliersFilteredToExcel}
        filteredSuppliersCount={filteredSuppliers.length}
        triggerSupplierImportPicker={triggerSupplierImportPicker}
        importingSuppliers={importingSuppliers}
        supplierImportProgress={supplierImportProgress}
        supplierFileInputRef={supplierFileInputRef}
        handleImportSupplierFile={handleImportSupplierFile}
        newMemberEmail={newMemberEmail}
        setNewMemberEmail={setNewMemberEmail}
        newMemberRole={newMemberRole}
        setNewMemberRole={setNewMemberRole}
        grantAccess={grantAccess}
        openAuditLog={() => setScreen("audit-log")}
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

    {screen === "audit-log" && (isOwnerAccount || isReviewer) && (
      <AuditLogScreen
        t={t}
        ownerUid={ownerUid}
        isOwnerAccount={isOwnerAccount}
        isReviewer={isReviewer}
        openDetail={openDetail}
        openEditSupplier={openEditSupplier}
        visits={visits}
        suppliers={suppliers}
      />
    )}
    </div>
  );
}
