import { test, expect } from "./fixtures.mjs";
import { resetEmulators, createUser, seedAdmin, grantAccess } from "./emulator.mjs";
import { signIn, signOut, clickOrExplain } from "./helpers.mjs";

const ADMIN = { email: "admin@example.test", password: "correct-horse-1" };
const EDITOR = { email: "editor@example.test", password: "editor-pass-42" };

let adminUid;

test.beforeEach(async () => {
  await resetEmulators();
  adminUid = await createUser(ADMIN);
  await seedAdmin(ADMIN.email);
});

// Fills the new-customer form with the minimum the app requires (company,
// contact, sector) plus a phone number — without one the app asks "save without
// a phone?" first, which is a different flow.
async function addCustomer(page, company) {
  await clickOrExplain(page, page.getByTestId("new-visit"));
  await page.locator("#cf-companyName").fill(company);
  await page.locator("#cf-contactName").fill("Test Contact");
  await page.locator("#cf-sector").selectOption({ index: 1 });
  await page.locator("#cf-phone").fill("01012345678");
  await clickOrExplain(page, page.getByTestId("save-customer"));
}

test("admin adds a customer, it survives a reload, and sign-out returns to the sign-in form", async ({ page }) => {
  const company = `Acme-${Date.now()}`;

  await signIn(page, ADMIN);
  await expect(page.getByTestId("new-visit")).toBeVisible();

  await addCustomer(page, company);
  await expect(page.getByText(company).first()).toBeVisible();

  // Stored in Firestore (not just on screen), and the session outlives a reload.
  await page.reload();
  await expect(page.getByText(company).first()).toBeVisible();

  await signOut(page);
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test("an editor granted access can add a customer, and the owner then sees it", async ({ page }) => {
  const company = `EditorCo-${Date.now()}`;
  await createUser(EDITOR);
  await grantAccess({ ownerUid: adminUid, memberEmail: EDITOR.email, role: "editor" });

  // The editor's write goes through the real security rules (editors may only
  // create records that carry a pending-review marker — see firestore.rules).
  await signIn(page, EDITOR);
  await expect(page.getByTestId("new-visit")).toBeVisible();
  await addCustomer(page, company);
  await expect(page.getByText(company).first()).toBeVisible();

  await signOut(page);
  await expect(page.locator('input[type="email"]')).toBeVisible();

  await signIn(page, ADMIN);
  await expect(page.getByText(company).first()).toBeVisible();
});
