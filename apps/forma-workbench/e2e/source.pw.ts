import { expect, test } from "@playwright/test";

test("switches between outline and source without losing comments, layout, or ids", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  const tree = page.getByRole("tree", { name: "Program" });
  const definition = tree.getByRole("treeitem", { name: /^define tax-rate/ });
  const id = await definition.getAttribute("data-outline-row");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  const source = page.getByRole("textbox", { name: "Forma source", exact: true });
  const original = await source.inputValue();
  expect(original).toContain("; The amount plus sales tax, rounded to cents.");
  await source.fill(original.replace("0.0825", "0.09"));
  await expect(page.getByText(/0 errors/)).toBeVisible();
  // Wait for the shared analysis to adopt the edit before switching surfaces.
  await expect(source).toHaveValue(/0\.09/);
  await expect(page.locator("[data-workbench]")).toHaveAttribute("data-source-dirty", "false");
  await page.getByRole("button", { name: "Back to outline", exact: true }).click();
  await expect(tree.getByRole("treeitem", { name: /^define tax-rate 0.09/ })).toHaveAttribute(
    "data-outline-row",
    id!,
  );
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(source).toHaveValue(original.replace("0.0825", "0.09"));
  await source.fill(original.slice(0, -2));
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Back to outline", exact: true }).click();
  await expect(tree.getByRole("treeitem", { name: /^define tax-rate 0.09/ })).toBeVisible();
  await definition.locator("textarea").click();
  await page.keyboard.press("Control+z");
  await expect(tree.getByRole("treeitem", { name: /^define tax-rate 0.0825/ })).toBeVisible();
});
