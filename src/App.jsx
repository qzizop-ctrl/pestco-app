import { useState, useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { BottomNav } from "./components/Shared";
import AppHeader from "./components/AppHeader";
import AppScreens from "./components/AppScreens";
import AppModals from "./components/AppModals";
import AppUndoToasts from "./components/AppUndoToasts";
// xlsx is loaded lazily (dynamic import) only when Export/Import is
// actually used from Settings, instead of top-level here — it's a sizeable
// library that most sessions never touch, so this keeps it out of the
// app's initial bundle/load. See useExcelExport / useExcelImport.
import AuthScreen from "./AuthScreen";
import { DashboardProvider } from "./contexts/DashboardContext";
import { useAppPrefs } from "./hooks/useAppPrefs";
import { useWorkspace } from "./hooks/useWorkspace";
import { useAccessManagement } from "./hooks/useAccessManagement";
import { useLiveData } from "./hooks/useLiveData";
import { useExcelExport } from "./hooks/useExcelExport";
import { useExcelImport } from "./hooks/useExcelImport";
import { useAutoBackup } from "./hooks/useAutoBackup";
import { useReminders } from "./hooks/useReminders";
import { useAndroidBackButton } from "./hooks/useAndroidBackButton";
import { useAppViewLifecycle } from "./hooks/useAppViewLifecycle";
import { useActiveCustomerView } from "./hooks/useActiveCustomerView";
import { useNavRestore } from "./hooks/useNavRestore";
import { useCustomerRecords } from "./hooks/useCustomerRecords";
import { useSupplierRecords } from "./hooks/useSupplierRecords";
import { useOfferActions } from "./hooks/useOfferActions";
import { useActivityLog, makeAppendActivity } from "./hooks/useActivityLog";
import { useFilteredData } from "./hooks/useFilteredData";
import { useDialogState } from "./hooks/useDialogState";
import { useCustomerFilters } from "./hooks/useCustomerFilters";
import { useSupplierFilters } from "./hooks/useSupplierFilters";
import { useTagManagement } from "./hooks/useTagManagement";
import { useErrorReporting } from "./hooks/useErrorReporting";
import { TEXT, MUTED, THEME_VARS } from "./theme";
import { STRINGS } from "./i18n";

const ROOT_SCREENS = ["dashboard", "list", "suppliers", "settings"];

export default function App() {
  const {
    lang, setLang, darkMode, setDarkMode, isOnline,
    exchangeRate, setExchangeRate, unifyCurrency, setUnifyCurrency,
  } = useAppPrefs();

  const [screen, setScreen] = useState("list"); // dashboard | list | form | detail | settings

  // Remembers whichever root screen ("list" or "dashboard") was last
  // active before opening a customer's detail screen, so the back button
  // (header + Android hardware back) returns to wherever the customer was
  // actually opened from instead of always assuming "list". See
  // AppHeader.jsx / useAndroidBackButton.js for where this is consumed.
  const lastRootScreenRef = useRef("list");
  useEffect(() => {
    if (screen === "list" || screen === "dashboard") {
      lastRootScreenRef.current = screen;
    }
  }, [screen]);
  const detailBackTarget = lastRootScreenRef.current;

  const {
    query, setQuery, debouncedQuery,
    sectorFilter, setSectorFilter,
    stageFilter, setStageFilter,
    tagFilter, setTagFilter,
    missingDataOnly, setMissingDataOnly,
    noVisitsOnly, setNoVisitsOnly,
    dateAddedFilter, setDateAddedFilter,
  } = useCustomerFilters();
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("viewer");
  // True only while an actual Firestore write from the customer/supplier
  // save button is in flight — lets the save button show a "saving..."
  // state instead of looking unresponsive on a slow connection. Shared
  // between the customer and supplier forms, same as before the split.
  const [isSaving, setIsSaving] = useState(false);
  // Part of the "reset when a different customer's detail screen is
  // opened" group, alongside useOfferActions' newOffer — kept here (not
  // inside useActivityLog) to avoid a circular hook dependency; see the
  // comment in useActivityLog.js.
  const [newActivityText, setNewActivityText] = useState("");
  // `activeId` also has to live here (not inside useCustomerRecords) because
  // useWorkspace resets it directly on sign-out/workspace-switch, and that
  // hook is called before useCustomerRecords below.
  const [activeId, setActiveId] = useState(null);
  const {
    rejectionPrompt, setRejectionPrompt,
    confirmDialog, setConfirmDialog,
    confirmAction, showAlert,
  } = useDialogState();
  const [showDuplicates, setShowDuplicates] = useState(false);

  // Dashboard's own tab state (activeTab/customersSubTab/salesTabVisited)
  // now lives in DashboardContext (see contexts/DashboardContext.jsx),
  // provided further down in this file's return, and is read directly by
  // Dashboard.jsx — no longer threaded through here or through
  // AppScreens.jsx as props.

  // ---- Suppliers (separate from customers — contacts only) ----
  const {
    supplierQuery, setSupplierQuery, debouncedSupplierQuery,
    supplierTagFilter, setSupplierTagFilter,
    supplierCategoryFilter, setSupplierCategoryFilter,
  } = useSupplierFilters();

  const t = STRINGS[lang];
  const isRootScreen = ROOT_SCREENS.includes(screen);

  // Blocks any write attempt while offline instead of queueing it for later sync.
  const requireOnline = useCallback(() => {
    if (!isOnline) {
      showAlert(t.requireOnlineMsg);
      return false;
    }
    return true;
  }, [isOnline, t, showAlert]);

  // All three user-facing error messages (workspace writes, record saves,
  // customer-list reads) now live in useErrorReporting — see that hook for
  // the reasoning behind each one.
  const { reportWorkspaceError, reportSaveError, reportVisitsError } = useErrorReporting({ lang, showAlert });

  const {
    authChecked, user, authError, clearAuthError, ownerUid, availableOwners, permissionLoading,
    canEdit, isOwnerAccount, canViewDashboard, members, dashboardAccess,
    pendingSignups, isReviewer, isPrimaryAdmin, primaryAdminEmail, adminEmails,
    switchOwnerWorkspace,
  } = useWorkspace({ requireOnline, reportError: reportWorkspaceError, screen, setScreen, setActiveId });

  const {
    grantAccess, revokeAccess, setMemberDashboardAccess,
    reviewSignup, dismissSignup, addAdminEmail, removeAdminEmail,
  } = useAccessManagement({
    user, isOwnerAccount, isReviewer, isPrimaryAdmin, primaryAdminEmail, adminEmails,
    requireOnline, reportError: reportWorkspaceError,
  });

  const { visits, loaded, visitsError, suppliers, suppliersLoaded } = useLiveData(user, ownerUid);

  useReminders({ visits, user, ownerUid, canEdit, t });

  // Written to from customer CRUD, offers, and the activity feed itself —
  // kept as a plain helper (not a hook) since it only needs ownerUid. See
  // useActivityLog.js.
  const appendActivity = makeAppendActivity(ownerUid, reportSaveError);

  // Offers don't depend on which customer's detail screen is open (they
  // always act on an explicit `visit` argument), so this can be created
  // before useCustomerRecords/`active` below.
  const {
    newOffer, setNewOffer, resetNewOffer,
    supplierPickerOpen, setSupplierPickerOpen, toggleOfferSupplier,
    expandedOfferId, setExpandedOfferId,
    addOffer, updateOfferStatus, deleteOffer,
  } = useOfferActions({ ownerUid, user, canEdit, requireOnline, confirmAction, setRejectionPrompt, appendActivity, reportSaveError, t });

  const {
    form, setForm, errors, pendingDelete,
    openNew, openEdit, openDetail, removeTagFromForm, saveForm,
    deleteVisit, undoDelete, changeStage, togglePin, logVisitToday, clearCallReminder,
  } = useCustomerRecords({
    ownerUid, user, visits, canEdit, requireOnline, confirmAction, reportSaveError,
    appendActivity, t, lang, setScreen, setIsSaving, activeId, setActiveId,
    resetDetailPanels: () => {
      setNewActivityText("");
      resetNewOffer();
    },
  });

  const active = visits.find((v) => v.id === activeId) || null;

  const { deleteActivity, submitActivity } = useActivityLog({
    ownerUid, active, canEdit, requireOnline, confirmAction, appendActivity, reportSaveError, t,
    newActivityText, setNewActivityText,
  });

  const {
    supplierForm, setSupplierForm, activeSupplierId, supplierErrors, pendingSupplierDelete,
    openNewSupplier, openEditSupplier, removeTagFromSupplierForm, saveSupplierForm,
    deleteSupplier, undoSupplierDelete, togglePinSupplier,
  } = useSupplierRecords({
    ownerUid, user, suppliers, canEdit, requireOnline, confirmAction, reportSaveError,
    t, setScreen, setIsSaving,
  });

  useAndroidBackButton({
    screen,
    setScreen,
    detailBackTarget,
    form,
    isRootScreen,
    hasOpenModal: !!rejectionPrompt || !!confirmDialog,
    closeModal: () => {
      setRejectionPrompt(null);
      setConfirmDialog(null);
    },
  });

  // App-resume / sign-out view resets, plus visits-read-error reporting —
  // see src/hooks/useAppViewLifecycle.js for the reasoning behind each.
  useAppViewLifecycle({
    user, setScreen, setQuery, setSectorFilter, setStageFilter, setTagFilter,
    setMissingDataOnly, setNoVisitsOnly, setDateAddedFilter,
    visitsError, ownerUid, reportVisitsError,
  });

  // Excel export lives in useExcelExport (src/hooks/useExcelExport.js) — see
  // that file for visitsToRows/suppliersToRows and the actual xlsx writing.
  const { exportVisits, exportSuppliers, saveBackupWorkbook } = useExcelExport({ t, canEdit });

  const {
    fileInputRef, supplierFileInputRef, importing, importingSuppliers,
    importProgress, supplierImportProgress,
    triggerImportPicker, handleImportFile, triggerSupplierImportPicker, handleImportSupplierFile,
  } = useExcelImport({ ownerUid, user, canEdit, requireOnline, t, showAlert, appendActivity });

  const {
    visibleVisits, dueReminders, staleOffers, staleCustomers,
    pendingEdits, pendingSupplierEdits, duplicateGroups,
    allTags, tagCounts, sectorCounts, totalCustomers, missingDataCount, noVisitsCount,
    dateAddedScopeTotal, availableAddedMonths, filtered,
    visibleSuppliers, allSupplierTags, supplierTagCounts, allSupplierCategories, filteredSuppliers,
  } = useFilteredData({
    visits, suppliers, pendingDelete, pendingSupplierDelete,
    sectorFilter, stageFilter, tagFilter, missingDataOnly, noVisitsOnly,
    dateAddedFilter, setDateAddedFilter, debouncedQuery,
    supplierTagFilter, supplierCategoryFilter, debouncedSupplierQuery,
    t,
  });

  const { renameTag, tagBusy, renameSupplierTag, supplierTagBusy } = useTagManagement({
    ownerUid, visits: visibleVisits, suppliers: visibleSuppliers, canEdit, requireOnline, confirmAction, reportSaveError, t,
  });

  // The live listener already holds every customer (no pagination limit),
  // so exporting "all" is just exporting the current in-memory list.
  const exportAllToExcel = () => exportVisits(visibleVisits, "all");

  // Exports only what's currently loaded and passing the active filters on
  // the customers list screen.
  const exportFilteredToExcel = () => exportVisits(filtered, "filtered");

  const exportSuppliersAllToExcel = () => exportSuppliers(visibleSuppliers, "all");

  const exportSuppliersFilteredToExcel = () => exportSuppliers(filteredSuppliers, "filtered");

  // Weekly Excel backup, owner-only — see src/hooks/useAutoBackup.js.
  useAutoBackup({
    isOwnerAccount,
    ready: loaded && suppliersLoaded,
    visits: visibleVisits,
    suppliers: visibleSuppliers,
    saveBackupWorkbook,
    confirmAction,
    notify: showAlert,
    t,
  });

  // Opens a tapped row from the customer pending-edits sheet, looking the
  // record up fresh from `visits` (rather than trusting the passed-in copy).
  const openPendingEditItem = (item) => {
    const original = visits.find((v) => v.id === item.id);
    if (original) openDetail(original);
  };

  // Same, for the suppliers pending-edits sheet.
  const openPendingSupplierEditItem = (item) => {
    const original = suppliers.find((s) => s.id === item.id);
    if (original) openEditSupplier(original);
  };

  // Resume where you left off after the app is killed in the background —
  // see src/hooks/useNavRestore.js.
  useNavRestore({
    screen, setScreen, activeId, activeSupplierId,
    loaded, suppliersLoaded, permissionLoading, visits, suppliers,
    openDetail, openEditSupplier,
  });

  const { activeStageIdx, activityLog, activeOffers, activeOffersValueText } = useActiveCustomerView({
    active, t, exchangeRate, unifyCurrency,
  });

  const themeVars = darkMode ? THEME_VARS.dark : THEME_VARS.light;

  if (!authChecked) {
    return (
      <div
        style={{
          ...themeVars,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          fontFamily: "'Tajawal', sans-serif",
        }}
      >
        <p style={{ color: MUTED, fontSize: 14 }}>{t.loading}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        lang={lang}
        setLang={setLang}
        authError={authError}
        onClearAuthError={clearAuthError}
      />
    );
  }

  return (
    <DashboardProvider>
    <div
      className="w-full min-h-full"
      style={{
        ...themeVars,
        fontFamily: "'Tajawal', sans-serif",
        background: "var(--bg)",
        minHeight: "100vh",
        direction: t.dir,
        color: TEXT,
      }}
    >
      <AppHeader
        isRootScreen={isRootScreen}
        screen={screen}
        formId={form.id}
        activeSupplierId={activeSupplierId}
        setScreen={setScreen}
        detailBackTarget={detailBackTarget}
        isOnline={isOnline}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        lang={lang}
        setLang={setLang}
        t={t}
      />

      <AppScreens
        active={active}
        activeOffers={activeOffers}
        activeOffersValueText={activeOffersValueText}
        activeStageIdx={activeStageIdx}
        activeSupplierId={activeSupplierId}
        activityLog={activityLog}
        addAdminEmail={addAdminEmail}
        addOffer={addOffer}
        adminEmails={adminEmails}
        allSupplierCategories={allSupplierCategories}
        allSupplierTags={allSupplierTags}
        allTags={allTags}
        availableAddedMonths={availableAddedMonths}
        availableOwners={availableOwners}
        canEdit={canEdit}
        canViewDashboard={canViewDashboard}
        changeStage={changeStage}
        clearCallReminder={clearCallReminder}
        confirmAction={confirmAction}
        dashboardAccess={dashboardAccess}
        dateAddedFilter={dateAddedFilter}
        dateAddedScopeTotal={dateAddedScopeTotal}
        deleteActivity={deleteActivity}
        deleteOffer={deleteOffer}
        deleteSupplier={deleteSupplier}
        deleteVisit={deleteVisit}
        dismissSignup={dismissSignup}
        dueReminders={dueReminders}
        duplicateGroups={duplicateGroups}
        errors={errors}
        exchangeRate={exchangeRate}
        expandedOfferId={expandedOfferId}
        exportAllToExcel={exportAllToExcel}
        exportFilteredToExcel={exportFilteredToExcel}
        exportSuppliersAllToExcel={exportSuppliersAllToExcel}
        exportSuppliersFilteredToExcel={exportSuppliersFilteredToExcel}
        fileInputRef={fileInputRef}
        filtered={filtered}
        filteredSuppliers={filteredSuppliers}
        form={form}
        grantAccess={grantAccess}
        handleImportFile={handleImportFile}
        handleImportSupplierFile={handleImportSupplierFile}
        importProgress={importProgress}
        importing={importing}
        importingSuppliers={importingSuppliers}
        isOnline={isOnline}
        isOwnerAccount={isOwnerAccount}
        isPrimaryAdmin={isPrimaryAdmin}
        isReviewer={isReviewer}
        isSaving={isSaving}
        lang={lang}
        loaded={loaded}
        logVisitToday={logVisitToday}
        members={members}
        missingDataCount={missingDataCount}
        missingDataOnly={missingDataOnly}
        newActivityText={newActivityText}
        newMemberEmail={newMemberEmail}
        newMemberRole={newMemberRole}
        newOffer={newOffer}
        noVisitsCount={noVisitsCount}
        noVisitsOnly={noVisitsOnly}
        openDetail={openDetail}
        openEdit={openEdit}
        openEditSupplier={openEditSupplier}
        openNew={openNew}
        openNewSupplier={openNewSupplier}
        openPendingEditItem={openPendingEditItem}
        openPendingSupplierEditItem={openPendingSupplierEditItem}
        ownerUid={ownerUid}
        pendingEdits={pendingEdits}
        pendingSignups={pendingSignups}
        pendingSupplierEdits={pendingSupplierEdits}
        primaryAdminEmail={primaryAdminEmail}
        query={query}
        removeAdminEmail={removeAdminEmail}
        removeTagFromForm={removeTagFromForm}
        removeTagFromSupplierForm={removeTagFromSupplierForm}
        renameSupplierTag={renameSupplierTag}
        renameTag={renameTag}
        reviewSignup={reviewSignup}
        revokeAccess={revokeAccess}
        saveForm={saveForm}
        saveSupplierForm={saveSupplierForm}
        screen={screen}
        sectorCounts={sectorCounts}
        sectorFilter={sectorFilter}
        setDateAddedFilter={setDateAddedFilter}
        setExchangeRate={setExchangeRate}
        setExpandedOfferId={setExpandedOfferId}
        setForm={setForm}
        setMemberDashboardAccess={setMemberDashboardAccess}
        setMissingDataOnly={setMissingDataOnly}
        setNewActivityText={setNewActivityText}
        setNewMemberEmail={setNewMemberEmail}
        setNewMemberRole={setNewMemberRole}
        setNewOffer={setNewOffer}
        setNoVisitsOnly={setNoVisitsOnly}
        setQuery={setQuery}
        setScreen={setScreen}
        setSectorFilter={setSectorFilter}
        setShowDuplicates={setShowDuplicates}
        setStageFilter={setStageFilter}
        setSupplierCategoryFilter={setSupplierCategoryFilter}
        setSupplierForm={setSupplierForm}
        setSupplierPickerOpen={setSupplierPickerOpen}
        setSupplierQuery={setSupplierQuery}
        setSupplierTagFilter={setSupplierTagFilter}
        setTagFilter={setTagFilter}
        setUnifyCurrency={setUnifyCurrency}
        showAlert={showAlert}
        showDuplicates={showDuplicates}
        stageFilter={stageFilter}
        staleCustomers={staleCustomers}
        staleOffers={staleOffers}
        submitActivity={submitActivity}
        supplierCategoryFilter={supplierCategoryFilter}
        supplierErrors={supplierErrors}
        supplierFileInputRef={supplierFileInputRef}
        supplierForm={supplierForm}
        supplierImportProgress={supplierImportProgress}
        supplierPickerOpen={supplierPickerOpen}
        supplierQuery={supplierQuery}
        supplierTagFilter={supplierTagFilter}
        suppliers={suppliers}
        suppliersLoaded={suppliersLoaded}
        switchOwnerWorkspace={switchOwnerWorkspace}
        supplierTagCounts={supplierTagCounts}
        supplierTagBusy={supplierTagBusy}
        t={t}
        tagBusy={tagBusy}
        tagCounts={tagCounts}
        tagFilter={tagFilter}
        toggleOfferSupplier={toggleOfferSupplier}
        togglePin={togglePin}
        togglePinSupplier={togglePinSupplier}
        totalCustomers={totalCustomers}
        unifyCurrency={unifyCurrency}
        triggerImportPicker={triggerImportPicker}
        triggerSupplierImportPicker={triggerSupplierImportPicker}
        updateOfferStatus={updateOfferStatus}
        user={user}
        visibleSuppliers={visibleSuppliers}
        visibleVisits={visibleVisits}
        visits={visits}
      />

      <AppUndoToasts
        t={t}
        isRootScreen={isRootScreen}
        pendingDelete={pendingDelete}
        undoDelete={undoDelete}
        pendingSupplierDelete={pendingSupplierDelete}
        undoSupplierDelete={undoSupplierDelete}
      />

      {isRootScreen && <BottomNav screen={screen} setScreen={setScreen} t={t} isOwnerAccount={isOwnerAccount} isReviewer={isReviewer} canViewDashboard={canViewDashboard} />}

      <AppModals
        t={t}
        rejectionPrompt={rejectionPrompt}
        setRejectionPrompt={setRejectionPrompt}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
      />
    </div>
    </DashboardProvider>
  );
}
