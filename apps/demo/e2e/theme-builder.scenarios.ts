import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

export const themeBuilderScenarios = (getPage: () => Page, appUrl: string) => {
  describe("theme builder", () => {
    it("edits a preset and exports the same CSS as the preview", async () => {
      const page = getPage();
      await page.goto(`${appUrl}/theme`, { waitUntil: "networkidle" });
      const controls = page.getByRole("complementary", { name: "Theme controls" });
      const preview = page.locator('[data-theme-preview="light"]');
      const htmlTheme = await page.locator("html").getAttribute("data-theme");
      await controls.getByRole("button", { name: "Start from Blueprint" }).click();
      await expect
        .poll(() =>
          page.evaluate(
            () => JSON.parse(localStorage.getItem("foldworks-theme-builder-v1")!).preset,
          ),
        )
        .toBe("Blueprint");
      const presetPrimary = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("foldworks-theme-builder-v1")!).baseline.light.primary,
      );
      await expect
        .poll(() =>
          preview.evaluate((el) => getComputedStyle(el).getPropertyValue("--primary").trim()),
        )
        .toBe(presetPrimary);
      await controls.getByRole("textbox", { name: "Primary", exact: true }).fill("#8257d5");
      await controls.getByRole("slider", { name: "Base radius", exact: true }).fill("0.75");
      await expect
        .poll(() => preview.evaluate((el) => el.style.getPropertyValue("--primary")))
        .toBe("#8257d5");
      await expect
        .poll(() => preview.evaluate((el) => el.style.getPropertyValue("--radius")))
        .toBe("0.75rem");
      expect(await page.locator("html").getAttribute("data-theme")).toBe(htmlTheme);
      await page
        .getByRole("group", { name: "Preview mode" })
        .getByRole("button", { name: "Side-by-side", exact: true })
        .click();
      await page.getByRole("button", { name: "Copy theme", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Take your theme with you" });
      await expect.poll(() => dialog.isVisible()).toBe(true);
      const css = await dialog.locator("code").innerText();
      expect(css).toContain("--primary: #8257d5;");
      expect(css).toContain("--radius: 0.75rem;");
      expect(css).toContain('[data-theme="custom"][data-mode="dark"]');
      expect(css).toContain("--foldworks-ui-selection:");
      expect(css).not.toContain("undefined");
      await dialog.getByRole("textbox", { name: "Theme name", exact: true }).fill("Studio Theme!");
      await expect
        .poll(() => dialog.locator("code").innerText())
        .toContain('[data-theme="studio-theme"]');
      // Pasting after the imports reproduces every computed token, in both modes.
      const renamedCss = await dialog.locator("code").innerText();
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await dialog.getByRole("button", { name: "Copy Foldworks CSS", exact: true }).click();
      await expect
        .poll(() => dialog.getByRole("button", { name: "Copied", exact: true }).isVisible())
        .toBe(true);
      expect((await page.evaluate(() => navigator.clipboard.readText())).trimEnd()).toBe(
        renamedCss,
      );
      await page.addStyleTag({ content: renamedCss });
      for (const mode of ["light", "dark"] as const) {
        const mismatches = await page.evaluate(
          ({ mode }) => {
            const preview = document.querySelector(`[data-theme-preview="${mode}"]`) as HTMLElement;
            const pasted = document.createElement("div");
            pasted.dataset.theme = "studio-theme";
            pasted.dataset.mode = mode;
            document.body.append(pasted);
            const a = getComputedStyle(preview),
              b = getComputedStyle(pasted);
            const names = Array.from(preview.style).filter((name) => name.startsWith("--"));
            const differences = names.filter(
              (name) => a.getPropertyValue(name).trim() !== b.getPropertyValue(name).trim(),
            );
            pasted.remove();
            return differences;
          },
          { mode },
        );
        expect(mismatches).toEqual([]);
      }
      await dialog.getByRole("tab", { name: "shadcn / Tailwind v4", exact: true }).click();
      await expect.poll(() => dialog.locator("code").innerText()).toContain("@theme inline");
      await dialog.getByRole("tab", { name: "JSON tokens", exact: true }).click();
      await expect.poll(() => dialog.locator("code").innerText()).toContain('"shape"');
      const json = JSON.parse(await dialog.locator("code").innerText());
      expect(json.light.primary).toBe("#8257d5");
      expect(json.shape.radius.light).toBe("0.75rem");
      await page.keyboard.press("Escape");
      await expect.poll(() => dialog.isVisible()).toBe(false);
      await page.reload({ waitUntil: "networkidle" });
      await expect
        .poll(() => controls.getByRole("textbox", { name: "Primary", exact: true }).inputValue())
        .toBe("#8257d5");
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await expect.poll(() => new URL(page.url()).hash).toMatch(/^#theme=/);
      const shared = page.url();
      await controls.getByRole("textbox", { name: "Primary", exact: true }).fill("#216e56");
      await page.goto(shared, { waitUntil: "networkidle" });
      await page.reload({ waitUntil: "networkidle" });
      await expect
        .poll(() => controls.getByRole("textbox", { name: "Primary", exact: true }).inputValue())
        .toBe("#8257d5");
      await page
        .getByRole("group", { name: "Preview mode" })
        .getByRole("button", { name: "Side-by-side", exact: true })
        .click();
      await expect.poll(() => page.locator("[data-theme-preview]").count()).toBe(2);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  });
};
