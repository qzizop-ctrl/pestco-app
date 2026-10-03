// Deliberately uses the plain Playwright `test`, not ./fixtures.mjs: the second
// test provokes a CSP violation on purpose, which the shared tripwire would
// (correctly) report as a failure.
import { test, expect } from "@playwright/test";

test("the built page ships a strict Content-Security-Policy", async ({ request }) => {
  const html = await (await request.get("/")).text();

  const tag = html.match(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/i)?.[0];
  expect(tag, "CSP <meta> tag in dist/index.html").toBeTruthy();
  const csp = tag.match(/content="([^"]+)"/i)?.[1] ?? "";

  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
});

test("the browser really blocks an injected inline script", async ({ page }) => {
  await page.goto("/");

  const violated = await page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener("securitypolicyviolation", (e) => resolve(e.violatedDirective), {
          once: true,
        });
        const script = document.createElement("script");
        script.textContent = "window.__injected = true";
        document.head.appendChild(script);
        setTimeout(() => resolve("no-violation"), 3000);
      }),
  );

  expect(violated).toMatch(/^script-src/);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
});
