// ============================================================================
// ESLint flat config. Named .mjs (not .js) so it's always loaded as ESM,
// regardless of package.json's "type" field — electron.js and the
// scripts/*.cjs files in this project are plain CommonJS, so we don't set
// "type": "module" project-wide.
//
// Run with:  npm run lint        (report only)
//            npm run lint:fix    (auto-fix what's safe to auto-fix)
// ============================================================================

import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    // Build output, native project folders, and vendored/generated code —
    // never lint these.
    ignores: [
      "dist/**",
      "release/**",
      "android/**",
      "node_modules/**",
      "src-tauri/**",
      // TypeScript — this project has no @typescript-eslint parser
      // configured (everything else here is plain JS/JSX), so ESLint's
      // default parser can't read the `import type`/type-annotation
      // syntax in this file and fails with a parsing error. It's a
      // static declarative config object with nothing for a linter to
      // usefully check anyway.
      "capacitor.config.ts",
    ],
  },

  js.configs.recommended,

  // --- App source: browser code bundled by Vite (ESM, JSX) ---------------
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: { react: { version: "18.3" } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // This codebase always imports React explicitly, and JSX runtime
      // detection isn't configured here, so keep the classic rule off
      // rather than risk false positives either way.
      "react/react-in-jsx-scope": "off",
      // No prop-types package is used in this project (plain JS, not TS).
      "react/prop-types": "off",

      // Flag unused vars/imports (this is the #1 thing a linter would
      // have caught on the recent Dashboard.jsx build failure) but don't
      // hard-fail on an intentionally-ignored arg/var prefixed with "_".
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // --- Vite/PostCSS/Tailwind config files: ESM, run under Node ------------
  {
    files: [
      "vite.config.js",
      "tailwind.config.js",
      "postcss.config.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // --- Electron main process + build scripts: plain CommonJS --------------
  {
    files: ["electron.js", "scripts/**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },

  // --- Test files: same as app source, Vitest APIs are imported explicitly
  {
    files: ["src/**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // --- Prettier integration: turn off ESLint stylistic rules that would
  // otherwise conflict with Prettier's own formatting. Must stay last so
  // it overrides everything above it.
  prettierConfig,
];
