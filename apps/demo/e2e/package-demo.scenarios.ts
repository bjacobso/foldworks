import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

const expectedPackages = [
  "@foldworks/editor",
  "@foldworks/ui",
  "@foldworks/sidebar",
  "@foldworks/agent",
  "@foldworks/code-editor",
  "@foldworks/data-table",
  "@foldworks/data-grid",
  "@foldworks/query-builder",
  "@foldworks/form-builder",
  "@foldworks/workflow",
  "@foldworks/pdf-annotator",
  "@foldworks/history",
] as const;

type PackageDemo = Readonly<{
  href: string;
  name: string;
}>;

const screenshotName = (packageName: string): string =>
  `site-docs-${packageName.replace("@foldworks/", "")}`;

export const packageDemoScreenshotScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
) => {
  describe("site documentation package screenshots", () => {
    it("captures every package demo linked from the site catalog", async () => {
      const page = getPage();
      await page.goto(appUrl, { waitUntil: "networkidle" });

      const demos = await page.locator(
        '[data-home-page="true"] a[aria-label^="@foldworks/"]',
      ).evaluateAll((links): ReadonlyArray<PackageDemo> => links.map((link) => ({
        href: link.getAttribute("href") ?? "",
        name: (link.getAttribute("aria-label") ?? "").split(":", 1)[0] ?? "",
      })));

      expect(demos.map(({ name }) => name)).toEqual(expectedPackages);
      expect(demos.every(({ href }) => href.startsWith("/"))).toBe(true);

      for (const demo of demos) {
        const url = new URL(demo.href, appUrl);
        await page.goto(url.href, { waitUntil: "networkidle" });
        await expect.poll(() => new URL(page.url()).pathname).toBe(url.pathname);
        await expect.poll(() => page.locator("main").isVisible()).toBe(true);

        if (demo.name === "@foldworks/pdf-annotator") {
          await page.getByRole("button", { name: "Try the sample document" }).click();
          await expect.poll(() => page.locator('[data-pdf-canvas-id="foldworks-pdf-annotator"]').isVisible())
            .toBe(true);
        }

        await screenshot(screenshotName(demo.name));
      }
    }, 60_000);
  });
};
