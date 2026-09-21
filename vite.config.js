import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: './',
  plugins: [react()],
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
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Config/build/entry files and native-shell glue (electron.js,
      // capacitor.config.ts) aren't meaningfully "tested" the way app
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
});
