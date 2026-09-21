import { useEffect, useRef } from "react";
import { useResetViewOnOpen } from "./useResetViewOnOpen";

// ---------------------------------------------------------------------------
// Extracted from App.jsx. Bundles three self-contained pieces of "when does
// the visible screen/filters get wiped back to a clean list" behavior that
// used to sit as three separate blocks in App.jsx:
//
// 1. resetToDefaultView — clears search/filters and, unless `force` or the
//    current screen is one worth preserving, falls back to the list screen.
//    Screens like "detail"/"supplier-form"/"settings"/"suppliers"/"dashboard"
//    are left alone by default: stepping out to take a phone call and coming
//    back to find the customer's page gone, notes still unwritten, was its
//    own bug. `force=true` (used on sign-out below) always resets regardless
//    — staying on someone's customer/supplier record after logging out
//    (e.g. a different person logging into a shared device) would be a real
//    privacy problem, not a convenience worth preserving.
//
// 2. useResetViewOnOpen(resetToDefaultView) — same reset, triggered when a
//    backgrounded mobile app is reopened (see that hook for why).
//
// 3. A sign-out effect — swapping AuthScreen back in only touches auth
//    state, not screen/filter state, since those live in this same
//    component. Without this, whoever logs in next (the same person again,
//    or a different account on a shared device) would land straight back on
//    whatever screen/filters were active when the previous session logged
//    out, instead of a clean list.
//
// Also carries the visits read-error reporting effect: surfaces a *read*
// failure on the customer list itself (previously swallowed entirely by
// useLiveData, so an account without real server-side access just saw an
// empty list forever with zero indication why). Alerts once per failed
// ownerUid, not on every re-render. It's bundled here rather than split
// into its own hook because it shares this hook's job of "keep the visible
// screen honest," not because it's logically the same mechanism.
// ---------------------------------------------------------------------------
const PRESERVED_SCREENS_ON_RESUME = ["detail", "supplier-form", "settings", "suppliers", "dashboard"];

export function useAppViewLifecycle({
  user,
  setScreen,
  setQuery,
  setSectorFilter,
  setStageFilter,
  setTagFilter,
  setMissingDataOnly,
  setNoVisitsOnly,
  setDateAddedFilter,
  visitsError,
  ownerUid,
  reportVisitsError,
}) {
  const resetToDefaultView = (force = false) => {
    setScreen((current) => (!force && PRESERVED_SCREENS_ON_RESUME.includes(current) ? current : "list"));
    setQuery("");
    setSectorFilter("all");
    setStageFilter("all");
    setTagFilter("all");
    setMissingDataOnly(false);
    setNoVisitsOnly(false);
    setDateAddedFilter("all");
  };
  useResetViewOnOpen(resetToDefaultView);

  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (!user && wasSignedIn.current) {
      resetToDefaultView(true);
    }
    wasSignedIn.current = !!user;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const reportedVisitsErrorRef = useRef(null);
  useEffect(() => {
    if (!visitsError || reportedVisitsErrorRef.current === ownerUid) return;
    reportedVisitsErrorRef.current = ownerUid;
    reportVisitsError(visitsError);
  }, [visitsError, ownerUid, reportVisitsError]);

  return { resetToDefaultView };
}
