import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

export const agentScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
) => {
  describe("agent playground", () => {
    const start = async () => {
      const page = getPage();
      await page.goto(`${appUrl}/agent`, { waitUntil: "networkidle" });
      await expect.poll(() => page.locator('[data-agent-playground="true"]').isVisible()).toBe(true);
      return page;
    };

    const runToPermission = async (page: Page) => {
      await page.getByRole("button", { name: "Run the release checklist example" }).click();
      await expect.poll(() => page.locator('[data-tool-call="read_file"]').getAttribute("data-tool-status"), { timeout: 5_000 })
        .toBe("Completed");
      await expect.poll(() => page.locator('[data-tool-call="write_file"]').getAttribute("data-tool-status"), { timeout: 5_000 })
        .toBe("WaitingApproval");
      await expect.poll(() => page.getByRole("group", { name: "Permission request for write_file" }).isVisible(), { timeout: 5_000 })
        .toBe(true);
    };

    it("streams tool calls, asks permission, and completes after approval", async () => {
      const page = await start();

      const modelPicker = page.getByRole("button", { name: "Agent model" });
      await modelPicker.click();
      await page.getByRole("option", { name: "Atlas Fast" }).click();
      await expect.poll(() => modelPicker.textContent()).toContain("Atlas Fast");

      await runToPermission(page);
      const assistant = page.locator('[data-agent-turn="assistant"]');
      expect(await assistant.textContent()).toContain("release setup first");
      expect(await page.locator('[data-tool-call="read_file"] pre').first().textContent()).toContain("package.json");
      expect(await page.getByRole("group", { name: "Permission request for write_file" }).textContent())
        .toContain("docs/launch-checklist.md");
      await screenshot("18-agent-permission");

      await page.getByRole("button", { name: "Allow once" }).click();
      await expect.poll(() => page.locator('[data-tool-call="write_file"]').getAttribute("data-tool-status"), { timeout: 5_000 })
        .toBe("Completed");
      await expect.poll(() => page.getByText("No real file was changed.", { exact: true }).isVisible(), { timeout: 5_000 })
        .toBe(true);
      await expect.poll(() => page.getByText("Complete", { exact: true }).first().isVisible()).toBe(true);
      await screenshot("19-agent-complete");
    });

    it("supports multiline input, denial, stop, and reset", async () => {
      const page = await start();
      const input = page.getByRole("textbox", { name: "Message the agent" });

      await input.fill("Line one");
      await input.press("Shift+Enter");
      await input.type("Line two");
      expect(await input.inputValue()).toBe("Line one\nLine two");
      await input.press("Enter");

      await expect.poll(() => page.locator('[data-tool-call="write_file"]').getAttribute("data-tool-status"), { timeout: 5_000 })
        .toBe("WaitingApproval");
      await page.getByRole("button", { name: "Deny" }).click();
      await expect.poll(() => page.locator('[data-tool-call="write_file"]').getAttribute("data-tool-status"))
        .toBe("Denied");
      await expect.poll(() => page.getByText(/I didn’t apply the checklist update/).isVisible(), { timeout: 5_000 }).toBe(true);

      await page.getByRole("button", { name: "Reset" }).click();
      await expect.poll(() => page.getByRole("button", { name: "Run the release checklist example" }).isVisible())
        .toBe(true);
      await page.getByRole("button", { name: "Run the release checklist example" }).click();
      await expect.poll(() => page.locator('[data-agent-turn="assistant"]').textContent()).toContain("release setup first");
      await page.getByRole("button", { name: "Stop" }).click();
      await expect.poll(() => page.getByText(/\(stopped\)/).isVisible()).toBe(true);
      await page.waitForTimeout(500);
      expect(await page.locator('[data-tool-status="WaitingApproval"]').count()).toBe(0);

      await page.getByRole("button", { name: "Reset" }).click();
      await page.getByRole("button", { name: "Run the release checklist example" }).click();
      await expect.poll(() => page.locator('[data-agent-turn="assistant"]').textContent()).toContain("release setup first");
      await page.getByRole("link", { name: "Home", exact: true }).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe("/");
      await page.getByRole("link", { name: "Agent playground", exact: true }).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe("/agent");
      await expect.poll(() => page.getByText("Stopped", { exact: true }).first().isVisible()).toBe(true);
      await page.waitForTimeout(500);
      expect(await page.locator('[data-tool-status="WaitingApproval"]').count()).toBe(0);
    });

    it("fits the mobile viewport and keeps controls available in dark mode", async () => {
      const page = getPage();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${appUrl}/agent`, { waitUntil: "networkidle" });
      await page.getByLabel("Appearance").selectOption("Dark");
      await expect.poll(() => page.locator("html").getAttribute("class")).toContain("dark");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect.poll(() => page.getByRole("button", { name: "Agent model" }).isVisible()).toBe(true);
      await expect.poll(() => page.getByRole("textbox", { name: "Message the agent" }).isVisible()).toBe(true);
      await screenshot("20-agent-mobile-dark");
    });
  });
};
