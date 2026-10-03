// The two export paths that load big libraries lazily (html2canvas + jsPDF for
// the dashboard report, SheetJS for Excel). They are the first things a bundler
// or Content-Security-Policy change would quietly break, because nothing else
// touches those chunks until someone clicks Export.
import { test, expect } from "./fixtures.mjs";
import { resetEmulators, createUser, seedAdmin } from "./emulator.mjs";
import { signIn, addCustomer, clickOrExplain, expectDownload } from "./helpers.mjs";

const ADMIN = { email: "admin@example.test", password: "correct-horse-1" };

test.beforeEach(async ({ page }) => {
  await resetEmulators();
  await createUser(ADMIN);
  await seedAdmin(ADMIN.email);
  await signIn(page, ADMIN);
  await addCustomer(page, `ExportCo-${Date.now()}`);
  await expect(page.getByTestId("new-visit")).toBeVisible();
});

test("the owner can export the dashboard report as a PDF", async ({ page }) => {
  // html2canvas rasterises the report page by page; slow on a CI runner.
  test.setTimeout(150_000);

  await clickOrExplain(page, page.getByTestId("nav-dashboard"));
  const bytes = await expectDownload(page, page.getByTestId("export-pdf"), /\.pdf$/i, 120_000);

  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
});

test("the owner can export the customers to an Excel file", async ({ page }) => {
  await clickOrExplain(page, page.getByTestId("nav-settings"));
  // The customers panel and the suppliers panel each have an "export all"
  // button; either proves the SheetJS chunk loads and writes a workbook.
  const bytes = await expectDownload(page, page.getByTestId("export-all").first(), /\.xlsx$/i);

  // An .xlsx is a zip archive: it starts with "PK".
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
});
