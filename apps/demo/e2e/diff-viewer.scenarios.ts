import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

export const diffViewerScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
): void => {
  describe("diff review", () => {
    it("changes layout, adds a line comment, and tracks viewed files", async () => {
      const page = getPage();
      await page.goto(`${appUrl}/diff-viewer`, { waitUntil: "networkidle" });

      await expect.poll(() => page.locator('[data-diff-review-demo="true"]').isVisible()).toBe(true);
      await expect.poll(() => page.getByRole("region", { name: /Changes in apps\/demo\/src\/review\/commands.ts/ }).isVisible()).toBe(true);
      await page.getByRole("button", { name: "Unified diff" }).click();
      await expect.poll(() => page.locator(".fk-diff-viewer").getAttribute("data-mode")).toBe("unified");

      await page.getByRole("button", { name: "Comment on new line 20" }).click();
      await page.getByRole("textbox", { name: "Review comment" }).fill("Please add a regression test for the empty review path.");
      await page.getByRole("button", { name: "Add comment" }).click();
      await expect.poll(() => page.getByText("Please add a regression test for the empty review path.", { exact: true }).isVisible()).toBe(true);

      await page.getByRole("button", { name: /Mark .*commands.ts as viewed/ }).click();
      await expect.poll(() => page.locator(".review-demo__nav-footer").textContent()).toContain("2 of 5 viewed");
      await expect.poll(() => page.getByRole("button", { name: /Unmark .*commands.ts as viewed/ }).isVisible()).toBe(true);
      await screenshot("diff-viewer-review");
    });
  });
};
