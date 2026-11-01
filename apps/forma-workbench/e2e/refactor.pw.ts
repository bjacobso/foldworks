import { expect, test } from "@playwright/test";

test("renames all bound uses as one undoable structural edit", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  const tree = page.getByRole("tree", { name: "Program" });
  await tree
    .getByRole("treeitem", { name: /^define tax-rate/ })
    .locator("textarea")
    .click();
  await page.getByRole("textbox", { name: "Refactoring name or wrapper" }).fill("sales-tax");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(tree.getByRole("treeitem", { name: /^define sales-tax/ })).toBeVisible();
  await expect(
    tree.getByRole("treeitem", { name: /^let \[tax \(\* amount sales-tax/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(tree.getByRole("treeitem", { name: /^define tax-rate/ })).toBeVisible();
  await expect(
    tree.getByRole("treeitem", { name: /^let \[tax \(\* amount tax-rate/ }),
  ).toBeVisible();
});
