// Shared `test` for every spec: same API as @playwright/test, plus three things
// every test here wants.
//
//  1. Hermetic network. The app probes https://www.gstatic.com/generate_204 to
//     decide whether it is online (useAppPrefs.js) and blocks every save when it
//     thinks it is not, and index.html loads Google Fonts. Both are answered
//     locally, so a test never depends on the internet. The CSP is checked by
//     the browser BEFORE a request leaves, so these stubs do not weaken the CSP
//     checks below: a request the policy forbids never reaches the stub.
//
//  2. No weekly-backup prompt in the way. The workspace owner is asked once a
//     week "save a backup now?" (src/hooks/useAutoBackup.js) in a full-screen
//     dialog, and a brand-new browser has never made a backup, so without this
//     every owner test would find that dialog covering the buttons it wants to
//     click. It is switched off by pre-setting the "last backup" timestamp; the
//     one test that is about the prompt turns it back on with
//     `test.use({ seedBackupTimestamp: false })`.
//
//  3. A CSP tripwire. If the browser logs a Content-Security-Policy violation at
//     any point during a test, the test fails. This is what proves the policy in
//     scripts/buildCsp.mjs does not break a real sign-in / save flow.
import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  seedBackupTimestamp: [true, { option: true }],

  page: async ({ page, seedBackupTimestamp }, use, testInfo) => {
    const violations = [];
    const consoleLog = [];
    page.on("pageerror", (error) => consoleLog.push(`[pageerror] ${error.message}`));
    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error" || msg.type() === "warning") consoleLog.push(`[${msg.type()}] ${text}`);
      if (/content security policy|refused to (load|connect|execute|apply|frame)/i.test(text)) {
        violations.push(text);
      }
    });

    if (seedBackupTimestamp) {
      // Same key as STORAGE_KEY in src/hooks/useAutoBackup.js.
      await page.addInitScript(() => {
        try {
          localStorage.setItem("pestco_last_auto_backup", String(Date.now()));
        } catch {
          // localStorage unavailable — nothing to seed.
        }
      });
    }

    await page.route("https://www.gstatic.com/generate_204", (route) =>
      route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } }),
    );
    await page.route("https://fonts.googleapis.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/css", body: "/* stubbed for e2e */" }),
    );

    await use(page);

    // Attached to the report even when the test passes; open it first when a
    // test fails and the cause is not obvious.
    if (consoleLog.length > 0) {
      await testInfo.attach("browser-console.txt", { body: consoleLog.join("\n"), contentType: "text/plain" });
    }

    expect(violations, "Content-Security-Policy violations seen by the browser").toEqual([]);
  },
});

export { expect };
