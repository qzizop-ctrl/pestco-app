import { useState, useEffect } from "react";
import { STRINGS } from "../constants";

// Small, self-contained preferences: language + dark mode (persisted to
// localStorage) and the browser's online/offline status. Extracted out of
// App.jsx because it has no dependency on any other app state.
export function useAppPrefs() {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem("pestco_lang");
      return saved && STRINGS[saved] ? saved : "ar";
    } catch (e) {
      return "ar";
    }
  });

  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("pestco_dark") === "1";
    } catch (e) {
      return false;
    }
  });

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    try {
      localStorage.setItem("pestco_lang", lang);
    } catch (e) {}
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem("pestco_dark", darkMode ? "1" : "0");
    } catch (e) {}
  }, [darkMode]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return { lang, setLang, darkMode, setDarkMode, isOnline };
}
