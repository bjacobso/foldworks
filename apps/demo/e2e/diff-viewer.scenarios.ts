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

      const rangeStart = page.getByRole("button", { name: "Comment on new line 20" });
      const rangeEnd = page.getByRole("button", { name: "Comment on new line 24" });
      const startBox = await rangeStart.boundingBox();
      const endBox = await rangeEnd.boundingBox();
      expect(startBox).not.toBeNull();
      expect(endBox).not.toBeNull();
      if (startBox === null || endBox === null) return;
      await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 8 });
      await page.mouse.up();
      await expect.poll(() => page.getByText("New lines 20–24", { exact: true }).isVisible()).toBe(true);
      await page.getByRole("textbox", { name: "Review comment" }).fill("Please add a regression test for the empty review path.");
      await page.getByRole("button", { name: "Add comment" }).click();
      await expect.poll(() => page.getByText("Please add a regression test for the empty review path.", { exact: true }).isVisible()).toBe(true);
      await expect.poll(() => page.getByText("New lines 20–24", { exact: true }).isVisible()).toBe(true);

      await page.getByRole("button", { name: /Mark .*commands.ts as viewed/ }).click();
      await expect.poll(() => page.locator(".review-demo__nav-footer").textContent()).toContain("2 of 5 viewed");
      await expect.poll(() => page.getByRole("button", { name: /Unmark .*commands.ts as viewed/ }).isVisible()).toBe(true);
      await screenshot("diff-viewer-review");
    });
  });
};
