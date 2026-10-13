import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

// ---------------------------------------------------------------------------
// Brings the app back to the customer list with every filter cleared when
// it's reopened on a mobile device after being away for a while (30 min). On Android/iOS,
// pressing Home doesn't actually quit the app — Capacitor just backgrounds
// it, so without this, reopening it from the app switcher/launcher landed
// wherever the screen and filters happened to be left, indefinitely. This
// listens for Capacitor's "appStateChange" and resets the view every time
// the app becomes active again — including the very first launch.
// No-ops entirely outside a native Capacitor build (e.g. in the browser
// during `npm run dev`), so it's always safe to call.
// ---------------------------------------------------------------------------
// Quick trips out of the app (tapping call / WhatsApp / email on a customer,
// then coming straight back) must NOT wipe the user's filters — that was a
// real bug: pick a filter, open a card, tap call, return -> filters gone.
// So the reset only happens when the app was away for a real while.
const RESET_AFTER_AWAY_MS = 30 * 60 * 1000;

export function useResetViewOnOpen(resetToDefaultView) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let hiddenAt = null;
    const sub = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        hiddenAt = Date.now();
        return;
      }
      const awayMs = hiddenAt == null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (awayMs >= RESET_AFTER_AWAY_MS) resetToDefaultView();
    });

    return () => {
      sub.then((s) => s.remove()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
