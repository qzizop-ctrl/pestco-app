import { expect } from "@playwright/test";
import { listVisitCompanyNames } from "./emulator.mjs";
import { consoleLogs } from "./fixtures.mjs";

// UI helpers. Selectors avoid on-screen text on purpose — the app is bilingual
// (Arabic/English), so tests rely on input types, form structure and the
// data-testid hooks added to the few buttons that have no stable alternative.

export async function openApp(page) {
  await page.goto("/");
  await page.locator('input[type="email"]').waitFor();
}

export async function signIn(page, { email, password }) {
  await openApp(page);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
}

export async function register(page, { email, password }) {
  await openApp(page);
  await page.getByTestId("auth-tab-register").click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
}

// The message line (error or info) that AuthScreen renders inside its form.
export function authMessage(page) {
  return page.locator("form p");
}

// Signing out makes the app call window.location.reload() (see
// signOutAndClearLocalData in src/firebase.js). A page.goto() fired while that
// reload is still in flight is aborted (net::ERR_ABORTED), so wait for the
// reload to finish before the test does anything else.
export async function signOut(page) {
  const reloaded = page.waitForEvent("domcontentloaded");
  await page.getByTestId("sign-out").click();
  await reloaded;
  await page.locator('input[type="email"]').waitFor();
}

// Click that explains itself. The app shows its own errors/alerts in a modal
// <dialog> that covers the whole screen; when one pops up, a plain click just
// times out with "<button> intercepts pointer events", which hides WHY. This
// fails fast instead and puts the dialog's text in the error message.
export async function clickOrExplain(page, locator) {
  try {
    await locator.click({ timeout: 10_000 });
  } catch (error) {
    const dialogs = await page.locator("dialog[open]").allInnerTexts();
    if (dialogs.length > 0) {
      throw new Error(`Click blocked by an in-app dialog: ${JSON.stringify(dialogs)}`, { cause: error });
    }
    throw error;
  }
}

// Waits until the customer is really in Firestore, and if it never gets there,
// says what the app told the user (a rejected write pops an in-app dialog).
export async function expectSavedOnServer(page, ownerUid, company) {
  try {
    await expect
      .poll(() => listVisitCompanyNames(ownerUid), { timeout: 20_000, message: `"${company}" in Firestore` })
      .toContain(company);
  } catch (error) {
    const dialogs = await page.locator("dialog[open]").allInnerTexts();
    const shown = dialogs.length > 0 ? ` The app was showing: ${JSON.stringify(dialogs)}` : " The app showed no error dialog.";
    throw new Error(`The customer never reached Firestore.${shown}`, { cause: error });
  }
}

// expect(text).toBeVisible(), but when it is not, say what IS on screen instead
// of a bare "element(s) not found": is the sign-in form showing (session lost)?
// is a dialog open? what does the page say? what did the browser log?
export async function expectVisibleOrExplain(page, text) {
  try {
    await expect(page.getByText(text).first()).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    const signedOut = (await page.locator('input[type="email"]').count()) > 0;
    const dialogs = await page.locator("dialog[open]").allInnerTexts();
    const visibleText = (await page.locator("body").innerText()).replaceAll(/\s+/g, " ").slice(0, 600);
    const recentLog = (consoleLogs.get(page) ?? []).slice(-8);
    throw new Error(
      [
        `"${text}" is not on screen.`,
        `URL: ${page.url()}`,
        `Sign-in form showing (session lost?): ${signedOut}`,
        `In-app dialogs: ${JSON.stringify(dialogs)}`,
        `Visible text: ${visibleText}`,
        `Recent browser errors/warnings: ${JSON.stringify(recentLog)}`,
      ].join("\n"),
      { cause: error },
    );
  }
}
