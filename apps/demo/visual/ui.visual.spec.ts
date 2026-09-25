import { expect, test, type Page } from "@playwright/test";

const fixtures = [
  {
    name: "first-principles-foundations",
    heading: "First-principles foundations",
    catalog: true,
  },
  { name: "stateful-floating-primitives", heading: "Stateful floating primitives", catalog: true },
  { name: "data-display-and-feedback", heading: "Data display and feedback", catalog: true },
  { name: "forms-and-selection", heading: "Forms and selection", catalog: true },
  { name: "navigation", heading: "Navigation", catalog: true },
  { name: "disclosure-and-layout", heading: "Disclosure and layout", catalog: true },
  { name: "overlays-menus-and-command", heading: "Overlays, menus, and command", catalog: true },
  { name: "calendar-and-messages", heading: "Calendar and messages", catalog: true },
  { name: "button", heading: "Button" },
  { name: "badge", heading: "Badge" },
  { name: "icon", heading: "Icon" },
  { name: "field-input-textarea-select", heading: "Field, input, textarea, and select" },
  { name: "selection-controls", heading: "Selection controls" },
  { name: "choice-and-disclosure", heading: "Choice and disclosure" },
  { name: "panel-and-layout", heading: "Panel and Layout" },
  { name: "toolbar", heading: "Toolbar" },
  { name: "semantic-tokens", heading: "Semantic tokens" },
] as const;

type Mode = "Light" | "Dark";

const openCatalog = async (page: Page, mode: Mode): Promise<void> => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/ui-kit", { waitUntil: "networkidle" });
  await page.getByLabel("Theme", { exact: true }).selectOption("Polaris");
  await page.getByLabel("Appearance", { exact: true }).selectOption(mode);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "polaris");
  await expect(page.locator("html")).toHaveAttribute("data-mode", mode.toLowerCase());
};

const fixtureHeading = (page: Page, fixture: (typeof fixtures)[number]) =>
  ("catalog" in fixture ? page.locator('[data-component-catalog="true"]') : page).getByRole(
    "heading",
    { name: fixture.heading, exact: true },
  );

for (const mode of ["Light", "Dark"] as const) {
  test.describe(`Polaris ${mode.toLowerCase()}`, () => {
    test.beforeEach(async ({ page }) => openCatalog(page, mode));

    test("catalog coverage stays explicit", async ({ page }) => {
      for (const fixture of fixtures) {
        await expect(fixtureHeading(page, fixture), fixture.name).toHaveCount(1);
      }
    });

    for (const fixture of fixtures) {
      test(`${fixture.name} matches its approved image`, async ({ page }) => {
        const component = fixtureHeading(page, fixture).locator("xpath=ancestor::section[1]");
        await component.scrollIntoViewIfNeeded();
        await expect(component).toBeVisible();
        await expect(component).toHaveScreenshot([
          `polaris-${mode.toLowerCase()}`,
          `${fixture.name}.png`,
        ]);
      });
    }

    test("open dialog matches its approved image", async ({ page }) => {
      await page.getByRole("button", { name: "Dialog", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Dialog example" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveScreenshot([`polaris-${mode.toLowerCase()}`, "dialog-open.png"]);
    });

    test("open dropdown menu matches its approved image", async ({ page }) => {
      await page.getByRole("button", { name: "Dropdown menu", exact: true }).click();
      const menu = page.getByRole("menu").last();
      await expect(menu).toBeVisible();
      await expect(menu).toHaveScreenshot([
        `polaris-${mode.toLowerCase()}`,
        "dropdown-menu-open.png",
      ]);
    });
  });
}
