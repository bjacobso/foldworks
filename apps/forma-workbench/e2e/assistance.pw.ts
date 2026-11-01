import { expect, test } from "@playwright/test";

test("shows typed keyboard hover, scoped completion, and descriptor placeholders", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  const tree = page.getByRole("tree", { name: "Program" });
  const map = tree.getByRole("treeitem", { name: /^map with-tax/ });
  await map.locator("textarea").click();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Control+Shift+Space");
  await expect(page.getByRole("tooltip")).toContainText("map");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Space");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  const activate = tree.getByRole("treeitem", { name: /^step activate/ });
  const id = await activate.getAttribute("data-outline-row");
  await tree
    .locator(`[data-outline-placeholder="doc"][data-parent="${id}"]`)
    .getByRole("button", { name: "Add doc" })
    .click();
  const optionInput = activate.locator("textarea");
  await expect(optionInput).toHaveValue(
    'step activate :system "Okta" :reads [:check :i9 :payroll] :doc ',
  );
  await expect(optionInput).toBeFocused();
  await page.keyboard.insertText('"Activate the new hire"');
  await expect(activate.locator("textarea")).toHaveValue(
    'step activate :system "Okta" :reads [:check :i9 :payroll] :doc "Activate the new hire"',
  );
  await expect(page.getByText(/0 errors/)).toBeVisible();
  await page.getByRole("button", { name: "Brackets", exact: true }).click();
  await expect(map.locator(".fw-outliner__handle")).toContainText("(");
});
