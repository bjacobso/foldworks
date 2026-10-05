import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

export const docsScenarios = (getPage: () => Page, appUrl: string) => {
  describe("generated documentation", () => {
    it("finds exports and navigates public module references", async () => {
      const page = getPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${appUrl}/docs`, { waitUntil: "networkidle" });
      await page.getByRole("textbox", { name: "Search documentation" }).fill("EditableText");
      await expect.poll(() => page.locator(".docs-package-card").count()).toBe(1);
      await page.locator(".docs-package-card").click();
      await page.waitForURL("**/docs?package=ui");
      await page.getByRole("link", { name: "editable-text", exact: true }).click();
      await page.getByRole("heading", { name: "Model schema", exact: true }).waitFor();
      expect(await page.locator(".docs-article").innerText()).toContain(
        'S.Literals(["view", "edit"])',
      );
      await page.reload({ waitUntil: "networkidle" });
      expect(await page.getByRole("heading", { name: "Model schema", exact: true }).count()).toBe(
        1,
      );
      const manifest = await page.request.get(`${appUrl}/docs/manifest.json`);
      expect(manifest.ok()).toBe(true);
      expect((await manifest.json()).some((pkg: { id: string }) => pkg.id === "sidebar")).toBe(
        true,
      );
      expect(errors).toEqual([]);
    });

    it("runs reducer events and validation, then resets the model", async () => {
      const page = getPage();
      await page.goto(`${appUrl}/docs?package=ui`, { waitUntil: "networkidle" });
      await page
        .getByRole("combobox", { name: "Reducer to explore" })
        .selectOption("editable-text");
      await page.getByRole("button", { name: "Started", exact: true }).click();
      await page.getByRole("button", { name: 'Changed("")', exact: true }).click();
      await page.getByRole("button", { name: "Committed", exact: true }).click();
      await page.getByText("Current state: Editing · error", { exact: true }).waitFor();
      expect(await page.getByRole("region", { name: "Current model" }).innerText()).toContain(
        "A value is required.",
      );
      await page.getByRole("button", { name: "Reset", exact: true }).click();
      await page.getByText("Current state: Viewing", { exact: true }).waitFor();
      await page.getByRole("link", { name: "sidebar", exact: true }).click();
      await page.getByRole("button", { name: "ToggledCollapsed", exact: true }).click();
      await page.getByText("Current state: Collapsed · Mobile closed", { exact: true }).waitFor();
      expect(await page.getByRole("img", { name: /Sidebar state machine/ }).count()).toBe(1);
    });

    it("handles missing deep links and fits a mobile viewport", async () => {
      const page = getPage();
      await page.goto(`${appUrl}/docs?package=missing`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Package not found", exact: true }).waitFor();
      await page.goto(`${appUrl}/docs?package=sidebar&module=missing`, {
        waitUntil: "networkidle",
      });
      await page.getByRole("heading", { name: "Module not found", exact: true }).waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${appUrl}/docs?package=sidebar`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "State machine explorer", exact: true }).waitFor();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    });
  });
};
