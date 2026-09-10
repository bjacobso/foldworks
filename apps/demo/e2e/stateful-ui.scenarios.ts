import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

export const statefulUiScenarios = (getPage: () => Page, appUrl: string, screenshot: (name: string) => Promise<void>) => {
  describe("stateful UI", () => {
    const start = async () => {
      const page = getPage();
      await page.goto(`${appUrl}/ui-kit`, { waitUntil: "networkidle" });
      return page;
    };

    it("moves tab focus and selection with arrow keys, Home, and End", async () => {
      const page = await start();
      const tabs = page.getByRole("tablist", { name: "Account views" });
      await tabs.getByRole("tab", { name: "Overview" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => tabs.getByRole("tab", { name: "Details" }).getAttribute("aria-selected")).toBe("true");
      expect(await page.locator(":focus").textContent()).toBe("Details");
      expect(await page.getByRole("tabpanel", { name: "Details" }).textContent()).toBe("Account details");
      await page.keyboard.press("End");
      await expect.poll(() => page.locator(":focus").textContent()).toBe("Activity");
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => page.locator(":focus").textContent()).toBe("Overview");
      await page.keyboard.press("End");
      await page.keyboard.press("Home");
      await expect.poll(() => tabs.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("true");
    });

    it("searches and selects commands entirely from the keyboard", async () => {
      const page = await start();
      const input = page.getByRole("combobox", { name: "Workspace commands" });
      await input.focus();
      await page.keyboard.press("ArrowDown");
      await expect.poll(() => input.getAttribute("aria-activedescendant")).toBe("catalog-command-item-settings");
      expect(await input.evaluate((element) => element === document.activeElement)).toBe(true);
      await input.fill("prfrncs");
      await expect.poll(() => page.getByRole("option", { name: "Open settings" }).isVisible()).toBe(true);
      await page.keyboard.press("Enter");
      await expect.poll(() => page.locator('[data-ui-kit] [aria-live="polite"]').first().textContent()).toBe("settings command selected.");
      expect(await input.inputValue()).toBe("prfrncs");
      await input.fill("no matching command");
      await expect.poll(() => page.getByRole("status").allTextContents()).toContain("No results found.");
      expect(await input.getAttribute("aria-activedescendant")).toBeNull();
    });

    it("publishes integration and capability documentation as Markdown", async () => {
      const page = getPage();
      for (const path of ["/llms.txt", "/docs/ui/stateful.md", "/docs/ui/capabilities.md"]) {
        const response = await page.request.get(`${appUrl}${path}`);
        expect(response.ok()).toBe(true);
        const body = await response.text();
        expect(body.startsWith("# ")).toBe(true);
        expect(body).toContain("Stateful");
      }
    });

    it("selects with typeahead, skips disabled options, closes, and restores focus", async () => {
      const page = await start();
      const trigger = page.getByRole("button", { name: "Custom department select" });
      await trigger.focus();
      await page.keyboard.press("ArrowDown");
      const listbox = page.getByRole("listbox", { name: "Custom department select" });
      await expect.poll(() => listbox.isVisible()).toBe(true);
      await expect.poll(() => listbox.evaluate((element) => element === document.activeElement)).toBe(true);
      await page.keyboard.press("Home");
      await expect.poll(() => listbox.getAttribute("aria-activedescendant")).toBe("catalog-select-item-0");
      await page.keyboard.press("ArrowDown");
      await expect.poll(() => listbox.getAttribute("aria-activedescendant")).toBe("catalog-select-item-2");
      expect(await listbox.getByRole("option", { name: "Operations" }).getAttribute("aria-disabled")).toBe("true");
      await page.keyboard.type("eng");
      await expect.poll(() => listbox.getAttribute("aria-activedescendant")).toBe("catalog-select-item-0");
      await page.keyboard.press("Enter");
      await expect.poll(() => listbox.isVisible()).toBe(false);
      await expect.poll(() => trigger.textContent()).toContain("Engineering");
      await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
      expect(await page.locator('input[name="department"]').inputValue()).toBe("Engineering");
      await trigger.click();
      await expect.poll(() => listbox.isVisible()).toBe(true);
      await page.keyboard.press("Escape");
      await expect.poll(() => listbox.isVisible()).toBe(false);
      await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
    });

    it("traps dialog focus, restores the trigger, and honors custom surface colors", async () => {
      const page = await start();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.evaluate(() => {
        document.documentElement.style.setProperty("--popover", "rgb(20, 30, 40)");
        document.documentElement.style.setProperty("--popover-foreground", "rgb(230, 240, 250)");
      });
      const trigger = page.getByRole("button", { name: "Dialog", exact: true });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Dialog example", exact: true });
      const input = dialog.getByRole("textbox", { name: "Display name" });
      await expect.poll(() => input.evaluate((element) => element === document.activeElement)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
      expect(await page.locator("#catalog-dialog-panel").evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        foreground: getComputedStyle(element).color,
      }))).toEqual({ background: "rgb(20, 30, 40)", foreground: "rgb(230, 240, 250)" });
      expect(await input.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(230, 240, 250)");
      await page.keyboard.press("Shift+Tab");
      await expect.poll(() => dialog.getByRole("button", { name: "Close" }).evaluate((element) => element === document.activeElement)).toBe(true);
      await page.keyboard.press("Tab");
      await expect.poll(() => input.evaluate((element) => element === document.activeElement)).toBe(true);
      await input.fill("Updated profile");
      await screenshot("stateful-dialog");
      await page.keyboard.press("Escape");
      await expect.poll(() => dialog.isVisible()).toBe(false);
      await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe("hidden");
      await trigger.click();
      await expect.poll(() => input.inputValue()).toBe("Updated profile");
      await dialog.getByRole("button", { name: "Close" }).click();
      await expect.poll(() => dialog.isVisible()).toBe(false);
      expect(errors).toEqual([]);
    });

    it("closes with reduced motion and releases dialog resources when navigating away", async () => {
      const page = await start();
      await page.emulateMedia({ reducedMotion: "reduce" });
      const trigger = page.getByRole("button", { name: "Dialog", exact: true });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Dialog example", exact: true });
      await expect.poll(() => dialog.isVisible()).toBe(true);
      await dialog.getByRole("button", { name: "Close" }).click();
      await expect.poll(() => dialog.isVisible()).toBe(false);
      await trigger.click();
      await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
      // Drive the application's client router while the dialog subtree is mounted.
      await page.getByRole("link", { name: "Data grid", exact: true }).evaluate((element) => (element as HTMLAnchorElement).click());
      await expect.poll(() => page.url()).toContain("/data-grid");
      await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).not.toBe("hidden");
    });
  });
};
