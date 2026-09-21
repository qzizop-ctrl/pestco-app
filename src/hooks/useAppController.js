import { useState, useEffect, useRef, useCallback } from "react";
import { useAppPrefs } from "./useAppPrefs";
import { useWorkspace } from "./useWorkspace";
import { useAccessManagement } from "./useAccessManagement";
import { useLiveData } from "./useLiveData";
import { useExcelExport } from "./useExcelExport";
import { useExcelImport } from "./useExcelImport";
import { useAutoBackup } from "./useAutoBackup";
import { useReminders } from "./useReminders";
import { useAndroidBackButton } from "./useAndroidBackButton";
import { useAppViewLifecycle } from "./useAppViewLifecycle";
import { useActiveCustomerView } from "./useActiveCustomerView";
import { useNavRestore } from "./useNavRestore";
import { useCustomerRecords } from "./useCustomerRecords";
import { useSupplierRecords } from "./useSupplierRecords";
import { useOfferActions } from "./useOfferActions";
import { useActivityLog, makeAppendActivity } from "./useActivityLog";
import { useFilteredData } from "./useFilteredData";
import { useDialogState } from "./useDialogState";
import { useCustomerFilters } from "./useCustomerFilters";
import { useSupplierFilters } from "./useSupplierFilters";
import { useTagManagement } from "./useTagManagement";
import { useErrorReporting } from "./useErrorReporting";
import { THEME_VARS } from "../theme";
import { STRINGS } from "../i18n";

const ROOT_SCREENS = ["dashboard", "list", "suppliers", "settings"];

// Everything App.jsx used to wire up directly — every hook call, all derived
// state, and the big alphabetized prop bag for AppScreens — now lives here.
// App.jsx just calls this and renders. See App.jsx for the actual layout.
export function useAppController() {
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
  // provided in App.jsx's return, and is read directly by Dashboard.jsx —
  // no longer threaded through here or through AppScreens.jsx as props.

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

  // The full prop bag for <AppScreens />, kept as one object here instead of
  // ~130 individual JSX attributes in App.jsx.
  const screenProps = {
    active, activeOffers, activeOffersValueText, activeStageIdx, activeSupplierId, activityLog,
    addAdminEmail, addOffer, adminEmails, allSupplierCategories, allSupplierTags, allTags,
    availableAddedMonths, availableOwners, canEdit, canViewDashboard, changeStage, clearCallReminder,
    confirmAction, dashboardAccess, dateAddedFilter, dateAddedScopeTotal, deleteActivity, deleteOffer,
    deleteSupplier, deleteVisit, dismissSignup, dueReminders, duplicateGroups, errors, exchangeRate,
    expandedOfferId, exportAllToExcel, exportFilteredToExcel, exportSuppliersAllToExcel, exportSuppliersFilteredToExcel,
    fileInputRef, filtered, filteredSuppliers, form, grantAccess, handleImportFile, handleImportSupplierFile,
    importProgress, importing, importingSuppliers, isOnline, isOwnerAccount, isPrimaryAdmin, isReviewer, isSaving,
    lang, loaded, logVisitToday, members, missingDataCount, missingDataOnly, newActivityText, newMemberEmail,
    newMemberRole, newOffer, noVisitsCount, noVisitsOnly, openDetail, openEdit, openEditSupplier, openNew,
    openNewSupplier, openPendingEditItem, openPendingSupplierEditItem, ownerUid, pendingEdits, pendingSignups,
    pendingSupplierEdits, primaryAdminEmail, query, removeAdminEmail, removeTagFromForm, removeTagFromSupplierForm,
    renameSupplierTag, renameTag, reviewSignup, revokeAccess, saveForm, saveSupplierForm, screen, sectorCounts,
    sectorFilter, setDateAddedFilter, setExchangeRate, setExpandedOfferId, setForm, setMemberDashboardAccess,
    setMissingDataOnly, setNewActivityText, setNewMemberEmail, setNewMemberRole, setNewOffer, setNoVisitsOnly,
    setQuery, setScreen, setSectorFilter, setShowDuplicates, setStageFilter, setSupplierCategoryFilter,
    setSupplierForm, setSupplierPickerOpen, setSupplierQuery, setSupplierTagFilter, setTagFilter, setUnifyCurrency,
    showAlert, showDuplicates, stageFilter, staleCustomers, staleOffers, submitActivity, supplierCategoryFilter,
    supplierErrors, supplierFileInputRef, supplierForm, supplierImportProgress, supplierPickerOpen, supplierQuery,
    supplierTagFilter, suppliers, suppliersLoaded, switchOwnerWorkspace, supplierTagCounts, supplierTagBusy, t,
    tagBusy, tagCounts, tagFilter, toggleOfferSupplier, togglePin, togglePinSupplier, totalCustomers, unifyCurrency,
    triggerImportPicker, triggerSupplierImportPicker, updateOfferStatus, user, visibleSuppliers, visibleVisits, visits,
  };

  return {
    lang, setLang, darkMode, setDarkMode, isOnline,
    screen, setScreen, detailBackTarget, isRootScreen,
    t, themeVars,
    authChecked, user, authError, clearAuthError,
    form, activeSupplierId,
    rejectionPrompt, setRejectionPrompt, confirmDialog, setConfirmDialog,
    pendingDelete, undoDelete, pendingSupplierDelete, undoSupplierDelete,
    isOwnerAccount, isReviewer, canViewDashboard,
    screenProps,
  };
}
