// ============================================================================
// Content-Security-Policy for the built app (web, Windows/Electron, Android).
//
// It is injected into dist/index.html at BUILD time by the `pestco-csp` plugin
// in vite.config.js — not written by hand into index.html — because:
//   - `npm run dev` must stay unrestricted (Vite's dev server injects inline
//     scripts for hot reload that a strict script-src would block), and
//   - the Sentry host depends on VITE_SENTRY_DSN, and the end-to-end tests
//     need the local Firebase emulator hosts allowed. Neither is known until
//     build time.
//
// Why each directive is what it is (everything not listed falls back to
// default-src 'self'):
//   script-src 'self'          Only the Vite bundle. No inline scripts, no
//                              eval — this is the directive that actually stops
//                              injected script from running.
//   style-src ... 'unsafe-inline'
//                              React renders `style="..."` attributes all over
//                              the UI, and those need 'unsafe-inline'. It is
//                              limited to styles; scripts stay strict.
//   https://fonts.googleapis.com / https://fonts.gstatic.com
//                              The Tajawal font (see index.html).
//   img-src 'self' data: blob: Inline SVG/PNG data URIs (e.g. the login badge)
//                              and PDF/canvas output.
//   connect-src                Firebase Auth + Firestore (*.googleapis.com), the
//                              connectivity probe in useAppPrefs.js
//                              (www.gstatic.com), and Sentry when a DSN is set.
//   frame-src                  Only the project's own Firebase auth domain, in
//                              case a popup/redirect sign-in is ever added.
//                              Email/password sign-in does not use it.
//   object-src 'none', base-uri 'self', form-action 'self'
//                              Close the classic plugin / <base> / form-post
//                              injection routes.
//
// `frame-ancestors` is deliberately absent: browsers ignore it in a <meta> tag,
// and this app never runs inside someone else's page anyway.
// ============================================================================

// "https://abc123@o456.ingest.de.sentry.io/789" -> "https://o456.ingest.de.sentry.io"
// Returns null for an empty/invalid DSN so CSP generation can never throw and
// break the build over a typo in an optional setting.
export function sentryOriginFromDsn(dsn) {
  if (!dsn || typeof dsn !== "string") return null;
  try {
    const url = new URL(dsn.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

// Origins the app talks to when VITE_USE_FIREBASE_EMULATOR=true (end-to-end
// tests only — see src/firebase.js and playwright.config.mjs).
export const EMULATOR_ORIGINS = [
  "http://127.0.0.1:8080",
  "http://localhost:8080",
  "http://127.0.0.1:9099",
  "http://localhost:9099",
];

export function buildCsp({ sentryDsn = "", useEmulator = false } = {}) {
  const connect = ["'self'", "https://*.googleapis.com", "https://www.gstatic.com"];
  const sentryOrigin = sentryOriginFromDsn(sentryDsn);
  if (sentryOrigin) connect.push(sentryOrigin);
  if (useEmulator) connect.push(...EMULATOR_ORIGINS);

  const directives = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'"]],
    ["style-src", ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]],
    ["font-src", ["'self'", "https://fonts.gstatic.com"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["connect-src", connect],
    ["frame-src", ["https://*.firebaseapp.com", "https://*.web.app"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
  ];

  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}
