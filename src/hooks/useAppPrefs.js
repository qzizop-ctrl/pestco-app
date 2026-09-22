import { useState, useEffect } from "react";
import { STRINGS } from "../i18n";

// Small, self-contained preferences: language + dark mode (persisted to
// localStorage) and the browser's online/offline status. Extracted out of
// App.jsx because it has no dependency on any other app state.
export function useAppPrefs() {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem("pestco_lang");
      return saved && STRINGS[saved] ? saved : "ar";
    } catch {
      return "ar";
    }
  });

  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("pestco_dark") === "1";
    } catch {
      return false;
    }
  });

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // USD->EGP exchange rate the user enters in Settings, and whether the
  // Dashboard should use it to fold the offers-value summary into a single
  // EGP figure instead of showing "X EGP + Y USD" side by side. Both are a
  // per-device display preference (like lang/darkMode above), not shared
  // data — every rep can set their own rate, and it never touches Firestore.
  const [exchangeRate, setExchangeRate] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("pestco_usd_rate"));
      return saved > 0 ? saved : null;
    } catch {
      return null;
    }
  });

  const [unifyCurrency, setUnifyCurrency] = useState(() => {
    try {
      return localStorage.getItem("pestco_unify_currency") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (exchangeRate > 0) localStorage.setItem("pestco_usd_rate", String(exchangeRate));
      else localStorage.removeItem("pestco_usd_rate");
    } catch {
      // localStorage may be unavailable (e.g. private browsing) — safe to ignore.
    }
  }, [exchangeRate]);

  useEffect(() => {
    try {
      localStorage.setItem("pestco_unify_currency", unifyCurrency ? "1" : "0");
    } catch {
      // localStorage may be unavailable (e.g. private browsing) — safe to ignore.
    }
  }, [unifyCurrency]);

  useEffect(() => {
    try {
      localStorage.setItem("pestco_lang", lang);
    } catch {
      // localStorage may be unavailable (e.g. private browsing) — safe to ignore.
    }
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem("pestco_dark", darkMode ? "1" : "0");
    } catch {
      // localStorage may be unavailable (e.g. private browsing) — safe to ignore.
    }
  }, [darkMode]);

  // `navigator.onLine` only reports whether the device has *a* network
  // interface up (e.g. connected to wifi) — it stays true even when that
  // wifi has no real internet access (router with no upstream, captive
  // portal, etc.), which is exactly the case that was showing a green
  // "online" indicator with no actual internet. `navigator.onLine === false`
  // is still a reliable "definitely offline" signal on its own (no
  // interface at all), so that half is kept as a fast path; the "true" case
  // gets verified with an actual network request before being trusted.
  // gstatic.com/generate_204 is the same lightweight, purpose-built
  // endpoint Android/Chrome themselves use for connectivity checks — a
  // fast 204 response with (almost) no bandwidth. `mode: "no-cors"` is used
  // because only "did the request succeed at all" matters here, not the
  // response body, which a cross-origin request can't read anyway.
  useEffect(() => {
    let cancelled = false;

    const verifyRealConnectivity = async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (!cancelled) setIsOnline(false);
        return;
      }
      if (typeof fetch !== "function") {
        if (!cancelled) setIsOnline(true);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        await fetch("https://www.gstatic.com/generate_204", {
          method: "GET",
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!cancelled) setIsOnline(true);
      } catch {
        if (!cancelled) setIsOnline(false);
      }
    };

    verifyRealConnectivity();
    // Re-verify periodically too, not just on the browser's online/offline
    // events — those events don't fire for "still connected to wifi, but
    // the wifi itself lost its internet upstream" (the exact bug being
    // fixed here), only for the network interface itself going up/down.
    const intervalId = setInterval(verifyRealConnectivity, 20000);
    window.addEventListener("online", verifyRealConnectivity);
    // The browser's own "offline" event IS reliable (interface genuinely
    // down), so it can set state directly without re-probing.
    const goOffline = () => !cancelled && setIsOnline(false);
    window.addEventListener("offline", goOffline);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("online", verifyRealConnectivity);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return {
    lang, setLang, darkMode, setDarkMode, isOnline,
    exchangeRate, setExchangeRate, unifyCurrency, setUnifyCurrency,
  };
}
