import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
  // Drag activation can expand insertion targets; wait for their layout
  // transition before resolving the final target coordinates.
  await page.waitForTimeout(220);
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
  });

  beforeEach(async () => {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  });

  afterEach(async () => {
    await page?.close();
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
    await expect.poll(() => page.locator('[data-lucide-icon="workflow"]').count()).toBe(1);
    await expect.poll(() => page.locator("[data-node-id] [data-lucide-icon]").count())
      .toBeGreaterThanOrEqual(5);
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

  it("edits and renders the configured query builder", async () => {
    await page.goto(`${appUrl}/query-builder`, { waitUntil: "networkidle" });

    await expect.poll(() => page.locator("[data-query-group]").count()).toBe(2);
    await expect.poll(() => page.locator("[data-query-rule]").count()).toBe(4);
    await expect.poll(() => page.locator("[data-query-readonly=true]").textContent())
      .toContain("DepartmentisEngineering");
    await expect.poll(() => page.getByText("Query is valid", { exact: true }).count()).toBe(1);

    const firstRule = page.locator("[data-query-rule]").first();
    const restingShadow = await firstRule.evaluate((element) => getComputedStyle(element).boxShadow);
    const animationName = await firstRule.evaluate((element) => getComputedStyle(element).animationName);
    expect(animationName).not.toBe("none");
    await firstRule.hover();
    await page.waitForTimeout(220);
    const hoverShadow = await firstRule.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(hoverShadow).not.toBe(restingShadow);

    const conditionButton = page.locator('[data-query-group="employee-filter-root"]')
      .getByRole("button", { name: "Condition" })
      .first();
    const restingTransform = await conditionButton.evaluate((element) => getComputedStyle(element).transform);
    const conditionBox = await conditionButton.boundingBox();
    expect(conditionBox).not.toBeNull();
    if (conditionBox === null) return;
    await page.mouse.move(conditionBox.x + conditionBox.width / 2, conditionBox.y + conditionBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(140);
    const activeTransform = await conditionButton.evaluate((element) => getComputedStyle(element).transform);
    expect(activeTransform).not.toBe(restingTransform);
    await page.mouse.up();
    await expect.poll(() => page.locator("[data-query-rule]").count()).toBe(5);
    await expect.poll(() => page.getByText("1 issue to resolve", { exact: true }).count()).toBe(1);

    const addedRule = page.locator("[data-query-rule]").last();
    await addedRule.getByRole("textbox", { name: "Employee name value" }).fill("Maya");
    await expect.poll(() => page.getByText("Query is valid", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.locator("[data-query-readonly=true]").textContent())
      .toContain("Employee nameisMaya");
    await screenshot("16-query-builder");
  });

  it("reorders query rules across groups with pointer and keyboard dragging", async () => {
    await page.goto(`${appUrl}/query-builder`, { waitUntil: "networkidle" });

    const pointerTarget = '[data-droppable-id="query-target:group-2:2"]';
    const { target } = await drag(
      '[data-draggable-id="query-rule:rule-1"]',
      pointerTarget,
    );
    await expect.poll(() => page.locator('[data-query-drag-ghost="true"]').count()).toBe(1);
    await expect.poll(() => target.getAttribute("data-query-drop-active")).toBe("true");
    expect(await target.evaluate((element) => element.getBoundingClientRect().height))
      .toBeGreaterThanOrEqual(28);
    await screenshot("17-query-builder-dragging");
    await page.mouse.up();

    const nestedGroup = page.locator('[data-query-group="group-2"]');
    await expect.poll(() => nestedGroup.locator("[data-query-rule]").count()).toBe(3);
    await expect.poll(() => nestedGroup.locator("[data-query-rule]").last().getAttribute("data-query-rule"))
      .toBe("rule-1");

    const keyboardHandle = page.locator('[data-draggable-id="query-rule:rule-5"]');
    await keyboardHandle.focus();
    await keyboardHandle.press("Space");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Space");

    await expect.poll(() => nestedGroup.locator("[data-query-rule]").count()).toBe(4);
    await expect.poll(() => nestedGroup.locator("[data-query-rule]").last().getAttribute("data-query-rule"))
      .toBe("rule-5");
    await screenshot("18-query-builder-reordered");
  });

  it("honors reduced motion in the query builder", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${appUrl}/query-builder`, { waitUntil: "networkidle" });
    const motion = await page.locator("[data-query-rule]").first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { duration: style.animationDuration, name: style.animationName };
    });

    expect(motion).toEqual({ duration: "0s", name: "none" });
  });

  it("switches to a horizontal, shareable workflow layout", async () => {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Horizontal" }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/workflow");
    await expect.poll(() => new URL(page.url()).searchParams.get("orientation"))
      .toBe("Horizontal");

    const canvas = page.locator("[data-workflow-canvas]");
    await expect.poll(() => canvas.getAttribute("data-orientation")).toBe("horizontal");
    await expect.poll(() => page.getByRole("button", { name: "Horizontal" }).getAttribute("aria-pressed"))
      .toBe("true");
    await page.waitForTimeout(350);

    const positions = await page.locator("[data-node-id]").evaluateAll((elements) =>
      Object.fromEntries(elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return [element.getAttribute("data-node-id") ?? "", bounds.x];
      })),
    );
    expect(positions["node-start"]).toBeLessThan(positions["node-condition"] ?? 0);
    expect(positions["node-condition"]).toBeLessThan(positions["node-end"] ?? 0);
    await expectNoNodeOverlaps();
    await screenshot("01-horizontal");
  });

  it("highlights a nested drop target and inserts a registered type", async () => {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    const { target } = await drag(
      '[data-draggable-id="palette:approval"]',
      thenTargetSelector,
    );

    await expect.poll(() => target.getAttribute("data-drop-active")).toBe("true");
    await expect.poll(() => target.getByRole("button").locator('[data-lucide-icon="plus"]').count())
      .toBe(1);
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
    await expect.poll(() => employeeHeader.locator('[data-lucide-icon="chevrons-up-down"]').count())
      .toBe(1);
    await employeeHeader.getByRole("button").click();
    await expect.poll(() => employeeHeader.getAttribute("aria-sort")).toBe("ascending");
    await expect.poll(() => employeeHeader.locator('[data-lucide-icon="arrow-up"]').count())
      .toBe(1);
    await employeeHeader.getByRole("button").click();
    await expect.poll(() => employeeHeader.getAttribute("aria-sort")).toBe("descending");
    await expect.poll(() => employeeHeader.locator('[data-lucide-icon="arrow-down"]').count())
      .toBe(1);

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

  it("keeps a field press selectable until deliberate movement starts a drag", async () => {
    await page.goto(`${appUrl}/form-builder?example=Handoff&mode=Editor`, {
      waitUntil: "networkidle",
    });

    const source = page.locator('[data-form-field-id="handoff-name"]');
    const sourceBox = await source.boundingBox();
    expect(sourceBox).not.toBeNull();
    if (sourceBox === null) return;
    const start = {
      x: sourceBox.x + sourceBox.width - 20,
      y: sourceBox.y + 20,
    };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect.poll(() => source.evaluate((element) => getComputedStyle(element).borderStyle))
      .toBe("solid");
    await page.mouse.move(start.x + 6, start.y, { steps: 3 });
    await expect.poll(() => source.evaluate((element) => getComputedStyle(element).borderStyle))
      .toBe("solid");
    await expect.poll(() => page
      .locator('[data-form-editor-canvas="true"] [data-form-drop-kind="field"]')
      .evaluateAll((targets) => targets.every((target) =>
        getComputedStyle(target).borderWidth === "0px"
      )))
      .toBe(true);
    await page.mouse.up();
    await expect.poll(() => page.getByLabel("Label").inputValue()).toBe("Preferred name");

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 10, start.y, { steps: 4 });
    await expect.poll(() => source.evaluate((element) => getComputedStyle(element).borderStyle))
      .toBe("dashed");
    await expect.poll(() => page
      .locator('[data-form-editor-canvas="true"] [data-form-drop-kind="field"]')
      .evaluateAll((targets) => targets.every((target) =>
        target.getBoundingClientRect().height >= 18
      )))
      .toBe(true);
    await page.mouse.move(250, 700);
    await page.mouse.up();
  });

  it("keeps form pages and sections fixed while dragging a field", async () => {
    await page.goto(`${appUrl}/form-builder?example=Handoff&mode=Editor`, {
      waitUntil: "networkidle",
    });

    const structureRectangles = () => page
      .locator("[data-form-section-id], [data-form-page-id]")
      .evaluateAll((elements) => elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          id: element.getAttribute("data-form-section-id") ??
            element.getAttribute("data-form-page-id"),
          height: bounds.height,
          width: bounds.width,
        };
      }));

    const before = await structureRectangles();
    const source = page.locator('[data-form-palette-drag="longText"]');
    const sourceBox = await source.boundingBox();
    expect(sourceBox).not.toBeNull();
    if (sourceBox === null) return;

    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 14, sourceBox.y + 14, {
      steps: 4,
    });

    const receiver = page.locator(
      '[data-form-page-id="handoff-about-you"] [data-form-drop-kind="field"]',
    );
    await expect.poll(() => receiver.count()).toBe(1);
    const receiverBox = await receiver.boundingBox();
    expect(receiverBox).not.toBeNull();
    if (receiverBox !== null) {
      await page.mouse.move(
        receiverBox.x + receiverBox.width / 2,
        receiverBox.y + receiverBox.height / 2,
        { steps: 8 },
      );
    }
    await expect.poll(() => receiver.getAttribute("data-form-drop-active"))
      .toBe("true");

    const canvasTargets = page.locator(
      '[data-form-editor-canvas="true"] [data-form-drop-kind="field"]',
    );
    await expect.poll(() => canvasTargets.evaluateAll((targets) =>
      targets.every((target) => {
        const style = getComputedStyle(target);
        return target.getBoundingClientRect().height >= 18 &&
          style.borderStyle === "dashed";
      })))
      .toBe(true);
    await expect.poll(() => receiver.evaluate((target) => getComputedStyle(target).borderStyle))
      .toBe("solid");
    await expect.poll(() => page
      .locator('[data-form-page-id="handoff-emergency"] [data-form-drop-kind="field"]')
      .evaluate((target) => getComputedStyle(target).borderStyle))
      .toBe("dashed");

    expect(await structureRectangles()).toEqual(before);
    await screenshot("10-form-drag-stable");
    await page.mouse.move(250, 700);
    await page.mouse.up();
  });

  it("undoes, redoes, and restores autosaved form drafts", async () => {
    await page.goto(`${appUrl}/form-builder?example=Handoff&mode=Editor`, {
      waitUntil: "networkidle",
    });
    const field = page.locator('[data-form-field-id="handoff-name"]');
    await field.click();
    await page.getByLabel("Label").fill("Display name");
    await expect.poll(() => field.getByText("Display name", { exact: false }).count()).toBe(1);
    await expect.poll(() => page.getByRole("button", { name: "Undo" }).isEnabled()).toBe(true);
    await expect.poll(() => page
      .getByRole("button", { name: "Undo" })
      .locator('[data-lucide-icon="undo-2"]')
      .count()).toBe(1);

    await page.keyboard.press("Control+z");
    await expect.poll(() => field.getByText("Preferred name", { exact: false }).count()).toBe(1);
    await expect.poll(() => page.getByRole("button", { name: "Redo" }).isEnabled()).toBe(true);

    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => field.getByText("Display name", { exact: false }).count()).toBe(1);
    await expect.poll(() => page.evaluate(() =>
      window.localStorage.getItem("foldworks-demo-documents-v1")?.includes("Display name"),
    )).toBe(true);

    await page.reload({ waitUntil: "networkidle" });
    await expect.poll(() => page
      .locator('[data-form-field-id="handoff-name"]')
      .getByText("Display name", { exact: false })
      .count()).toBe(1);

    await page.getByLabel("Example form").selectOption("Simple");
    await expect.poll(() => page.getByRole("heading", { name: "Contact details", level: 1 }).isVisible())
      .toBe(true);
    await page.getByLabel("Example form").selectOption("Handoff");
    await expect.poll(() => page
      .locator('[data-form-field-id="handoff-name"]')
      .getByText("Display name", { exact: false })
      .count()).toBe(1);
  });

  it("exports, validates, imports, and undoes form JSON", async () => {
    await page.goto(`${appUrl}/form-builder?example=Handoff&mode=Editor`, {
      waitUntil: "networkidle",
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("new-hire-handoff.form.json");
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath === null) return;
    const exported = JSON.parse(await readFile(downloadPath, "utf8"));
    expect(exported.kind).toBe("form");
    exported.document.title = "Imported workflow";

    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import" }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: "imported.form.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exported)),
    });
    await expect.poll(() => page.getByRole("heading", { name: "Imported workflow" }).count())
      .toBe(1);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => page.getByRole("heading", { name: "New hire workflow" }).count())
      .toBe(1);

    const invalidChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import" }).click();
    const invalidChooser = await invalidChooserPromise;
    await invalidChooser.setFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"kind":"workflow"}'),
    });
    await expect.poll(() => page.getByText("That file is not a valid form export.").count())
      .toBe(1);
    await expect.poll(() => page.getByRole("heading", { name: "New hire workflow" }).count())
      .toBe(1);
  });

  it("undoes, redoes, and restores autosaved workflow edits", async () => {
    await page.goto(`${appUrl}/workflow`, { waitUntil: "networkidle" });
    await expect.poll(() => page.locator("[data-node-id]").count()).toBe(5);
    await page.locator("[data-location-id]").first().getByRole("button").click();
    await expect.poll(() => page.locator("[data-node-id]").count()).toBe(6);

    await page.keyboard.press("Control+z");
    await expect.poll(() => page.locator("[data-node-id]").count()).toBe(5);
    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => page.locator("[data-node-id]").count()).toBe(6);
    await expect.poll(() => page.evaluate(() =>
      window.localStorage.getItem("foldworks-demo-documents-v1") !== null,
    )).toBe(true);

    await page.reload({ waitUntil: "networkidle" });
    await expect.poll(() => page.locator("[data-node-id]").count()).toBe(6);
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
    await page.getByRole("button", { name: "Reset example" }).click();
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

  it("showcases every Foldkit UI primitive and its interactive variants", async () => {
    await page.goto(`${appUrl}/ui-kit`, { waitUntil: "networkidle" });

    await expect.poll(() => new URL(page.url()).pathname).toBe("/ui-kit");
    const showcase = page.locator('[data-ui-kit="true"]');
    await expect.poll(() => showcase.isVisible()).toBe(true);

    for (const heading of [
      "Button",
      "Badge",
      "Icon",
      "Field and Select",
      "Selection controls",
      "Panel and Layout",
      "Toolbar",
      "Semantic tokens",
    ]) {
      await expect.poll(() => showcase.getByRole("heading", { name: heading }).count())
        .toBe(1);
    }
    await expect.poll(() => showcase.locator("[data-lucide-icon]").count())
      .toBeGreaterThanOrEqual(7);

    await expect.poll(() => showcase.getByRole("button", { name: "Disabled" }).isDisabled())
      .toBe(true);
    await showcase.getByLabel("Display name").fill("Avery Stone");
    await expect.poll(() => showcase.getByLabel("Display name").inputValue())
      .toBe("Avery Stone");

    await showcase.getByLabel("Department", { exact: true }).selectOption("Operations");
    await expect.poll(() => showcase.getByLabel("Compact department").inputValue())
      .toBe("Operations");

    await showcase.getByRole("button", { name: "Activity" }).click();
    await expect.poll(() => showcase.getByRole("button", { name: "Activity" }).getAttribute("aria-pressed"))
      .toBe("true");

    await screenshot("12-ui-kit");
  });

  it("persists the theme preference and keeps application colors semantic in dark mode", async () => {
    await page.goto(`${appUrl}/ui-kit`, { waitUntil: "networkidle" });
    const themeSelect = page.getByLabel("Color theme");
    await themeSelect.selectOption("Dark");

    await expect.poll(() => page.locator("html").getAttribute("class")).toContain("dark");
    await expect.poll(() => page.locator("html").getAttribute("data-theme-preference"))
      .toBe("dark");
    await expect.poll(() => page.evaluate(() =>
      window.localStorage.getItem("foldworks-demo-theme"),
    )).toBe("Dark");

    const darkTokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        background: style.getPropertyValue("--background").trim(),
        selection: style.getPropertyValue("--foldworks-ui-selection").trim(),
        dropTarget: style.getPropertyValue("--foldworks-ui-drop-target-active").trim(),
      };
    });
    expect(darkTokens).toEqual({
      background: "oklch(14.5% 0 0)",
      selection: "oklch(27% .045 156)",
      dropTarget: "oklch(29% .055 156)",
    });
    await screenshot("13-ui-kit-dark");

    await page.reload({ waitUntil: "networkidle" });
    await expect.poll(() => page.locator("html").getAttribute("class")).toContain("dark");

    await page.goto(`${appUrl}/workflow`, { waitUntil: "networkidle" });
    await expect.poll(() => page.locator('[data-node-id="node-start"]').isVisible()).toBe(true);
    await screenshot("14-workflow-dark");
    const { target: darkWorkflowTarget } = await drag(
      '[data-draggable-id="palette:approval"]',
      thenTargetSelector,
    );
    await expect.poll(() => darkWorkflowTarget.getAttribute("data-drop-active"))
      .toBe("true");
    await screenshot("14-workflow-drop-dark");
    await page.mouse.move(260, 700);
    await page.mouse.up();

    await page.goto(`${appUrl}/data-grid`, { waitUntil: "networkidle" });
    await expect.poll(() => page.locator('[data-grid-id="people-directory"]').isVisible()).toBe(true);
    await screenshot("15-data-grid-dark");

    await page.goto(`${appUrl}/query-builder`, { waitUntil: "networkidle" });
    await expect.poll(() => page.locator('[data-query-builder="employee-query"]').isVisible())
      .toBe(true);
    await screenshot("16-query-builder-dark");

    await page.goto(`${appUrl}/form-builder?example=Handoff&mode=Editor`, {
      waitUntil: "networkidle",
    });
    await expect.poll(() => page.locator('[data-form-editor-canvas="true"]').isVisible())
      .toBe(true);
    await screenshot("16-form-builder-dark");
    const darkFormSource = page.locator('[data-form-palette-drag="longText"]');
    const darkFormSourceBox = await darkFormSource.boundingBox();
    expect(darkFormSourceBox).not.toBeNull();
    if (darkFormSourceBox === null) return;
    await page.mouse.move(
      darkFormSourceBox.x + darkFormSourceBox.width / 2,
      darkFormSourceBox.y + darkFormSourceBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      darkFormSourceBox.x + darkFormSourceBox.width / 2 + 14,
      darkFormSourceBox.y + 14,
      { steps: 4 },
    );
    const darkFormTarget = page.locator(
      '[data-form-page-id="handoff-about-you"] [data-form-drop-kind="field"]',
    );
    await expect.poll(() => darkFormTarget.count()).toBe(1);
    const darkFormTargetBox = await darkFormTarget.boundingBox();
    expect(darkFormTargetBox).not.toBeNull();
    if (darkFormTargetBox === null) return;
    await page.mouse.move(
      darkFormTargetBox.x + darkFormTargetBox.width / 2,
      darkFormTargetBox.y + darkFormTargetBox.height / 2,
      { steps: 8 },
    );
    await expect.poll(() => darkFormTarget.getAttribute("data-form-drop-active"))
      .toBe("true");
    await screenshot("17-form-drop-dark");
    await page.mouse.move(250, 700);
    await page.mouse.up();

    await page.getByLabel("Color theme").selectOption("Light");
    await expect.poll(() => page.locator("html").getAttribute("class"))
      .not.toContain("dark");

    await page.emulateMedia({ colorScheme: "dark" });
    await page.getByLabel("Color theme").selectOption("System");
    await expect.poll(() => page.locator("html").getAttribute("class")).toContain("dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => page.locator("html").getAttribute("class"))
      .not.toContain("dark");
  }, 60_000);
});
