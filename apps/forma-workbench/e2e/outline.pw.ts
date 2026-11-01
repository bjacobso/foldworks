import { expect, test } from "@playwright/test";

test("reads the program as an outline of forms", async ({ page }) => {
  await page.goto("./");
  const tree = page.getByRole("tree", { name: "Program" });
  await expect(tree.getByRole("treeitem").first()).toBeVisible();
  // A list's leading elements are a row's text and the rest are its children.
  const definition = tree.getByRole("treeitem", { name: /^define with-tax \[amount\]/ });
  await expect(definition).toBeVisible();
  await expect(tree.getByRole("treeitem", { name: /^let \[tax/ })).toBeVisible();
  // Comments are rows too.
  await expect(tree.getByRole("treeitem", { name: /^; Pricing/ })).toBeVisible();
});
