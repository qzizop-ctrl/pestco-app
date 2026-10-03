// ============================================================================
// End-to-end tests: the REAL production build of the app, in a real browser,
// talking to the LOCAL Firebase emulators (Auth + Firestore, with the project's
// real src/firestore.rules loaded). Nothing here touches the live Firebase
// project, and "demo-" project ids can never reach it.
//
// Run:    npm run test:e2e        (needs Java for the Firestore emulator — see
//                                  e2e/README.md for the one-time setup)
// ============================================================================
import { defineConfig, devices } from "@playwright/test";

// Must match the --project in the `test:e2e` script (package.json) and the
// PROJECT_ID in e2e/emulator.mjs.
const PROJECT_ID = "demo-pestco-e2e";
const PORT = 4173;
const ORIGIN = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.mjs",

  // One shared emulator: tests wipe and re-seed it, so they run one at a time.
  fullyParallel: false,
  workers: 1,

  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: ORIGIN,
    // Traces + screenshots are what make a failure in CI debuggable without
    // re-running it locally; kept only for failures to keep artifacts small.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // Production build (so the CSP <meta> that only `vite build` injects is
    // really what runs) served by `vite preview`.
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Variables already in the environment win over .env files in Vite, so
      // a developer's real .env can't leak into this build.
      VITE_USE_FIREBASE_EMULATOR: "true",
      VITE_FIREBASE_API_KEY: "fake-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
      VITE_FIREBASE_PROJECT_ID: PROJECT_ID,
      VITE_FIREBASE_STORAGE_BUCKET: `${PROJECT_ID}.appspot.com`,
      VITE_FIREBASE_MESSAGING_SENDER_ID: "0",
      VITE_FIREBASE_APP_ID: "1:0:web:e2e",
      VITE_SENTRY_DSN: "",
    },
  },
});
