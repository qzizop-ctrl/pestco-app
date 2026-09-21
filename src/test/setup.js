// Registers jest-dom's matchers (toBeInTheDocument, toHaveTextContent, ...)
// on Vitest's `expect`, so component tests can assert against rendered DOM
// output without hand-rolling those checks. Wired in via
// vite.config.js#test.setupFiles — runs once before the whole suite, not
// per file, so individual test files don't need to import this themselves.
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library normally unmounts + wipes the DOM after each test
// on its own, but that auto-cleanup only kicks in when it detects a
// GLOBAL `afterEach` function (see its source: `typeof afterEach ===
// "function"`). This project deliberately doesn't set `test.globals: true`
// in vite.config.js — every existing test file imports `describe`/`it`/
// `expect` from "vitest" explicitly instead of relying on globals — so
// `afterEach` is never global here, and RTL's auto-cleanup silently never
// registers. Without this, a later test in the same file can "see" DOM
// left behind by an earlier render() in that file and pass/fail for the
// wrong reason (this is exactly what broke
// SummaryCard.test.jsx's "omits the delta row..." case: it found
// t.dashNoComparisonData left over from the *previous* test's render,
// not its own). Registering cleanup here explicitly, once, fixes every
// component test file at once.
afterEach(() => {
  cleanup();
});
