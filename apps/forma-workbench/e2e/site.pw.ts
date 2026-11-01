import { expect, test } from "@playwright/test";

test("opens the workbench from Foldworks and reloads a project at its deployed path", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("link", { name: "Forma workbench", exact: true }).click();
  await expect(page).toHaveURL(/\/forma\/$/);
  await expect(page).toHaveTitle("Forma workbench");
  await expect(page.getByRole("combobox", { name: "Example project" })).toBeVisible();
  await expect(page.locator(".workbench-site-header")).toHaveCSS("display", "flex");
  await expect(page.getByRole("link", { name: "Foldworks", exact: true })).toHaveAttribute(
    "href",
    "/",
  );

  await page.goto("./?project=modules");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Example project" })).toHaveValue("modules");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  expect(errors).toEqual([]);
});
