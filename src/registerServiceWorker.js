import { Capacitor } from "@capacitor/core";

// Registers public/sw.js so the web build is a real installable PWA that
// opens offline (the README always said "PWA", but there was no manifest and
// no service worker). Skipped where it can't or shouldn't run:
//   - dev server (would cache half-built modules),
//   - the Android app (Capacitor already serves the bundle from the device),
//   - the Windows/Electron build (loads from file://, no service workers),
//   - any non-http(s) origin.
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;
  if (Capacitor.isNativePlatform()) return;
  if (navigator.userAgent.includes("Electron")) return;
  if (location.protocol !== "https:" && location.protocol !== "http:") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((err) => console.warn("Service worker registration failed:", err));
  });
}
