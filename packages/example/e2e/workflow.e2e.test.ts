import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, preview, type PreviewServer } from "vite";

const appRoot = resolve(import.meta.dirname, "..");
const screenshotDirectory = resolve(appRoot, "test-results/workflow");
const appUrl = "http://127.0.0.1:4174";
const thenTargetSelector =
  '[data-droppable-id="flow-target:flow%3Acondition%3Athen:0"]';

let browser: Browser;
let page: Page;
let server: PreviewServer;

const screenshot = async (name: string) => {
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: resolve(screenshotDirectory, `${name}.png`),
  });
};

const nodeRectangles = () =>
  page.locator("[data-node-id]").evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { id: element.getAttribute("data-node-id") ?? "", x, y, width, height };
    }),
  );

const expectNoNodeOverlaps = async () => {
  const rectangles = await nodeRectangles();
  for (const [index, first] of rectangles.entries()) {
    for (const second of rectangles.slice(index + 1)) {
      const overlapWidth = Math.max(
        0,
        Math.min(first.x + first.width, second.x + second.width) -
          Math.max(first.x, second.x),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(first.y + first.height, second.y + second.height) -
          Math.max(first.y, second.y),
      );
      expect(overlapWidth * overlapHeight, `${first.id} overlaps ${second.id}`).toBe(0);
    }
  }
};

const drag = async (sourceSelector: string, targetSelector: string) => {
  const source = page.locator(sourceSelector);
  const target = page.locator(targetSelector);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (sourceBox === null || targetBox === null) return { source, target };

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + 12, {
    steps: 3,
  });
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 12 },
  );
  return { source, target };
};

describe.sequential("structured workflow builder", () => {
  beforeAll(async () => {
    await mkdir(screenshotDirectory, { recursive: true });
    await build({
      configFile: resolve(appRoot, "vite.config.ts"),
      logLevel: "silent",
      root: appRoot,
    });
    server = await preview({
      configFile: resolve(appRoot, "vite.config.ts"),
      logLevel: "silent",
      preview: { host: "127.0.0.1", port: 4174, strictPort: true },
      root: appRoot,
    });
    browser = await chromium.launch({ channel: "chrome", headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  });

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it("renders nested condition and switch branches without collisions", async () => {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await expect.poll(() => page.locator("[data-node-id]").count()).toBe(5);
    await expect.poll(() => page.getByText("Then", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("Else", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("Default", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.locator("[data-location-id]").count()).toBe(7);
    await expectNoNodeOverlaps();

    const viewport = await page.locator("[data-workflow-canvas]").evaluate((canvas) => {
      const canvasRect = canvas.getBoundingClientRect();
      const parentRect = canvas.parentElement?.getBoundingClientRect();
      return {
        canvasCenter: canvasRect.x + canvasRect.width / 2,
        viewportCenter:
          (parentRect?.x ?? 0) + (parentRect?.width ?? canvasRect.width) / 2,
      };
    });
    expect(Math.abs(viewport.canvasCenter - viewport.viewportCenter)).toBeLessThan(2);
    await screenshot("01-structured-initial");
  });

  it("highlights a nested drop target and inserts a registered type", async () => {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    const { target } = await drag(
      '[data-draggable-id="palette:approval"]',
      thenTargetSelector,
    );

    await expect.poll(() => target.getAttribute("data-drop-active")).toBe("true");
    await expect.poll(() => target.getByRole("button").textContent()).toBe("+");
    const activeTargetBox = await target.getByRole("button").boundingBox();
    expect(activeTargetBox?.width).toBeGreaterThanOrEqual(38);
    expect(activeTargetBox?.width).toBeLessThanOrEqual(44);
    await screenshot("02-nested-drop-hover");

    await page.mouse.up();
    await expect.poll(() => page.locator("[data-node-id]").count()).toBe(6);
    await expect
      .poll(() => page.locator('[data-node-id="node-1"]').textContent())
      .toContain("Request approval");
    await page.waitForTimeout(350);
    await expectNoNodeOverlaps();
    await screenshot("03-nested-drop-committed");

    await page.locator('[data-node-id="node-1"]').click();
    await expect
      .poll(() => page.getByRole("heading", { name: "Request approval" }).isVisible())
      .toBe(true);
    await expect.poll(() => page.getByLabel("Name").inputValue()).toBe("Request approval");
    await screenshot("04-registered-node-inspector");
  });

  it("keeps an outline placeholder while moving a node between branches", async () => {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    const { source, target } = await drag(
      '[data-node-id="node-action"]',
      thenTargetSelector,
    );

    await expect.poll(() => target.getAttribute("data-drop-active")).toBe("true");
    await expect.poll(() => source.getAttribute("data-drag-source")).toBe("true");
    const sourceAppearance = await source.evaluate((element) => {
      const style = getComputedStyle(element);
      return { borderStyle: style.borderStyle, opacity: style.opacity };
    });
    expect(sourceAppearance).toEqual({ borderStyle: "dashed", opacity: "1" });
    await screenshot("05-branch-move-hover");

    await page.mouse.up();
    await page.waitForTimeout(350);
    await expect.poll(() => page.locator("[data-node-id]").count()).toBe(5);
    await expectNoNodeOverlaps();

    const positions = await page
      .locator('[data-node-id="node-action"], [data-node-id="node-switch"]')
      .evaluateAll((elements) =>
        Object.fromEntries(
          elements.map((element) => [
            element.getAttribute("data-node-id") ?? "",
            element.getBoundingClientRect().x,
          ]),
        ),
      );
    expect(positions["node-action"]).toBeLessThan(positions["node-switch"] ?? 0);
    await screenshot("06-branch-move-committed");
  });
});
