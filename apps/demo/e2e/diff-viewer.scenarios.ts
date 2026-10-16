import type { Page } from "playwright";
import { describe, expect, it } from "vitest";
import { proposedFlags, suggestedFlags } from "../src/diff-viewer/fixture";
const source = (page: Page) =>
  page.getByRole("textbox", { name: "Configuration source", exact: true });
const diff = (page: Page) => page.locator(".cr-demo__diff > .fk-diff-viewer");
const ready = async (page: Page) =>
  expect
    .poll(() =>
      source(page).evaluate(
        (element) =>
          (element as HTMLTextAreaElement & { foldkitNative?: { status: string } }).foldkitNative
            ?.status,
      ),
    )
    .toBe("Ready");
export const diffViewerScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
): void => {
  describe("change request reference", () => {
    it("edits, validates, requests changes, applies suggestions, approves, merges and reloads history", async () => {
      const page = getPage();
      await page.goto(`${appUrl}/diff-viewer`, { waitUntil: "networkidle" });
      await ready(page);
      await expect
        .poll(() => page.getByText("LOCAL SIMULATION", { exact: true }).isVisible())
        .toBe(true);
      await source(page).fill(proposedFlags.replace('"checkout": true', '"checkout": "yes"'));
      await expect.poll(() => page.locator(".native-token--issue").count()).toBeGreaterThan(0);
      await expect
        .poll(() => diff(page).locator('[data-annotation-tone="danger"]').count())
        .toBeGreaterThan(0);
      await screenshot("change-request-01-schema-error");
      await source(page).fill(proposedFlags);
      await expect.poll(() => page.locator(".native-token--issue").count()).toBe(0);
      await page.getByRole("button", { name: "Semantic values", exact: true }).click();
      await expect
        .poll(() => page.getByRole("region", { name: "Value changes" }).isVisible())
        .toBe(true);
      await screenshot("change-request-02-values");
      await page.getByRole("button", { name: "Line diff", exact: true }).click();
      await page.getByRole("button", { name: "Open change request", exact: true }).click();
      const files = page.getByRole("tree", { name: "Changed files", exact: true });
      await files.focus();
      await files.press("End");
      await files.press("Enter");
      await expect
        .poll(() =>
          page.getByRole("combobox", { name: "Configuration file", exact: true }).inputValue(),
        )
        .toBe("config/access.json");
      await files.press(" ");
      await expect
        .poll(() => page.getByText("1 files viewed · 0 discussions", { exact: true }).isVisible())
        .toBe(true);
      await page.getByRole("button", { name: /Expand .* unchanged lines/ }).click();
      await expect
        .poll(() =>
          diff(page)
            .getByRole("button", { name: "Comment on new line 1", exact: true })
            .isVisible(),
        )
        .toBe(true);
      await page
        .getByRole("combobox", { name: "Configuration file", exact: true })
        .selectOption("config/flags.json");
      await page.getByRole("button", { name: "Act as reviewer", exact: true }).click();
      const noteLine = diff(page).getByRole("button", {
        name: "Comment on new line 4",
        exact: true,
      });
      await noteLine.focus();
      await noteLine.press("Enter");
      const composer = page.getByRole("textbox", { name: "Review comment", exact: true });
      await expect
        .poll(() => composer.evaluate((element) => element === document.activeElement))
        .toBe(true);
      await composer.fill("Please remove this temporary note.");
      await composer.press("Control+Enter");
      await expect
        .poll(() => noteLine.evaluate((element) => element === document.activeElement))
        .toBe(true);
      const start = diff(page).getByRole("button", {
        name: /^(?:Comment on|Selected) new line 3$/,
      });
      await start.focus();
      await start.press("Enter");
      await start.focus();
      await start.press("Shift+ArrowDown");
      await expect
        .poll(() => page.getByText("New lines 3–4", { exact: true }).isVisible())
        .toBe(true);
      await expect
        .poll(() => composer.evaluate((element) => element === document.activeElement))
        .toBe(true);
      await composer.fill("Keep the first rollout small and record the reviewer.");
      await page.getByRole("button", { name: "Add suggestion", exact: true }).click();
      const replacement = page.getByRole("textbox", { name: "Suggested replacement", exact: true });
      await replacement.fill(suggestedFlags);
      await replacement.press("Control+Enter");
      await expect
        .poll(() =>
          page
            .getByRole("form", { name: "Submit review", exact: true })
            .getByRole("status")
            .textContent(),
        )
        .toBe("2 pending comments");
      await page.getByRole("button", { name: "Request changes", exact: true }).click();
      await page.getByRole("button", { name: "Submit review", exact: true }).click();
      await screenshot("change-request-03-request-changes");
      await page.getByRole("button", { name: "Act as author", exact: true }).click();
      await page.getByRole("button", { name: "Apply suggestion", exact: true }).click();
      await expect.poll(() => page.locator('[data-anchor-state="outdated"]').count()).toBe(1);
      await expect.poll(() => page.locator('[data-anchor-state="moved"]').count()).toBe(1);
      await expect.poll(() => source(page).inputValue()).toContain('"rollout": 25');
      await screenshot("change-request-04-suggestion");
      await page.getByRole("button", { name: "Act as reviewer", exact: true }).click();
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await page.getByRole("button", { name: "Submit review", exact: true }).click();
      await page.getByRole("button", { name: "Act as author", exact: true }).click();
      await expect
        .poll(() =>
          page.getByRole("button", { name: "Merge change request", exact: true }).isEnabled(),
        )
        .toBe(true);
      await page.setViewportSize({ width: 1600, height: 1200 });
      await page.locator(".cr-demo").evaluate((element) => {
        let node: HTMLElement | null = element as HTMLElement;
        while (node) {
          node.scrollTop = 0;
          node = node.parentElement;
        }
      });
      await screenshot("change-request-05-ready");
      await page.getByRole("button", { name: "Dark appearance", exact: true }).click();
      await screenshot("change-request-08-dark-desktop");
      await page.getByRole("button", { name: "Light appearance", exact: true }).click();
      await page.getByRole("button", { name: "Merge change request", exact: true }).click();
      await expect.poll(() => page.locator(".fk-review__header").textContent()).toContain("merged");
      await page.reload({ waitUntil: "networkidle" });
      await ready(page);
      await expect
        .poll(() => page.getByRole("region", { name: "Change request activity" }).textContent())
        .toContain("Configuration merged locally");
      await expect
        .poll(() => source(page).inputValue())
        .toContain('"reviewedBy": "Local reviewer"');
      await screenshot("change-request-06-history");
    }, 90_000);
    it("supports keyboard cancellation, narrow screens and dark appearance", async () => {
      const page = getPage();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${appUrl}/diff-viewer`, { waitUntil: "networkidle" });
      await ready(page);
      await source(page).fill(proposedFlags);
      await page.getByRole("button", { name: "Open change request", exact: true }).click();
      await page.getByRole("button", { name: "Act as reviewer", exact: true }).click();
      const gutter = diff(page).getByRole("button", {
        name: /^(?:Comment on|Selected) new line 3$/,
      });
      await gutter.focus();
      await gutter.press("Enter");
      const composer = page.getByRole("textbox", { name: "Review comment", exact: true });
      await composer.fill("Draft survives closing");
      await composer.press("Escape");
      await expect
        .poll(() => gutter.evaluate((element) => document.activeElement === element))
        .toBe(true);
      await gutter.press("Enter");
      await expect.poll(() => composer.inputValue()).toBe("Draft survives closing");
      await composer.press("Escape");
      await page.getByRole("button", { name: "Dark appearance", exact: true }).click();
      await expect.poll(() => page.locator(".cr-demo").getAttribute("data-dark")).toBe("true");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await screenshot("change-request-07-dark-mobile");
    }, 60_000);
  });
};
