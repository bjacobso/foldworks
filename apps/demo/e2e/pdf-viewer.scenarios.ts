import { readFile } from "node:fs/promises";

import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

export const pdfViewerScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
): void => {
  describe("PDF viewer", () => {
    it("renders pages, maps overlays through crop boxes and rotation, and downloads", async () => {
      const page = getPage();
      await page.goto(`${appUrl}/pdf-viewer`, { waitUntil: "networkidle" });

      const pages = page.locator("[data-pdf-viewer-page]");
      const controls = page.getByRole("toolbar", { name: "PDF controls" });
      await expect.poll(() => pages.count()).toBe(3);
      await expect
        .poll(() =>
          pages.evaluateAll((elements) =>
            elements.map((element) => element.getAttribute("data-state")),
          ),
        )
        .toEqual(["rendered", "rendered", "rendered"]);
      await expect
        .poll(() => page.getByText("Synthetic preview", { exact: true }).isVisible())
        .toBe(true);

      // Page 3 is rotated 90°: a 300 × 36 pt box on the displayed page is stored as 36 × 300 in user space.
      const rotated = page.locator('[data-pdf-overlay-key="reviewer-signature"]');
      const rotatedPage = pages.nth(2);
      const [rotatedBox, rotatedPageBox] = await Promise.all([
        rotated.boundingBox(),
        rotatedPage.boundingBox(),
      ]);
      expect(rotatedBox).not.toBeNull();
      expect(rotatedPageBox).not.toBeNull();
      if (rotatedBox === null || rotatedPageBox === null) return;
      expect(rotatedBox.width / rotatedPageBox.width).toBeCloseTo(300 / 792, 2);
      expect(rotatedBox.height / rotatedPageBox.height).toBeCloseTo(36 / 612, 2);

      await page
        .getByRole("complementary", { name: "Widget statuses" })
        .getByRole("button", { name: /^Reviewer signature/ })
        .click();
      await expect.poll(() => rotated.getAttribute("aria-pressed")).toBe("true");
      await expect
        .poll(() => controls.getByText("Page 3 of 3", { exact: true }).isVisible())
        .toBe(true);

      await controls.getByRole("button", { name: "Previous page" }).click();
      await expect
        .poll(() => controls.getByText("Page 2 of 3", { exact: true }).isVisible())
        .toBe(true);

      await controls.getByRole("button", { name: "Zoom in" }).click();
      const zoomLabel = controls.getByRole("button", { name: /Reset to 100 percent/ });
      const zoomed = Number.parseInt((await zoomLabel.textContent()) ?? "0", 10);
      expect(zoomed).toBeGreaterThanOrEqual(50);
      expect(zoomed).toBeLessThanOrEqual(200);

      const overlay = page.locator('[data-pdf-overlay-key="document-number"]');
      await overlay.click();
      await expect.poll(() => overlay.getAttribute("aria-pressed")).toBe("true");

      const downloadPromise = page.waitForEvent("download");
      await controls.getByRole("button", { name: "Download", exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe("synthetic-onboarding-packet.pdf");
      const downloadedPath = await download.path();
      if (downloadedPath !== null) {
        const bytes = await readFile(downloadedPath);
        expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      }
      await screenshot("pdf-viewer");
    });
  });
};
