import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

// ---------------------------------------------------------------------------
// Makes the Android hardware/gesture back button behave the way people
// expect from a native app instead of the Capacitor default (which just
// closes the whole app from any screen):
//   - if a modal/sheet is open, back closes it
//   - if we're not on a root screen, back goes up one level (same target
//     the in-app header back button already goes to)
//   - if we're already on a root screen, back exits the app
// No-ops entirely outside a native Capacitor build (e.g. in the browser
// during `npm run dev`), so it's always safe to call.
// ---------------------------------------------------------------------------
export function useAndroidBackButton({ screen, setScreen, detailBackTarget, form, isRootScreen, hasOpenModal, closeModal }) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const sub = CapacitorApp.addListener("backButton", () => {
      if (hasOpenModal) {
        closeModal();
        return;
      }
      if (!isRootScreen) {
        setScreen(
          screen === "form" && form.id ? "detail" :
          screen === "detail" ? detailBackTarget :
          screen === "supplier-form" ? "suppliers" :
          "list"
        );
        return;
      }
      CapacitorApp.exitApp();
    });

    return () => {
      sub.then((s) => s.remove()).catch(() => {});
    };
  }, [screen, form.id, isRootScreen, hasOpenModal, closeModal, setScreen, detailBackTarget]);
}
