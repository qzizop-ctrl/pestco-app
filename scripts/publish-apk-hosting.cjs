#!/usr/bin/env node
// ============================================================================
// Copies a built Android APK into hosting-download/pest-latest.apk — the
// fixed filename that firebase.json's "hosting" target serves, and that
// config/appVersion.updateUrl (Firestore) and UpdateRequiredScreen.jsx
// link to. Using one constant filename (not e.g. pest-1.2.0.apk) is the
// whole point: the URL you put in Firestore never has to change again,
// only the file behind it does. See the README section on forcing old
// clients to update.
//
// This script only STAGES the file locally — it does not deploy. Deploy
// with:
//   npm run firebase:deploy-hosting
// or just run both together:
//   npm run apk:publish
//
// Usage:
//   node scripts/publish-apk-hosting.cjs [path-to-apk]
// With no argument, defaults to the debug APK path `npx cap sync android`
// / `./gradlew assembleDebug` produces (matches .github/workflows/
// build-apk.yml, which builds the same debug APK for its GitHub Release).
// ============================================================================
const fs = require("fs");
const path = require("path");

const DEFAULT_APK = path.join(
  __dirname, "..", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"
);
const DEST_DIR = path.join(__dirname, "..", "hosting-download");
const DEST_FILE = path.join(DEST_DIR, "pest-latest.apk");

function main() {
  const srcArg = process.argv[2];
  const src = srcArg ? path.resolve(srcArg) : DEFAULT_APK;

  if (!fs.existsSync(src)) {
    console.error(`APK not found at ${src}`);
    console.error(
      srcArg
        ? "Check the path you passed in."
        : "Run `npm run android:sync` and build the APK first (or pass an explicit path: node scripts/publish-apk-hosting.cjs path/to/app.apk)."
    );
    process.exit(1);
  }

  fs.mkdirSync(DEST_DIR, { recursive: true });
  fs.copyFileSync(src, DEST_FILE);

  const sizeMb = (fs.statSync(DEST_FILE).size / (1024 * 1024)).toFixed(1);
  console.log(`Staged ${src}`);
  console.log(`  -> ${DEST_FILE} (${sizeMb} MB)`);
  console.log("");
  console.log("Next: npm run firebase:deploy-hosting");
  console.log(
    "Reminder: bump \"version\" in package.json and config/appVersion.minVersion in Firestore together with this — staging a new APK alone doesn't force old clients to update."
  );
}

main();
