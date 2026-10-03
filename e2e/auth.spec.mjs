import { test, expect } from "./fixtures.mjs";
import { resetEmulators, createUser, seedAdmin, verifyEmail, listSignupEmails } from "./emulator.mjs";
import { openApp, signIn, register, authMessage } from "./helpers.mjs";

const ADMIN = { email: "admin@example.test", password: "correct-horse-1" };

test.beforeEach(async () => {
  await resetEmulators();
  await createUser(ADMIN);
  await seedAdmin(ADMIN.email);
});

test("a signed-out visitor gets the sign-in form", async ({ page }) => {
  await openApp(page);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('form button[type="submit"]')).toBeVisible();
});

test("a wrong password is rejected with a message and no access", async ({ page }) => {
  await signIn(page, { email: ADMIN.email, password: "not-the-password" });
  await expect(authMessage(page)).toBeVisible();
  // Still on the sign-in form, nothing of the app behind it.
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.getByTestId("new-visit")).toHaveCount(0);
});

test("a new account must verify its email and then wait for an admin's approval", async ({ page }) => {
  const newcomer = { email: "newhire@example.test", password: "another-pass-9" };

  // 1. Sign up: told to check the email, signed back out, back on the form.
  await register(page, newcomer);
  await expect(authMessage(page)).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();

  // 2. Click the link in the (emulated) verification email, then sign in.
  await verifyEmail(newcomer.email);
  await signIn(page, newcomer);

  // 3. Verified but not approved: no access, bounced back to the sign-in form...
  await expect(authMessage(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("new-visit")).toHaveCount(0);

  // 4. ...and the request has reached the admin's pending-signups list (this
  //    write is allowed by the real Firestore rules only for a verified email).
  await expect.poll(() => listSignupEmails(), { timeout: 15_000 }).toContain(newcomer.email);
});
