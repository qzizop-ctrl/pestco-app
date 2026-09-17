import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Bakes package.json's version into the client bundle as a build-time
// constant (see src/hooks/useAppVersionGate.js), so "what version is this
// build" doesn't have to be duplicated by hand anywhere else. Bumping the
// version that gets shipped is just bumping package.json before `npm run
// build` / `android:sync` / `electron:build` — same version number ends up
// in the web bundle, the Android app, and the Electron app.
const pkgVersion = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8")
).version;

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion),
  },
});
