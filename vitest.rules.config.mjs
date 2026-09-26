// Separate Vitest config for the Firestore security-rules tests. They talk to
// the Firestore EMULATOR, so they are not part of `npm test` — run them with
//   npm run test:rules
// (see tests/rules/README.md for the one-time setup).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.mjs"],
    // One shared emulator: run files one after another, never in parallel.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
