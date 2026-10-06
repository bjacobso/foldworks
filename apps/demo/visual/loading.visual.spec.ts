import { expect, test } from "@playwright/test";

test("loading feedback sizes placeholders and respects reduced motion", async ({ page }) => {
  await page.goto("/ui-kit", { waitUntil: "networkidle" });
  const loader = page.getByRole("status", { name: "Syncing account", exact: true });
  const spinner = loader.locator('[aria-hidden="true"]');
  const placeholder = page.getByRole("status", { name: "Loading profile card", exact: true });
  const skeletons = placeholder.locator('[aria-hidden="true"] > div');
  const circle = skeletons.first().locator("> div").first();

  await expect(loader).toHaveText("Syncing account");
  await expect(spinner).toHaveCSS("width", "24px");
  await expect(spinner).toHaveCSS("height", "24px");
  await expect(spinner).toHaveCSS("animation-name", "none");
  await expect(circle).toHaveCSS("width", "40px");
  await expect(circle).toHaveCSS("height", "40px");
  await expect(circle).toHaveCSS("animation-name", "none");
  await expect(skeletons.last()).toHaveCSS("height", "64px");
  await expect(skeletons.last()).toHaveCSS("margin-top", "12px");
  const textLines = skeletons.first().locator("> div").last().locator("> div");
  await expect(textLines).toHaveCount(2);
  expect(
    await textLines.first().evaluate((element) => element.getBoundingClientRect().width),
  ).toBeGreaterThan(100);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(spinner).not.toHaveCSS("animation-name", "none");
  await expect(circle).not.toHaveCSS("animation-name", "none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(spinner).toHaveCSS("animation-name", "none");
  await expect(circle).toHaveCSS("animation-name", "none");
});
