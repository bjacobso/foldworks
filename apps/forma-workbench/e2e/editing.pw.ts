import { expect, test, type Page } from "@playwright/test";

const tree = (page: Page) => page.getByRole("tree", { name: "Program" });
const row = (page: Page, name: RegExp) => tree(page).getByRole("treeitem", { name });

test("analyzes the program and marks problems where they were written", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText(/14 forms · 0 errors · 2 warnings/)).toBeVisible();
  // The workflow runs steps before the step that writes what they read.
  const steps = tree(page).locator('[data-tone="warning"]');
  await expect(steps).toHaveCount(2);
  await expect(steps.first()).toHaveAttribute("aria-label", /^use background-check/);
});

test("analyzes each edit and underlines the new type error", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  const call = row(page, /^map badge/);
  await call.locator("textarea").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(' "x"]');
  await expect(call).toHaveAttribute("data-tone", "error");
  await expect(page.getByText(/1 error ·/)).toBeVisible();
  // The underline marks the element of the wrong type, once the edit's analysis lands.
  await expect
    .poll(async () => (await call.locator(".fw-text-diagnostic").allTextContents()).join(""))
    .toBe('"x"');
  // Fixing it clears the error.
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  for (let count = 0; count < 4; count += 1) await page.keyboard.press("Backspace");
  await expect(call).toHaveAttribute("aria-label", "map badge [1 3 7]");
  await expect(call).not.toHaveAttribute("data-tone", "error");
  await expect(page.getByText(/0 errors/)).toBeVisible();
});

test("keeps analyzing the rest of the program while a row does not read", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  const call = row(page, /^map badge/);
  await call.locator("textarea").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Backspace");
  await expect(call).toHaveAttribute("data-tone", "error");
  await expect(page.getByText(/13 forms · 1 error · 2 warnings/)).toBeVisible();
});

test("keeps the caret in a row with slot placeholders while each keystroke is analyzed", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  const step = row(page, /^step activate/);
  const input = step.locator("textarea");
  await input.click();
  await page.keyboard.press("End");
  await page.keyboard.type(' :doc "Ready"', { delay: 150 });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(
    'step activate :system "Okta" :reads [:check :i9 :payroll] :doc "Ready"',
  );
  await expect(page.locator("[data-workbench]")).toHaveAttribute("data-analyzed", "true");
  await expect(page.getByText(/0 errors/)).toBeVisible();
});
