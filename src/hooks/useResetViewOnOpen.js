import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

// ---------------------------------------------------------------------------
// Always brings the app back to the customer list with every filter
// cleared whenever it's reopened on a mobile device. On Android/iOS,
// pressing Home doesn't actually quit the app — Capacitor just backgrounds
// it, so without this, reopening it from the app switcher/launcher landed
// wherever the screen and filters happened to be left, indefinitely. This
// listens for Capacitor's "appStateChange" and resets the view every time
// the app becomes active again — including the very first launch.
// No-ops entirely outside a native Capacitor build (e.g. in the browser
// during `npm run dev`), so it's always safe to call.
// ---------------------------------------------------------------------------
export function useResetViewOnOpen(resetToDefaultView) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const sub = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) resetToDefaultView();
    });

    return () => {
      sub.then((s) => s.remove()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
