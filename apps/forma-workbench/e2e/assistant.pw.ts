import { expect, test } from "@playwright/test";

test("previews a local structural proposal before accept, discard, and atomic undo", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  const tree = page.getByRole("tree", { name: "Program" });
  const map = tree.getByRole("treeitem", { name: /^map badge/ });
  await map.locator("textarea").click();
  const originalId = await map.getAttribute("data-outline-row");
  await page.getByRole("button", { name: "Propose", exact: true }).click();
  const review = page.getByRole("region", { name: "Wrap selection in do", exact: true });
  await expect(review).toContainText("Local proposer");
  await expect(review.getByRole("region", { name: "Structural diff" })).toBeVisible();
  await expect(review).toContainText("Consequences");
  await expect(tree.getByRole("treeitem", { name: "do", exact: true })).toHaveCount(0);
  await review.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(review).toHaveCount(0);
  await expect(map).toHaveAttribute("data-outline-row", originalId!);
  await page.getByRole("button", { name: "Propose", exact: true }).click();
  await review.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(tree.getByRole("treeitem", { name: "do", exact: true })).toBeVisible();
  await expect(map).toHaveAttribute("data-outline-row", originalId!);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(tree.getByRole("treeitem", { name: "do", exact: true })).toHaveCount(0);
  await expect(map).toHaveAttribute("aria-level", "1");
});
