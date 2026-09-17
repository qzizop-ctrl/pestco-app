import React from "react";
import { RefreshCw, Download } from "lucide-react";
import { PRIMARY } from "./theme";
import { BrandMark, BADGE_WATERMARK } from "./components/Shared";

// Full-screen, non-dismissible block shown by App.jsx when
// useAppVersionGate() reports this build as older than config/appVersion's
// minVersion. Deliberately has no way out other than actually updating —
// no "continue anyway", no close button — since the whole point is that
// this specific build shouldn't be used anymore (e.g. it talks to
// Firestore in a way the current security rules no longer allow, or has a
// bug serious enough to force everyone off it). See
// src/hooks/useAppVersionGate.js and the README section on forcing old
// clients to update.
//
// Styled to match AuthScreen.jsx (same layout shape/colors) rather than
// the main app's theme, since it can render before auth/theme prefs are
// known.
const BG = "#F7F6F2";
const TEXT = "#22282B";
const MUTED = "#6B7168";

const STRINGS = {
  ar: {
    dir: "rtl",
    title: "في نسخة أحدث من التطبيق",
    body: "النسخة اللي عندك بقت قديمة ومش شغالة دلوقتي. لازم تحدّث التطبيق عشان تقدر تكمل.",
    updateBtn: "تحديث التطبيق",
    reloadBtn: "إعادة تحميل",
    reloadHint: "لو التطبيق مفتوح من المتصفح، إعادة التحميل ممكن تجيب لك آخر نسخة تلقائيًا.",
  },
  en: {
    dir: "ltr",
    title: "A newer version is required",
    body: "The version you have is out of date and can no longer be used. Please update the app to continue.",
    updateBtn: "Update app",
    reloadBtn: "Reload",
    reloadHint: "If you're using the web version, reloading may pick up the latest build automatically.",
  },
};

export default function UpdateRequiredScreen({ lang, currentVersion, minVersion, updateUrl }) {
  const t = STRINGS[lang === "en" ? "en" : "ar"];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        direction: t.dir,
        fontFamily: "'Tajawal', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          background: PRIMARY,
          backgroundImage: BADGE_WATERMARK,
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <BrandMark size={22} color="#fff" showUnderline />
      </div>

      <div style={{ fontWeight: 900, fontSize: 18, color: TEXT, maxWidth: 320 }}>
        {t.title}
      </div>
      <div style={{ color: MUTED, fontSize: 14, maxWidth: 320, marginTop: 8, lineHeight: 1.6 }}>
        {t.body}
      </div>

      {(currentVersion || minVersion) && (
        <div style={{ color: MUTED, fontSize: 11, marginTop: 12, opacity: 0.8 }}>
          {currentVersion ? `v${currentVersion}` : ""}
          {currentVersion && minVersion ? " → " : ""}
          {minVersion ? `v${minVersion}` : ""}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24, width: "100%", maxWidth: 280 }}>
        {updateUrl && (
          <a
            href={updateUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-press flex items-center justify-center gap-2 font-bold text-sm"
            style={{
              background: PRIMARY,
              color: "#fff",
              borderRadius: 10,
              padding: "12px 16px",
              textDecoration: "none",
            }}
          >
            <Download size={16} /> {t.updateBtn}
          </a>
        )}
        <button
          onClick={() => window.location.reload()}
          className="btn-press flex items-center justify-center gap-2 font-bold text-sm"
          style={{
            background: "#fff",
            color: PRIMARY,
            border: `1px solid ${PRIMARY}`,
            borderRadius: 10,
            padding: "12px 16px",
          }}
        >
          <RefreshCw size={16} /> {t.reloadBtn}
        </button>
      </div>

      <div style={{ color: MUTED, fontSize: 11, marginTop: 16, maxWidth: 280, opacity: 0.8 }}>
        {t.reloadHint}
      </div>
    </div>
  );
}
