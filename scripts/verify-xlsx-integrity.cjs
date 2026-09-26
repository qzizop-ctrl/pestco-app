#!/usr/bin/env node
// ============================================================================
// Checks the installed node_modules/xlsx against the checksums pinned in
// xlsx-integrity.json (see pin-xlsx-integrity.cjs for how that file gets
// created/updated). Runs automatically as this project's "postinstall"
// script, and again explicitly in CI (see .github/workflows/*.yml) right
// after `npm install`.
//
// Exists because xlsx is installed from a CDN .tgz URL rather than the
// npm registry (see the comment at the top of pin-xlsx-integrity.cjs) —
// this is the substitute for the lockfile-integrity check every other
// (registry-installed) dependency already gets for free.
//
// If xlsx-integrity.json doesn't exist yet, this warns instead of
// failing — it means nobody has run `npm run xlsx:pin` yet, which is a
// one-time, network-required, human step (see README). It should exist
// before shipping a release build, but its absence shouldn't block a
// fresh `npm install` in a new environment that just hasn't been pinned
// yet.
// ============================================================================
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const XLSX_DIR = path.join(__dirname, "..", "node_modules", "xlsx");
const INTEGRITY_FILE = path.join(__dirname, "..", "xlsx-integrity.json");

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function main() {
  if (!fs.existsSync(XLSX_DIR)) {
    // xlsx isn't installed at all (e.g. a partial/offline install) — not
    // this script's job to complain about that.
    return;
  }

  if (!fs.existsSync(INTEGRITY_FILE)) {
    console.warn(
      "\n[verify-xlsx-integrity] xlsx-integrity.json not found — xlsx's " +
      "checksum has never been pinned in this checkout. Run " +
      "`npm run xlsx:pin` (with network access) and commit the result. " +
      "Skipping the check for now.\n"
    );
    return;
  }

  const pinned = JSON.parse(fs.readFileSync(INTEGRITY_FILE, "utf8"));
  const installedPkgJson = JSON.parse(
    fs.readFileSync(path.join(XLSX_DIR, "package.json"), "utf8")
  );

  if (installedPkgJson.version !== pinned.version) {
    console.warn(
      `\n[verify-xlsx-integrity] Installed xlsx is v${installedPkgJson.version} but ` +
      `xlsx-integrity.json was pinned against v${pinned.version}. This is expected ` +
      "right after deliberately bumping the xlsx version in package.json — " +
      "run `npm run xlsx:pin` again and commit the updated file. Skipping " +
      "the byte-for-byte check since it wouldn't be a fair comparison.\n"
    );
    return;
  }

  let mismatch = false;
  for (const [rel, expectedHash] of Object.entries(pinned.sha256)) {
    const full = path.join(XLSX_DIR, rel);
    if (!fs.existsSync(full)) {
      console.error(`[verify-xlsx-integrity] Expected file missing: node_modules/xlsx/${rel}`);
      mismatch = true;
      continue;
    }
    const actualHash = sha256File(full);
    if (actualHash !== expectedHash) {
      console.error(
        `[verify-xlsx-integrity] CHECKSUM MISMATCH for node_modules/xlsx/${rel}\n` +
        `  expected: ${expectedHash}\n` +
        `  actual:   ${actualHash}\n` +
        "  The installed xlsx contents don't match what was pinned for this " +
        "exact version. Do not proceed without confirming why — the CDN tarball " +
        "for this version may have changed, or something else is wrong."
      );
      mismatch = true;
    }
  }

  if (mismatch) {
    process.exit(1);
  }
  console.log(`[verify-xlsx-integrity] OK — xlsx@${installedPkgJson.version} matches the pinned checksum.`);
}

main();
