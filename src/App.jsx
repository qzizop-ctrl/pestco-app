import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { Capacitor } from "@capacitor/core";
import {
  ChevronRight, Languages, LogOut, Settings,
  Wifi, WifiOff, Moon, Sun,
} from "lucide-react";
import { BrandMark, BottomNav, SkeletonList } from "./components/Shared";
import { SuppliersListScreen, SupplierFormScreen } from "./components/Suppliers";
import SettingsScreen from "./components/Settings";
import CustomerListScreen from "./components/CustomerList";
import CustomerFormScreen from "./components/CustomerForm";
import CustomerDetailScreen from "./components/CustomerDetail";
import RejectionReasonModal from "./components/RejectionReasonModal";
import ConfirmModal from "./components/ConfirmModal";
// xlsx is loaded lazily (dynamic import) only when Export/Import is
// actually used from Settings, instead of top-level here — it's a sizeable
// library that most sessions never touch, so this keeps it out of the
// app's initial bundle/load. See useExcelExport / useExcelImport.
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { reportException } from "./sentry";
import AuthScreen from "./AuthScreen";
import { useAppPrefs } from "./hooks/useAppPrefs";
import { useWorkspace } from "./hooks/useWorkspace";
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
import { PRIMARY, TEXT, MUTED, GOLD, THEME_VARS } from "./theme";
import { STRINGS } from "./i18n";
import { STAGE_IDS } from "./domain";
import { parseVisitDate, fmtOffersTotals, sumOffersByCurrency } from "./helpers";

const ROOT_SCREENS = ["dashboard", "list", "suppliers", "settings"];

// Loaded lazily: the app's default screen is the customer list, not the
// Dashboard, so most sessions never need this chart-heavy screen (and its
// recharts dependency) in the initial bundle at all.
const Dashboard = lazy(() => import("./Dashboard"));

export default function App() {
  const { lang, setLang, darkMode, setDarkMode, isOnline } = useAppPrefs();

  const [screen, setScreen] = useState("list"); // dashboard | list | form | detail | settings
  const [query, setQuery] = useState("");
  // The input stays bound to `query` directly so typing feels instant; the
  // list filter below reads `debouncedQuery` instead, which only updates
  // 250ms after the user stops typing. That avoids re-filtering the full
  // customer list on every single keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(id);
  }, [query]);
  const [sectorFilter, setSectorFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [missingDataOnly, setMissingDataOnly] = useState(false);
  const [noVisitsOnly, setNoVisitsOnly] = useState(false);
  // "all" or a "YYYY-MM" key — filters by when the customer record was
  // created, independent of visit/pipeline status (see availableAddedMonths).
  const [dateAddedFilter, setDateAddedFilter] = useState("all");
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
  // Drives the in-app rejection-reason modal (replaces window.prompt).
  // { initialReason, onConfirm(reason) } while the modal is open, else null.
  const [rejectionPrompt, setRejectionPrompt] = useState(null);
  // Drives the generic in-app confirm/alert modal (replaces window.confirm
  // and window.alert). { message, variant: "confirm"|"alert", danger, onConfirm }
  const [confirmDialog, setConfirmDialog] = useState(null);
  // Replacement for `if (!window.confirm(msg)) return; doThing();` — pass the
  // message and a callback to run only if the user confirms.
  const confirmAction = useCallback((message, onConfirm, { danger = false } = {}) => {
    setConfirmDialog({ message, variant: "confirm", danger, onConfirm });
  }, []);
  // Replacement for window.alert(msg) — shows the same message, but as a
  // dismissible in-app modal instead of a blocking native dialog.
  const showAlert = useCallback((message) => {
    setConfirmDialog({ message, variant: "alert", onConfirm: () => setConfirmDialog(null) });
  }, []);
  const [showDuplicates, setShowDuplicates] = useState(false);

  // ---- Suppliers (separate from customers — contacts only) ----
  const [supplierQuery, setSupplierQuery] = useState("");
  // Same pattern as the customer search: the input stays bound to
  // supplierQuery directly for instant typing feedback, while filtering
  // reads the debounced value 250ms after the user stops typing.
  const [debouncedSupplierQuery, setDebouncedSupplierQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSupplierQuery(supplierQuery), 250);
    return () => clearTimeout(id);
  }, [supplierQuery]);
  const [supplierTagFilter, setSupplierTagFilter] = useState("all");
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState("all");

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
    canEdit, isOwnerAccount, members,
    pendingSignups, isReviewer, isPrimaryAdmin, primaryAdminEmail, adminEmails, addAdminEmail, removeAdminEmail, reviewSignup, dismissSignup,
    switchOwnerWorkspace, grantAccess, revokeAccess,
  } = useWorkspace({ requireOnline, reportError: reportWorkspaceError, screen, setScreen, setActiveId });

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
  } = useOfferActions({ ownerUid, canEdit, requireOnline, confirmAction, setRejectionPrompt, appendActivity, reportSaveError, t });

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
    allTags, sectorCounts, totalCustomers, missingDataCount, noVisitsCount,
    dateAddedScopeTotal, availableAddedMonths, filtered,
    visibleSuppliers, allSupplierTags, allSupplierCategories, filteredSuppliers,
  } = useFilteredData({
    visits, suppliers, pendingDelete, pendingSupplierDelete,
    sectorFilter, stageFilter, tagFilter, missingDataOnly, noVisitsOnly,
    dateAddedFilter, setDateAddedFilter, debouncedQuery,
    supplierTagFilter, supplierCategoryFilter, debouncedSupplierQuery,
    t,
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
  const activeOffersValueText = fmtOffersTotals(activeOffersTotals, t);

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
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: PRIMARY, position: "sticky", top: 0, zIndex: 10 }}
      >
        {!isRootScreen ? (
          <button
            onClick={() => setScreen(
              screen === "form" && form.id ? "detail" :
              screen === "detail" ? "list" :
              screen === "supplier-form" ? "suppliers" :
              "list"
            )}
            className="btn-press"
            style={{ color: "#fff" }}
            aria-label={t.back}
          >
            <ChevronRight size={22} style={{ transform: t.dir === "rtl" ? "none" : "rotate(180deg)" }} />
          </button>
        ) : (
          <div
            className="flex items-center justify-center"
            style={{ width: 34, height: 34, minWidth: 34, background: "rgba(255,255,255,0.14)", borderRadius: 10 }}
          >
            <BrandMark size={15} color="#fff" />
          </div>
        )}
        <span className="flex-1" style={{ color: "#fff" }}>
          {screen === "list" ? (
            <span className="flex items-baseline" style={{ gap: 6 }}>
              <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: 0.5 }}>PEST</span>
              <span style={{ fontWeight: 500, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>CRM</span>
            </span>
          ) : (
            <span className="font-bold text-lg">
              {screen === "dashboard" && t.titleDashboard}
              {screen === "form" && (form.id ? t.titleEdit : t.titleNew)}
              {screen === "detail" && t.titleDetail}
              {screen === "suppliers" && t.suppliersTitle}
              {screen === "supplier-form" && (activeSupplierId ? t.titleEditSupplier : t.titleNewSupplier)}
              {screen === "settings" && t.settingsTitle}
            </span>
          )}
        </span>
        <div
          className="flex items-center gap-2"
          style={{ background: "rgba(255,255,255,0.14)", borderRadius: 10, padding: "6px 10px" }}
        >
          {isRootScreen && (
            <>
              <span
                className="flex items-center"
                style={{ color: isOnline ? "#6FCF97" : "#fff", opacity: isOnline ? 1 : 0.7 }}
                aria-label={isOnline ? "online" : "offline"}
                title={isOnline ? "" : t.offlineBanner}
              >
                {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
              </span>
              <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.25)" }} />
            </>
          )}
          <button
            onClick={() => setDarkMode((d) => !d)}
            className="btn-press flex items-center"
            style={{ color: "#fff" }}
            aria-label={darkMode ? t.lightModeToggle : t.darkModeToggle}
            title={darkMode ? t.lightModeToggle : t.darkModeToggle}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.25)" }} />
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="btn-press flex items-center gap-1 font-bold text-xs"
            style={{ color: "#fff" }}
            aria-label={t.langToggle}
          >
            <Languages size={14} /> {t.langToggle}
          </button>
        </div>
        <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.22)" }} />
        <button
          onClick={() => signOut(auth).catch(() => {})}
          className="btn-press flex items-center"
          style={{ color: "#fff" }}
          aria-label={t.signOut}
        >
          <LogOut size={16} />
        </button>
      </div>

      <div key={screen} className="animate-screen-in">
      {screen === "dashboard" && (
        <Suspense fallback={<div className="px-4 pt-4"><SkeletonList count={3} /></div>}>
          <Dashboard visits={visibleVisits} lang={lang} onOpenCustomer={openDetail} showAlert={showAlert} />
        </Suspense>
      )}

      {screen === "list" && (
        <CustomerListScreen
          t={t}
          isOnline={isOnline}
          dueReminders={dueReminders}
          staleOffers={staleOffers}
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
          isOwnerAccount={isOwnerAccount}
          setScreen={setScreen}
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
        />
      )}
      </div>

      {pendingDelete && (
        <div
          className="flex items-center justify-between gap-3"
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: isRootScreen ? 78 : 16,
            background: PRIMARY,
            color: "#fff",
            borderRadius: 14,
            padding: "12px 16px",
            boxShadow: "0 8px 20px rgba(0,0,0,.25)",
            zIndex: 30,
          }}
        >
          <span className="text-sm font-bold">{t.deletedUndoMsg(pendingDelete.companyName || "")}</span>
          <button
            onClick={undoDelete}
            className="btn-press font-extrabold text-sm flex-shrink-0"
            style={{ color: GOLD }}
          >
            {t.undoBtn}
          </button>
        </div>
      )}

      {pendingSupplierDelete && (
        <div
          className="flex items-center justify-between gap-3"
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: isRootScreen ? 78 : 16,
            background: PRIMARY,
            color: "#fff",
            borderRadius: 14,
            padding: "12px 16px",
            boxShadow: "0 8px 20px rgba(0,0,0,.25)",
            zIndex: 30,
          }}
        >
          <span className="text-sm font-bold">{t.deletedUndoMsg(pendingSupplierDelete.companyName || "")}</span>
          <button
            onClick={undoSupplierDelete}
            className="btn-press font-extrabold text-sm flex-shrink-0"
            style={{ color: GOLD }}
          >
            {t.undoBtn}
          </button>
        </div>
      )}

      {isRootScreen && <BottomNav screen={screen} setScreen={setScreen} t={t} isOwnerAccount={isOwnerAccount} isReviewer={isReviewer} />}

      {rejectionPrompt && (
        <RejectionReasonModal
          t={t}
          initialReason={rejectionPrompt.initialReason}
          onConfirm={(reason) => {
            const { onConfirm } = rejectionPrompt;
            setRejectionPrompt(null);
            onConfirm(reason);
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
