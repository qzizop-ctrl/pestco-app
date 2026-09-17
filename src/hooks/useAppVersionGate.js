import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { compareVersions } from "../helpers";

// This build's version, baked in at build time from package.json by
// vite.config.js's `define` (so bumping the version that gets shipped is
// just bumping package.json before `npm run build` / android:sync /
// electron:build — one number, reused everywhere). The typeof-check
// fallback only matters if something runs this file outside Vite/Vitest,
// where the define wouldn't exist; "0.0.0" there is the safe direction —
// it reads as older than any real minVersion, so the gate blocks instead
// of silently never triggering.
const CURRENT_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

// Same Electron check firebase.js already uses to pick an auth persistence
// strategy (see the isElectron comment there) — Capacitor.getPlatform()
// alone reports "web" for both a real browser tab and the Electron build,
// so it can't tell them apart on its own; the userAgent check is what
// actually does. Computed once at module load (it can't change at
// runtime) rather than inside the hook.
const PLATFORM = (() => {
  if (Capacitor.getPlatform() === "android") return "android";
  const isElectron = typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent || "");
  return isElectron ? "electron" : "web";
})();

// Watches config/appVersion in Firestore (public read, console/Admin-SDK-
// only write — see firestore.rules) and reports whether *this running
// build* is older than the minVersion published there. Deliberately kept
// independent of auth/workspace state — App.jsx checks this before
// `authChecked`/`user`, so an already-logged-in old session gets caught
// just as fast as someone opening a fresh old install, and it still works
// for a user who hasn't signed in yet.
//
// Fails open: if the doc doesn't exist, has no minVersion, or can't be
// read at all (offline, rules not deployed yet, whatever), this reports
// outdated=false. The kill-switch only starts doing anything once an admin
// deliberately creates config/appVersion by hand — see the README section
// on forcing old installed clients to update.
//
// The update link is platform-specific: an APK link is useless on Windows
// and vice versa. `updateUrl` is the generic/fallback field (also what
// backs the web build, which has no separate download link of its own —
// UpdateRequiredScreen's other button, "reload", is what actually matters
// there); `updateUrlAndroid` / `updateUrlWindows` override it per platform
// when set. None of this changes what was already documented for
// `updateUrl` alone — a workspace that only ever sets `updateUrl` (e.g.
// pointing at the APK) keeps behaving exactly as before on every platform.
export function useAppVersionGate() {
  const [minVersion, setMinVersion] = useState(null);
  const [links, setLinks] = useState({ updateUrl: null, updateUrlAndroid: null, updateUrlWindows: null });

  useEffect(() => {
    const ref = doc(db, "config", "appVersion");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        const str = (v) => (typeof v === "string" ? v : null);
        setMinVersion(data ? str(data.minVersion) : null);
        setLinks({
          updateUrl: data ? str(data.updateUrl) : null,
          updateUrlAndroid: data ? str(data.updateUrlAndroid) : null,
          updateUrlWindows: data ? str(data.updateUrlWindows) : null,
        });
      },
      () => {
        setMinVersion(null);
        setLinks({ updateUrl: null, updateUrlAndroid: null, updateUrlWindows: null });
      }
    );
    return () => unsub();
  }, []);

  const outdated = minVersion != null && compareVersions(CURRENT_VERSION, minVersion) < 0;
  const updateUrl =
    (PLATFORM === "android" ? links.updateUrlAndroid : PLATFORM === "electron" ? links.updateUrlWindows : null) ||
    links.updateUrl;

  return { outdated, currentVersion: CURRENT_VERSION, minVersion, updateUrl, platform: PLATFORM };
}

