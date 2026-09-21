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
import { useAppController } from "./hooks/useAppController";
import { TEXT, MUTED } from "./theme";

// All the hook wiring, derived state, and the AppScreens prop bag now live
// in useAppController (src/hooks/useAppController.js) — this file is just
// the render tree. See that hook for the "why" behind any piece of state.
export default function App() {
  const {
    lang, setLang, darkMode, setDarkMode, isOnline,
    screen, setScreen, detailBackTarget, isRootScreen,
    t, themeVars,
    authChecked, user, authError, clearAuthError,
    form, activeSupplierId,
    rejectionPrompt, setRejectionPrompt, confirmDialog, setConfirmDialog,
    pendingDelete, undoDelete, pendingSupplierDelete, undoSupplierDelete,
    isOwnerAccount, isReviewer, canViewDashboard,
    screenProps,
  } = useAppController();

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

      <AppScreens {...screenProps} />

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
