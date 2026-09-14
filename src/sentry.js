// ============================================================================
// Crash/error reporting via Sentry — entirely optional. With no DSN set
// (VITE_SENTRY_DSN empty/unset), init() does nothing and the app behaves
// exactly as before; nothing else in the app needs to change or guard
// against Sentry being absent.
//
// One-time setup (not something this code can do for you):
//   1. Create a free project at https://sentry.io — pick "React" as the
//      platform.
//   2. Copy its DSN into VITE_SENTRY_DSN in your .env file.
//   3. Rebuild. From then on, unhandled errors on any platform (web,
//      Windows/Electron, Android) get reported automatically — including
//      ones a remote user hits that you'd otherwise never hear about.
// ============================================================================

import * as Sentry from "@sentry/react";
import { Capacitor } from "@capacitor/core";
import pkg from "../package.json";

export function initErrorReporting() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    release: `pestco@${pkg.version}`,
    environment: Capacitor.getPlatform(), // "web" | "android" | "electron" (via userAgent below)
    // Keep this lean on purpose — no session replay/performance tracing,
    // just error capture. Those add real bundle size and quota cost for a
    // feature that's only meant to answer "did anything break, and for who."
    integrations: [],
  });

  // Capacitor.getPlatform() only distinguishes "web" vs "android"/"ios" — it
  // doesn't know about the Electron/Windows build, which is also "web" as
  // far as Capacitor is concerned. Tag it separately so Sentry issues can
  // still be filtered by platform.
  if (typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent || "")) {
    Sentry.setTag("platform", "windows");
  } else {
    Sentry.setTag("platform", Capacitor.getPlatform());
  }
}

// Safe to call even when Sentry was never initialized (no-op in that case).
export function reportException(error, extra) {
  try {
    Sentry.captureException(error, extra ? { extra } : undefined);
  } catch (e) {
    // Never let error reporting itself throw.
  }
}
