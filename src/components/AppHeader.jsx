import {
  ChevronRight, Languages, LogOut, Wifi, WifiOff, Moon, Sun,
} from "lucide-react";
import { signOutAndClearLocalData } from "../firebase";
import { BrandMark } from "./Shared";
import { PRIMARY } from "../theme";
import { resolveBackTarget } from "../backTarget";

// Title shown next to the back button. "list" (the home screen) shows the
// brand wordmark instead of a text title.
function screenTitleText(screen, formId, activeSupplierId, t) {
  const titles = {
    dashboard: t.titleDashboard,
    form: formId ? t.titleEdit : t.titleNew,
    detail: t.titleDetail,
    suppliers: t.suppliersTitle,
    "supplier-form": activeSupplierId ? t.titleEditSupplier : t.titleNewSupplier,
    settings: t.settingsTitle,
    "audit-log": t.auditLogTitle,
  };
  return titles[screen];
}

function HeaderTitle({ screen, formId, activeSupplierId, t }) {
  if (screen === "list") {
    return (
      <span className="flex items-baseline" style={{ gap: 6 }}>
        <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: 0.5 }}>PEST</span>
        <span style={{ fontWeight: 500, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>CRM</span>
      </span>
    );
  }
  return <span className="font-bold text-lg">{screenTitleText(screen, formId, activeSupplierId, t)}</span>;
}

function OnlineIndicator({ isOnline, t }) {
  return (
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
  );
}

// The sticky top app bar: back button (or brand mark on root screens),
// screen title, online indicator, dark-mode/language toggles, sign out.
// Pure presentational + the sign-out action itself (self-contained, not
// part of the app's core state) — everything else is driven by props.
export default function AppHeader({
  isRootScreen, screen, formId, activeSupplierId, setScreen, detailBackTarget,
  isOnline, darkMode, setDarkMode, lang, setLang, t,
}) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3"
      style={{ background: PRIMARY, position: "sticky", top: 0, zIndex: 10 }}
    >
      {!isRootScreen ? (
        <button
          onClick={() => setScreen(
            resolveBackTarget(screen, { hasFormId: Boolean(formId), detailBackTarget, auditLogTarget: "settings" })
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
        <HeaderTitle screen={screen} formId={formId} activeSupplierId={activeSupplierId} t={t} />
      </span>
      <div
        className="flex items-center gap-2"
        style={{ background: "rgba(255,255,255,0.14)", borderRadius: 10, padding: "6px 10px" }}
      >
        {isRootScreen && <OnlineIndicator isOnline={isOnline} t={t} />}
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
        onClick={() => signOutAndClearLocalData()}
        className="btn-press flex items-center"
        style={{ color: "#fff" }}
        aria-label={t.signOut}
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
