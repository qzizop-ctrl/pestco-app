import { useState, useEffect } from "react";

const NAV_RESTORE_KEY = "pestco_nav_state";
const RESTORABLE_SCREENS = ["dashboard", "list", "suppliers", "settings", "detail", "supplier-form"];

// Resume where you left off after the app is killed in the background.
//
// On Android especially, switching to another app doesn't just pause this
// one — under memory pressure the OS can kill the whole process outright.
// When the person comes back, this is a fresh React mount: `screen` resets
// to its default ("list") and whatever detail/supplier they had open is
// gone, even though from their side they never closed the app. This
// persists just enough (which screen, which record id) to reopen the same
// place — not full in-progress form data, since restoring a half-typed
// "form"/new-supplier screen with blank fields would be worse than just
// landing on the list.
//
// Split out of App.jsx as a standalone effect-only hook — it doesn't own
// any state that other parts of the app need to read.
export function useNavRestore({
  screen, setScreen, activeId, activeSupplierId,
  loaded, suppliersLoaded, permissionLoading, visits, suppliers,
  openDetail, openEditSupplier,
}) {
  useEffect(() => {
    if (!RESTORABLE_SCREENS.includes(screen)) return;
    // Only persist "supplier-form" when it's actually viewing/editing an
    // existing supplier (has an id to restore with) — a blank new-supplier
    // form isn't worth resuming into.
    if (screen === "supplier-form" && !activeSupplierId) return;
    if (screen === "detail" && !activeId) return;
    try {
      localStorage.setItem(NAV_RESTORE_KEY, JSON.stringify({ screen, activeId, activeSupplierId }));
    } catch (e) {
      // Storage can be unavailable (private mode, quota, etc.) — losing the
      // "resume where I left off" convenience is fine; nothing else here
      // depends on this succeeding.
    }
  }, [screen, activeId, activeSupplierId]);

  const [navRestored, setNavRestored] = useState(false);
  useEffect(() => {
    if (navRestored) return;
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(NAV_RESTORE_KEY) || "null");
    } catch (e) {
      saved = null;
    }
    if (!saved || !RESTORABLE_SCREENS.includes(saved.screen)) {
      setNavRestored(true);
      return;
    }
    if (saved.screen === "detail") {
      if (!loaded) return; // wait for visits to actually load before deciding
      const visit = visits.find((v) => v.id === saved.activeId);
      if (visit) openDetail(visit);
      else setScreen("list");
      setNavRestored(true);
      return;
    }
    if (saved.screen === "supplier-form") {
      // openEditSupplier silently no-ops until canEdit resolves, so wait
      // for permission resolution too, not just the supplier list.
      if (!suppliersLoaded || permissionLoading) return;
      const supplier = suppliers.find((s) => s.id === saved.activeSupplierId);
      if (supplier) openEditSupplier(supplier);
      else setScreen("suppliers");
      setNavRestored(true);
      return;
    }
    setScreen(saved.screen);
    setNavRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navRestored, loaded, suppliersLoaded, permissionLoading, visits, suppliers]);
}
