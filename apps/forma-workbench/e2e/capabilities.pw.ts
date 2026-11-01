import { expect, test } from "@playwright/test";

test("requires approval for read and write calls and shows the completed values", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const lookup = page.getByRole("group", { name: "Permission request for Directory.lookup" });
  await expect(lookup).toContainText('Directory.lookup "ada"');
  await lookup.getByRole("button", { name: "Allow once" }).click();
  const post = page.getByRole("group", { name: "Permission request for Chat.post" });
  await expect(post).toContainText("Welcome, Ada Lovelace!");
  await post.getByRole("button", { name: "Allow once" }).click();
  await expect(page.getByRole("status")).toContainText("Run completed: nil");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await lookup.getByRole("button", { name: "Deny", exact: true }).click();
  await expect(page.getByText(/1 error/)).toBeVisible();
});
