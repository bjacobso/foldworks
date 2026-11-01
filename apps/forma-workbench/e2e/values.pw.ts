import { expect, test } from "@playwright/test";

test("shows live values and loads a retained collection in the inspector", async ({ page }) => {
  await page.goto("./");
  const program = page.getByRole("tree", { name: "Program" });
  const prices = program.getByRole("treeitem", { name: /^map with-tax/ });
  await expect(prices.getByRole("button", { name: /^Inspect/ })).toContainText("43.3");
  await prices.getByRole("button", { name: /^Inspect/ }).click();
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await expect(inspector).toContainText("List<Float>");
  await inspector.getByRole("treeitem").first().click();
  await expect(inspector.getByRole("treeitem", { name: "0: 43.3" })).toBeVisible();
  await expect(inspector.getByRole("treeitem", { name: "2: 1299" })).toBeVisible();
});
