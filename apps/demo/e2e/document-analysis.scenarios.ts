import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

export const documentAnalysisScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
) => {
  describe("document analysis", () => {
    it("links cross-page evidence, selects PDF text, and bounds rendering across jumps and remounts", async () => {
      const page = getPage();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`${appUrl}/document-analysis`, { waitUntil: "networkidle" });
      const pages = page.locator("[data-pdf-viewer-page]");
      const images = page.locator(".fk-pdf-viewer__page-image");
      await expect.poll(() => pages.count()).toBe(12);
      await expect.poll(() => pages.nth(0).getAttribute("data-state")).toBe("rendered");
      expect(await images.count()).toBeLessThanOrEqual(3);
      expect(await pages.nth(11).getAttribute("data-state")).toBe("pending");
      const citation = page.locator('[data-citation="1"]');
      await citation.focus();
      await expect.poll(() => page.getByRole("tooltip").isVisible()).toBe(true);
      await citation.press("Escape");
      await expect.poll(() => page.getByRole("tooltip").count()).toBe(0);
      await citation.press("Enter");
      const highlight = page.locator('button[data-pdf-overlay-key="quote"]');
      await expect.poll(() => highlight.getAttribute("aria-pressed")).toBe("true");
      expect(await highlight.count()).toBe(1);
      expect(await page.locator('[data-pdf-overlay-key="quote"]').count()).toBe(2);
      const selectText = async () => {
        await page
          .locator('[data-pdf-viewer-page="0"] [data-pdf-text-layer] span')
          .filter({ hasText: "Employees with" })
          .evaluate((element) => {
            const range = document.createRange();
            range.setStart(element.firstChild!, 0);
            range.setEnd(element.firstChild!, 9);
            const selection = document.getSelection()!;
            selection.removeAllRanges();
            selection.addRange(range);
            document.dispatchEvent(new PointerEvent("pointerup"));
          });
        await expect
          .poll(() => page.locator("[data-pdf-selected-text]").textContent())
          .toBe("Selected: Employees");
      };
      await selectText();
      await page.getByRole("button", { name: "Jump to last page" }).click();
      await expect.poll(() => pages.nth(11).getAttribute("data-state")).toBe("rendered");
      expect(await images.count()).toBeLessThanOrEqual(3);
      await expect.poll(() => pages.nth(0).locator("[data-pdf-text-layer] span").count()).toBe(0);
      await citation.click();
      await expect.poll(() => pages.nth(0).getAttribute("data-state")).toBe("rendered");
      await selectText();
      await page.getByRole("link", { name: "Document editor", exact: true }).click();
      await page.getByRole("link", { name: "Document analysis", exact: true }).click();
      await expect.poll(() => pages.nth(0).getAttribute("data-state")).toBe("rendered");
      await selectText();
      expect(await images.count()).toBeLessThanOrEqual(3);
      await citation.click();
      // Wait for the citation to place both sides of the page boundary in the viewport.
      await expect
        .poll(async () => {
          const rect = await highlight.boundingBox();
          const viewer = await page.locator("[data-pdf-viewer-scroller]").boundingBox();
          return (
            rect !== null &&
            viewer !== null &&
            rect.y > viewer.y &&
            rect.y < viewer.y + viewer.height
          );
        })
        .toBe(true);
      await screenshot("document-analysis");
    });

    it("compares prose and explores a graph using keyboard, compound disclosure, and neighborhoods", async () => {
      const page = getPage();
      await page.goto(`${appUrl}/document-analysis`, { waitUntil: "networkidle" });
      const diff = page.locator(".fk-prose-diff");
      await page.getByRole("button", { name: "Side-by-side comparison" }).click();
      await expect.poll(() => diff.getAttribute("data-mode")).toBe("split");
      expect(await diff.locator("ins").allTextContents()).toContain("six");
      expect(await diff.locator("del").allTextContents()).toContain("may");
      await page.getByRole("button", { name: "Fit graph", exact: true }).click();
      const article = page.locator('[data-graph-node="article"]');
      const policy = page.locator('[data-graph-node="policy"]');
      await article.focus();
      await article.press("ArrowDown");
      await expect.poll(() => policy.getAttribute("aria-pressed")).toBe("true");
      await expect
        .poll(() => policy.evaluate((element) => element === document.activeElement))
        .toBe(true);
      await policy.press("Enter");
      await expect
        .poll(() => page.locator("[data-analysis-announcement]").textContent())
        .toBe("Activated: policy");
      await page.getByRole("button", { name: "Collapse Agreement", exact: true }).click();
      await expect.poll(() => article.count()).toBe(0);
      await page.getByRole("button", { name: "Expand Agreement", exact: true }).click();
      await expect.poll(() => article.count()).toBe(1);
      await page.getByRole("button", { name: "Focus Article 12 neighborhood" }).click();
      await expect.poll(() => policy.count()).toBe(0);
      await page.getByRole("button", { name: "Expand neighborhood", exact: true }).click();
      await expect.poll(() => policy.count()).toBe(1);
      await page.getByText("Graph as a list", { exact: true }).click();
      expect(await page.locator("[data-graph-list-node]").count()).toBe(3);
      await page.getByRole("button", { name: "Show all", exact: true }).click();
      await expect.poll(() => page.locator("[data-graph-list-node]").count()).toBe(4);
    });
  });
};
