#!/usr/bin/env node
// ============================================================================
// xlsx (SheetJS) is installed straight from a CDN .tgz URL, not the npm
// registry (see package.json + the comment in .github/dependabot.yml) —
// that's SheetJS's own recommended install method, since they stopped
// publishing full builds to npm. The downside: npm's normal lockfile
// integrity check (the "integrity": "sha512-..." field package-lock.json
// writes for every other dependency) does not get generated for a plain
// URL dependency the same automatic way, so nothing currently notices if
// cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz were ever swapped out to
// something else *without* the version number in the URL changing.
//
// This script hashes the installed package's actual JS entry points and
// writes the result to xlsx-integrity.json, which the sibling
// verify-xlsx-integrity.cjs script checks on every `npm install` (see the
// "postinstall" script in package.json) and in CI. Run this once now,
// after `npm install`, with a network connection, and commit the
// resulting xlsx-integrity.json — after that, verify-xlsx-integrity.cjs
// will catch it automatically if a future install ever pulls down
// different bytes for the exact same pinned version.
//
// Re-run this deliberately (and re-commit the file) whenever package.json
// is updated to point at a new xlsx version.
// ============================================================================
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const XLSX_DIR = path.join(__dirname, "..", "node_modules", "xlsx");
// The files that actually ship the library's logic — not package.json or
// README, which can change across a republish of the same version without
// the code itself changing.
const FILES_TO_HASH = ["xlsx.mjs", "xlsx.js", "dist/xlsx.full.min.js"];

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function main() {
  if (!fs.existsSync(XLSX_DIR)) {
    console.error("node_modules/xlsx not found — run `npm install` first.");
    process.exit(1);
  }

  const pkgJson = JSON.parse(fs.readFileSync(path.join(XLSX_DIR, "package.json"), "utf8"));
  const hashes = {};
  for (const rel of FILES_TO_HASH) {
    const full = path.join(XLSX_DIR, rel);
    if (fs.existsSync(full)) {
      hashes[rel] = sha256File(full);
    }
  }

  if (Object.keys(hashes).length === 0) {
    console.error("None of the expected xlsx files were found — SheetJS may have changed their package layout. Update FILES_TO_HASH in this script.");
    process.exit(1);
  }

  const outPath = path.join(__dirname, "..", "xlsx-integrity.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify({ version: pkgJson.version, sha256: hashes }, null, 2) + "\n"
  );
  console.log(`Wrote ${outPath} for xlsx@${pkgJson.version}. Review and commit it.`);
}

main();
