import { expect, test } from "@playwright/test";

for (const mode of ["Light", "Dark", "Side-by-side"] as const) {
  test(`theme builder ${mode.toLowerCase()}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/theme", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Start from Blueprint" }).click();
    await page
      .getByRole("group", { name: "Preview mode" })
      .getByRole("button", { name: mode, exact: true })
      .click();
    await expect(page.locator("[data-theme-preview]")).toHaveCount(mode === "Side-by-side" ? 2 : 1);
    await expect(page.locator("[data-theme-builder]")).toHaveScreenshot(
      `theme-${mode.toLowerCase()}.png`,
    );
  });
}
