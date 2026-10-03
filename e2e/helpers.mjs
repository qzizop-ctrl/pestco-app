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
