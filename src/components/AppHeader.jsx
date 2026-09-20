import {
  ChevronRight, Languages, LogOut, Wifi, WifiOff, Moon, Sun,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { BrandMark } from "./Shared";
import { PRIMARY } from "../theme";

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
            screen === "form" && formId ? "detail" :
            screen === "detail" ? detailBackTarget :
            screen === "supplier-form" ? "suppliers" :
            screen === "audit-log" ? "settings" :
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
            {screen === "form" && (formId ? t.titleEdit : t.titleNew)}
            {screen === "detail" && t.titleDetail}
            {screen === "suppliers" && t.suppliersTitle}
            {screen === "supplier-form" && (activeSupplierId ? t.titleEditSupplier : t.titleNewSupplier)}
            {screen === "settings" && t.settingsTitle}
            {screen === "audit-log" && t.auditLogTitle}
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
