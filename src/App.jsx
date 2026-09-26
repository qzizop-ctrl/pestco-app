import { useState, useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { BottomNav } from "./components/Shared";
import AppHeader from "./components/AppHeader";
import UndoToast from "./components/UndoToast";
import AppScreens from "./components/AppScreens";
import RejectionReasonModal from "./components/RejectionReasonModal";
import ConfirmModal from "./components/ConfirmModal";
// xlsx is loaded lazily (dynamic import) only when Export/Import is
// actually used from Settings, instead of top-level here — it's a sizeable
// library that most sessions never touch, so this keeps it out of the
// app's initial bundle/load. See useExcelExport / useExcelImport.
import { reportException } from "./sentry";
import AuthScreen from "./AuthScreen";
import { useAppPrefs } from "./hooks/useAppPrefs";
import { useWorkspace } from "./hooks/useWorkspace";
import { useAccessManagement } from "./hooks/useAccessManagement";
import { useLiveData } from "./hooks/useLiveData";
import { useExcelExport } from "./hooks/useExcelExport";
import { useExcelImport } from "./hooks/useExcelImport";
import { useAutoBackup } from "./hooks/useAutoBackup";
import { useReminders } from "./hooks/useReminders";
import { useAndroidBackButton } from "./hooks/useAndroidBackButton";
import { useResetViewOnOpen } from "./hooks/useResetViewOnOpen";
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
import { TEXT, MUTED, THEME_VARS } from "./theme";
import { STRINGS } from "./i18n";
import { STAGE_IDS } from "./domain";
import { parseVisitDate, fmtUnifiedOrSplit, sumOffersByCurrency } from "./helpers";

const ROOT_SCREENS = ["dashboard", "list", "suppliers", "settings"];

export default function App() {
  const {
    lang, setLang, darkMode, setDarkMode, isOnline,
    exchangeRate, setExchangeRate, unifyCurrency, setUnifyCurrency,
  } = useAppPrefs();

  const [screen, setScreen] = useState("list"); // dashboard | list | form | detail | settings
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

  // Surfaces a failed access-management write (grant/revoke/review/dismiss)
  // instead of leaving it silent. This previously only logged to the
  // browser console, so the owner would see the Settings action "succeed"
  // with no feedback while the underlying Firestore write was actually
  // rejected — most commonly because the security rules deployed on the
  // live Firebase project are out of date (the firestore.rules file has to
  // be deployed on its own; having it in the repo doesn't apply it).
  const reportWorkspaceError = useCallback((e) => {
    reportException(e, { source: "workspace" });
    const code = e && e.code ? ` (${e.code})` : "";
    showAlert(
      lang === "ar"
        ? `حصل خطأ أثناء حفظ التغيير${code}. لو بيتكرر، تأكد إن قواعد الأمان (Firestore Rules) متنشورة فعليًا على مشروع Firebase — وجودها في الكود مش كفاية.`
        : `Failed to save the change${code}. If this keeps happening, confirm the Firestore security rules are actually deployed on the Firebase project — having them in the code isn't enough.`
    );
  }, [lang, showAlert]);

  // Surfaces a save failure to the user instead of swallowing it silently.
  // A "permission-denied" here almost always means the signed-in account's
  // role in Firestore doesn't actually match what Settings shows (e.g. it's
  // still "viewer" server-side) — this makes that visible instead of the
  // save just silently doing nothing.
  const reportSaveError = (e) => {
    console.error("Save failed:", e);
    const isPermissionError = e && (e.code === "permission-denied" || String(e.code || "").includes("permission-denied"));
    showAlert(
      isPermissionError
        ? (lang === "ar"
            ? "معنديش صلاحية أكتب في البيانات دي. تأكد إن الدور بتاعك مضبوط 'يشوف ويعدل' فعليًا."
            : "You don't have permission to write this data. Confirm your role is actually set to 'editor'.")
        : (lang === "ar" ? `حصل خطأ أثناء الحفظ: ${e && e.message ? e.message : e}` : `Save failed: ${e && e.message ? e.message : e}`)
    );
  };

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
    form,
    isRootScreen,
    hasOpenModal: !!rejectionPrompt || !!confirmDialog,
    closeModal: () => {
      setRejectionPrompt(null);
      setConfirmDialog(null);
    },
  });

  // Clears stale search/filter state whenever the app is reopened on
  // mobile — see useResetViewOnOpen for why that part is needed (Capacitor
  // just backgrounds the app on Home, so without this, old filters/search
  // text could sit active indefinitely). Screen navigation is handled
  // separately: if the person is actively looking at a specific
  // customer/supplier ("detail"/"supplier-form"), jumping them back to the
  // list every time the app merely comes back to the foreground was its
  // own bug — e.g. stepping out to take a phone call and coming back to
  // find the customer's page gone, notes still unwritten. Screens like that
  // are left alone by default; falling back to "list" is still correct for
  // transient/no-longer-meaningful screens (a half-filled "new customer"
  // form, etc.) since there's no in-progress record identity to preserve.
  // `force=true` always resets to "list" regardless — used on sign-out
  // below, where staying on someone's customer/supplier record after
  // logging out (e.g. a different person logging into a shared device)
  // would be a real privacy problem, not a convenience to preserve.
  const PRESERVED_SCREENS_ON_RESUME = ["detail", "supplier-form", "settings", "suppliers", "dashboard"];
  const resetToDefaultView = (force = false) => {
    setScreen((current) => (!force && PRESERVED_SCREENS_ON_RESUME.includes(current) ? current : "list"));
    setQuery("");
    setSectorFilter("all");
    setStageFilter("all");
    setTagFilter("all");
    setMissingDataOnly(false);
    setNoVisitsOnly(false);
    setDateAddedFilter("all");
  };
  useResetViewOnOpen(resetToDefaultView);

  // Signing out only swaps AuthScreen back in — it doesn't touch screen/
  // filter state, since those live in this same component and nothing
  // else was clearing them. Without this, whoever logs in next (the same
  // person again, or a different account on a shared device) landed
  // straight back on whatever screen/filters were active when the
  // previous session logged out, instead of a clean customer list.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (!user && wasSignedIn.current) {
      resetToDefaultView(true);
    }
    wasSignedIn.current = !!user;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Surfaces a *read* failure on the customer list itself — previously this
  // was swallowed entirely by useLiveData, so an account without real
  // server-side access just saw an empty list forever with zero indication
  // why. Alerts once per failed ownerUid, not on every re-render.
  const reportedVisitsErrorRef = useRef(null);
  useEffect(() => {
    if (!visitsError || reportedVisitsErrorRef.current === ownerUid) return;
    reportedVisitsErrorRef.current = ownerUid;
    const isPermissionError = visitsError.code === "permission-denied";
    showAlert(
      isPermissionError
        ? (lang === "ar"
            ? "معنديش صلاحية أشوف البيانات دي. تأكد إن الإيميل بتاعك مضاف صح في Settings عند صاحب الحساب."
            : "You don't have permission to read this data. Confirm your email is correctly added in the owner's Settings.")
        : (lang === "ar" ? `حصل خطأ أثناء تحميل العملاء: ${visitsError.message}` : `Failed to load customers: ${visitsError.message}`)
    );
  }, [visitsError, ownerUid, lang, showAlert]);

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

  const activeStageIdx = active ? STAGE_IDS.indexOf(active.stage || "") : -1;
  const activityLog = active ? [...(active.activityLog || [])].sort((a, b) => (a.at < b.at ? 1 : -1)) : [];
  const activeOffers = active ? [...(active.offers || [])].sort((a, b) => {
    const da = parseVisitDate(a.offerDate);
    const db = parseVisitDate(b.offerDate);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db - da;
  }) : [];
  const activeOffersTotals = sumOffersByCurrency(activeOffers);
  const activeOffersValueText = fmtUnifiedOrSplit(activeOffersTotals, t, exchangeRate, unifyCurrency);

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

      {pendingDelete && (
        <UndoToast
          companyName={pendingDelete.companyName}
          onUndo={undoDelete}
          isRootScreen={isRootScreen}
          t={t}
        />
      )}

      {pendingSupplierDelete && (
        <UndoToast
          companyName={pendingSupplierDelete.companyName}
          onUndo={undoSupplierDelete}
          isRootScreen={isRootScreen}
          t={t}
        />
      )}

      {isRootScreen && <BottomNav screen={screen} setScreen={setScreen} t={t} isOwnerAccount={isOwnerAccount} isReviewer={isReviewer} canViewDashboard={canViewDashboard} />}

      {rejectionPrompt && (
        <RejectionReasonModal
          t={t}
          initialReasonId={rejectionPrompt.initialReasonId}
          initialReasonText={rejectionPrompt.initialReasonText}
          onConfirm={(picked) => {
            const { onConfirm } = rejectionPrompt;
            setRejectionPrompt(null);
            onConfirm(picked);
          }}
          onCancel={() => setRejectionPrompt(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmModal
          t={t}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          danger={confirmDialog.danger}
          onConfirm={() => {
            const { onConfirm } = confirmDialog;
            setConfirmDialog(null);
            onConfirm();
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
