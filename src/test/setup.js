// Registers jest-dom's matchers (toBeInTheDocument, toHaveTextContent, ...)
// on Vitest's `expect`, so component tests can assert against rendered DOM
// output without hand-rolling those checks. Wired in via
// vite.config.js#test.setupFiles — runs once before the whole suite, not
// per file, so individual test files don't need to import this themselves.
import "@testing-library/jest-dom/vitest";
