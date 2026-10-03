import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { buildCsp } from "./scripts/buildCsp.mjs";

// Only the version string is exposed to app code (see src/sentry.js). The
// app used to `import pkg from "../package.json"`, which bundles the whole
// file — every dependency, script and repo detail — into the public JS.
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Injects the Content-Security-Policy <meta> into dist/index.html. Build only
// (`apply: "build"`): the dev server needs inline scripts for hot reload, so
// `npm run dev` stays unrestricted. The policy itself lives in
// scripts/buildCsp.mjs, where every directive is explained.
function cspPlugin(env) {
  const csp = buildCsp({
    sentryDsn: env.VITE_SENTRY_DSN,
    useEmulator: env.VITE_USE_FIREBASE_EMULATOR === "true",
  });
  return {
    name: "pestco-csp",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: csp },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  // The "VITE_" filter keeps only VITE_* variables, read from .env files AND
  // from the process environment (that is how CI secrets arrive).
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    base: "./",
    plugins: [react(), cspPlugin(env)],
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    // "test" is Vitest's config, read from this same file (its docs
    // recommend this over a separate vitest.config.js so there's only one
    // place resolving aliases/plugins for both dev and test).
    test: {
      // Hook/component tests (useFilteredData.test.js, SummaryCard.test.jsx)
      // render into a simulated DOM via @testing-library/react, which needs
      // a browser-like global (document, window...) — Node has none of that
      // on its own. Pure-function test files (helpers.test.js,
      // dashboardCalculations.test.js, ...) don't need this, but paying the
      // jsdom setup cost for the whole suite is simpler than splitting
      // config by file and is not a noticeable slowdown at this suite size.
      environment: "jsdom",
      setupFiles: ["./src/test/setup.js"],
      // Unit tests live under src/. tests/rules holds the Firestore security-
      // rules tests, which need the Firebase emulator and run through
      // `npm run test:rules` (vitest.rules.config.mjs) instead; e2e/ holds
      // the Playwright browser tests (`npm run test:e2e`).
      include: ["src/**/*.test.{js,jsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        // Config/build/entry files and native-shell glue (electron.js,
        // capacitor.config.json) aren't meaningfully "tested" the way app
        // logic is — excluded so the coverage number reflects src/ code a
        // contributor could actually add a test for.
        exclude: [
          "node_modules/**",
          "dist/**",
          "android/**",
          "src/main.jsx",
          "src/firebase.js",
          "**/*.config.{js,ts}",
          "**/*.test.{js,jsx}",
        ],
      },
    },
  };
});
