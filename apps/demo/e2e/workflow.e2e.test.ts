import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, preview, type PreviewServer } from "vite";

const appRoot = resolve(import.meta.dirname, "..");
const screenshotDirectory = resolve(appRoot, "test-results/demo");
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
  const initialTargetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(initialTargetBox).not.toBeNull();
  if (sourceBox === null || initialTargetBox === null) return { source, target };

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + 12, {
    steps: 3,
  });
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  if (targetBox === null) return { source, target };
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

  it("ghosts an entire registered subtree while its owner is dragged", async () => {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    const { source, target } = await drag(
      '[data-node-id="node-switch"]',
      thenTargetSelector,
    );

    await expect.poll(() => target.getAttribute("data-drop-active")).toBe("true");
    await expect.poll(() => source.getAttribute("data-drag-subtree")).toBe("true");
    await expect
      .poll(() => page.locator('[data-node-id="node-action"]').getAttribute("data-drag-subtree"))
      .toBe("true");
    await expect
      .poll(() => page.locator('[data-node-id="node-condition"]').getAttribute("data-drag-subtree"))
      .toBe("false");
    await expect
      .poll(() => page.locator('[data-drag-subtree-connector="true"]').count())
      .toBeGreaterThanOrEqual(3);
    await expect.poll(() => page.getByText("2 nodes", { exact: true }).isVisible()).toBe(true);

    const descendantAppearance = await page
      .locator('[data-node-id="node-action"]')
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { borderStyle: style.borderStyle, opacity: Number(style.opacity) };
      });
    expect(descendantAppearance.borderStyle).toBe("dashed");
    expect(descendantAppearance.opacity).toBeLessThan(0.7);
    await screenshot("07-subtree-ghost-hover");

    await page.mouse.up();
    await page.waitForTimeout(350);
    await expectNoNodeOverlaps();
    await screenshot("08-subtree-move-committed");
  });

  it("keeps navigational demo and form state in the URL", async () => {
    await page.goto(`${appUrl}/data-grid`, { waitUntil: "networkidle" });
    await expect.poll(() => new URL(page.url()).pathname).toBe("/data-grid");
    await expect.poll(() => page.locator('[data-grid-id="people-directory"]').isVisible()).toBe(true);

    await page.getByRole("link", { name: "Form builder" }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/form-builder");
    await expect.poll(() => new URL(page.url()).searchParams.get("example")).toBe("Handoff");
    await expect.poll(() => new URL(page.url()).searchParams.get("mode")).toBe("Editor");

    await page.getByLabel("Example form").selectOption("Complex");
    await expect.poll(() => new URL(page.url()).searchParams.get("example")).toBe("Complex");
    await page.getByRole("button", { name: "Preview" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("mode")).toBe("Preview");
    await expect.poll(() => page.locator('[data-form-runner="true"]').isVisible()).toBe(true);

    await page.goBack({ waitUntil: "networkidle" });
    await expect.poll(() => new URL(page.url()).searchParams.get("mode")).toBe("Editor");
    await expect.poll(() => page.locator('[data-form-runner="true"]').count()).toBe(0);

    await page.goto(`${appUrl}/form-builder?example=Complex&mode=Preview`, {
      waitUntil: "networkidle",
    });
    await expect.poll(() => page.getByRole("heading", { name: "Identity" }).isVisible()).toBe(true);
  });

  it("renders and operates the Foldkit-native data grid", async () => {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Data grid" }).click();

    const grid = page.locator('[data-grid-id="people-directory"]');
    await expect.poll(() => grid.isVisible()).toBe(true);
    await expect.poll(() => grid.getAttribute("aria-rowcount")).toBe("121");
    await expect.poll(() => grid.locator('[data-row-id]').count()).toBe(120);
    await expect.poll(() => grid.getByText("Active", { exact: true }).count()).toBeGreaterThan(0);
    await expect.poll(() => grid.getAttribute("data-appearance")).toBe("embedded");
    await expect.poll(() => grid.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.borderTopLeftRadius, style.borderLeftWidth, style.borderRightWidth];
    })).toEqual(["0px", "0px", "0px"]);

    const employeeHeader = grid.locator('[data-column-id="employee"]');
    await employeeHeader.getByRole("button").click();
    await expect.poll(() => employeeHeader.getAttribute("aria-sort")).toBe("ascending");
    await employeeHeader.getByRole("button").click();
    await expect.poll(() => employeeHeader.getAttribute("aria-sort")).toBe("descending");

    const firstCell = grid.locator('[data-grid-cell-position="0:0"]');
    await firstCell.click();
    await expect.poll(() => firstCell.getAttribute("data-selected")).toBe("true");
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => grid.locator('[data-grid-cell-position="0:1"]').getAttribute("data-selected"))
      .toBe("true");

    const resizeHandle = grid.locator('[data-resize-column="employee"]');
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    if (handleBox !== null) {
      const originalWidth = await firstCell.evaluate((element) =>
        element.getBoundingClientRect().width,
      );
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 10);
      await page.mouse.down();
      await page.mouse.move(handleBox.x + 80, handleBox.y + 10, { steps: 8 });
      await page.mouse.up();
      await expect
        .poll(() => firstCell.evaluate((element) => element.getBoundingClientRect().width))
        .toBeGreaterThan(originalWidth + 50);
    }

    await screenshot("09-data-grid");
  });

  it("builds and previews section-first multi-actor forms", async () => {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Form builder" }).click();

    await expect.poll(() => page.locator("[data-form-section-id]").count()).toBe(3);
    await expect.poll(() => page.locator("[data-form-page-id]").count()).toBe(4);
    await expect.poll(() => page.getByText("Employee", { exact: true }).count()).toBeGreaterThan(1);
    await expect.poll(() => page.getByText("Employer", { exact: true }).count()).toBeGreaterThan(0);

    const { target: sectionTarget } = await drag(
      '[data-form-section-id="handoff-employee-confirm"] [data-draggable-id="form-item:section:handoff-employee-confirm"]',
      '[data-droppable-id="form-target:section:new-hire-handoff:1"]',
    );
    await expect.poll(() => sectionTarget.getAttribute("data-form-drop-active")).toBe("true");
    await page.mouse.up();
    await page.waitForTimeout(350);
    await expect
      .poll(() => page.locator("[data-form-section-id]").evaluateAll((sections) =>
        sections.map((section) => section.getAttribute("data-form-section-id")),
      ))
      .toEqual(["handoff-employee-details", "handoff-employee-confirm", "handoff-employer-setup"]);

    const { target: pageTarget } = await drag(
      '[data-form-page-id="handoff-emergency"] [data-draggable-id="form-item:page:handoff-emergency"]',
      '[data-droppable-id="form-target:page:handoff-employer-setup:1"]',
    );
    await expect.poll(() => pageTarget.getAttribute("data-form-drop-active")).toBe("true");
    await page.mouse.up();
    await page.waitForTimeout(350);
    await expect
      .poll(() => page.locator('[data-form-section-id="handoff-employer-setup"] [data-form-page-id="handoff-emergency"]').count())
      .toBe(1);

    await page.getByLabel("Example form").selectOption("Simple");
    await page.getByLabel("Example form").selectOption("Handoff");
    await expect.poll(() => page.locator("[data-form-section-id]").count()).toBe(3);

    await page.locator('[data-form-page-id="handoff-policies"]').getByRole("button").click();
    const policyContent = page.locator('[data-form-field-id="handoff-policy-content"]');
    await expect.poll(() => policyContent.getByRole("heading", { name: "Workplace policies" }).count()).toBe(1);
    await expect.poll(() => policyContent.locator("strong").textContent()).toBe("handbook");
    await expect.poll(() => policyContent.locator("li").count()).toBe(2);

    await page.locator('[data-form-page-id="handoff-about-you"]').getByRole("button").click();

    const fieldsBefore = await page.locator("[data-form-field-id]").count();
    await page.locator('[data-form-palette-field="date"]').click();
    await expect.poll(() => page.locator("[data-form-field-id]").count()).toBe(fieldsBefore + 1);
    await expect.poll(() => page.getByLabel("Label").inputValue()).toBe("Date");
    await page.getByLabel("Label").fill("Orientation date");
    await expect.poll(() => page.getByText("Orientation date", { exact: true }).count()).toBe(1);
    await page.waitForTimeout(400);

    const source = page.locator('[data-form-field-id="handoff-name"]');
    const sourceBox = await source.boundingBox();
    expect(sourceBox).not.toBeNull();
    if (sourceBox !== null) {
      await page.mouse.move(sourceBox.x + sourceBox.width - 25, sourceBox.y + 20);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width - 5, sourceBox.y + 45, { steps: 5 });
      const target = page.locator(
        '[data-form-page-id="handoff-emergency"] [data-form-drop-kind="field"]',
      );
      await expect.poll(() => target.count()).toBe(1);
      const targetBox = await target.boundingBox();
      expect(targetBox).not.toBeNull();
      if (targetBox !== null) {
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
        await expect.poll(() => target.getAttribute("data-form-drop-active")).toBe("true");
      }
      await page.mouse.up();
    }

    await page.locator('[data-form-page-id="handoff-emergency"]').getByRole("button").click();
    await expect.poll(() => page.locator('[data-form-field-id="handoff-name"]').count()).toBe(1);
    await screenshot("10-form-editor");

    await page.getByRole("button", { name: "Preview" }).click();
    await expect.poll(() => page.locator('[data-form-runner="true"]').isVisible()).toBe(true);
    await expect.poll(() => page.getByText("Step 2 of 3", { exact: true }).isVisible()).toBe(true);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect.poll(() => page.getByText("View recorded for this participant", { exact: false }).isVisible()).toBe(true);
    await screenshot("11-form-preview");

    await page.getByLabel("Preview actor").selectOption("employer");
    await expect.poll(() => page.getByText("Step 1 of 1", { exact: true }).isVisible()).toBe(true);
    await expect.poll(() => page.getByRole("heading", { name: "Role and compensation" }).isVisible()).toBe(true);

    await page.getByLabel("Example form").selectOption("Complex");
    await expect.poll(() => page.getByRole("heading", { name: "Identity" }).isVisible()).toBe(true);
    await page.getByRole("button", { name: "Editor" }).click();
    await expect.poll(() => page.locator("[data-form-section-id]").count()).toBe(4);
    await expect.poll(() => page.getByText("Authorized representative", { exact: true }).count()).toBeGreaterThan(0);
  });
});
