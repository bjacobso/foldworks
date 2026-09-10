import { resolve } from "node:path";
import { chromium, firefox, webkit, type Browser, type Page } from "playwright";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { build, preview, type PreviewServer } from "vite";

const appRoot = resolve(import.meta.dirname, "..");
const outDir = resolve(appRoot, "../../.context/editor-e2e-dist");
let browser: Browser;
let page: Page;
let server: PreviewServer;
const errors: string[] = [];
const root = () => page.locator(".fw-editor__content");
const select = async (
  startIndex: number,
  startOffset: number,
  endIndex = startIndex,
  endOffset = startOffset,
) => {
  await page.locator("[data-text-id]").evaluateAll(
    (nodes, args) => {
      const point = (element: Element, offset: number): [Node, number] => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let text: Node | null;
        while ((text = walker.nextNode())) {
          if (offset <= (text.textContent?.length ?? 0)) return [text, offset];
          offset -= text.textContent?.length ?? 0;
        }
        return [element, 0];
      };
      const [a, ao] = point(nodes[args.startIndex]!, args.startOffset);
      const [f, fo] = point(nodes[args.endIndex]!, args.endOffset);
      (nodes[0]!.closest("[contenteditable]") as HTMLElement).focus();
      document.getSelection()!.setBaseAndExtent(a, ao, f, fo);
    },
    { startIndex, startOffset, endIndex, endOffset },
  );
  await page.waitForTimeout(30);
};
const source = async (value: string) => {
  await page
    .getByRole("button", { name: "Markdown source", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Markdown source", exact: true })
    .fill(value);
  await page.getByRole("button", { name: "Apply source", exact: true }).click();
  await expect
    .poll(() =>
      page
        .getByRole("textbox", { name: "Markdown source", exact: true })
        .count(),
    )
    .toBe(0);
};
const exported = async () => {
  await page
    .getByRole("button", { name: "Export Markdown", exact: true })
    .click();
  return page.getByRole("textbox", { name: "Exported Markdown" }).inputValue();
};

describe.sequential("native document editor", () => {
  beforeAll(async () => {
    await build({
      root: appRoot,
      logLevel: "silent",
      build: {
        outDir,
        emptyOutDir: true,
        rollupOptions: {
          input: {
            app: resolve(appRoot, "index.html"),
            fixture: resolve(appRoot, "e2e/fixtures/editor.html"),
          },
        },
      },
    });
    server = await preview({
      root: appRoot,
      logLevel: "silent",
      build: { outDir },
      preview: { host: "127.0.0.1", port: 4176, strictPort: true },
    });
    browser =
      process.env.EDITOR_BROWSER === "firefox"
        ? await firefox.launch({ headless: true })
        : process.env.EDITOR_BROWSER === "webkit"
          ? await webkit.launch({ headless: true })
          : await chromium.launch({ channel: "chrome", headless: true });
  }, 120000);
  beforeEach(async () => {
    errors.length = 0;
    page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4176/editor", {
      waitUntil: "networkidle",
    });
  });
  afterEach(async () => {
    await page.close();
    expect(errors).toEqual([]);
  });
  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it("types rapidly, splits, joins, deletes emoji, and undoes with a stable host", async () => {
    await source("Hello");
    await root().evaluate((element) => {
      (window as any).editorHost = element;
    });
    await select(0, 5);
    await page.keyboard.type(" world");
    await expect
      .poll(() => page.locator("[data-text-id]").first().textContent())
      .toBe("Hello world");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("👨‍👩‍👧‍👦");
    await page.keyboard.press("Backspace");
    await expect
      .poll(() => page.locator("[data-text-id]").nth(1).textContent())
      .toBe("");
    await page.keyboard.press("Backspace");
    await expect.poll(() => page.locator("[data-text-id]").count()).toBe(1);
    await page.keyboard.press("Control+z");
    await expect.poll(() => page.locator("[data-text-id]").count()).toBe(2);
    expect(
      await root().evaluate(
        (element) => element === (window as any).editorHost,
      ),
    ).toBe(true);
  });

  it("formats a backward cross-block selection and preserves it through toolbar focus", async () => {
    await source("Alpha\n\nOmega");
    await select(1, 3, 0, 2);
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    expect(await exported()).toContain("Al**pha**");
    await select(1, 3, 0, 2);
    await page.keyboard.type("!");
    await expect.poll(() => page.locator("[data-text-id]").count()).toBe(1);
    expect(await page.locator("[data-text-id]").first().textContent()).toBe(
      "Al!ga",
    );
  });

  it("mounts application Foldkit block views, edits attributes, moves and undoes", async () => {
    await expect
      .poll(() => page.getByRole("textbox", { name: "Project label" }).count())
      .toBe(1);
    await page
      .getByRole("textbox", { name: "Project label" })
      .fill("New launch");
    await page.getByRole("textbox", { name: "Project label" }).press("Tab");
    await page
      .getByRole("combobox", { name: "Project status" })
      .selectOption("Complete");
    expect(await exported()).toContain("New launch");
    expect(await exported()).toContain('status="Complete"');
    const project = page.locator(".fw-editor__block--project");
    const ids = () =>
      page
        .locator("[data-top-block]")
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLElement).dataset.topBlock),
        );
    const before = await ids();
    await project.locator("[data-drag-block]").click();
    await project.getByRole("button", { name: "Move up", exact: true }).click();
    expect(await ids()).not.toEqual(before);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(ids).toEqual(before);
    await project.locator("[data-drag-block]").click();
    await project
      .getByRole("button", { name: "Duplicate", exact: true })
      .click();
    await expect
      .poll(() => page.getByRole("textbox", { name: "Project label" }).count())
      .toBe(2);
  });

  it("inserts from the slash menu and preserves custom directives on export", async () => {
    await source("Start\n\n");
    await select(0, 5);
    await page.keyboard.press("Enter");
    await page.keyboard.type("/call");
    await expect
      .poll(() =>
        page.getByRole("group", { name: "Insert a block" }).isVisible(),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Callout", exact: true }).click();
    await page.keyboard.type("A note");
    expect(await exported()).toContain(":::foldworks-callout");
    expect(await exported()).toContain("A note");
  });

  it("retains unsupported source on failure and restores the document on cancel", async () => {
    await source("Keep this");
    await page
      .getByRole("button", { name: "Markdown source", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Markdown source", exact: true })
      .fill('::foldworks-unknown{version="1"}');
    await page
      .getByRole("button", { name: "Apply source", exact: true })
      .click();
    expect(await page.getByRole("alert").textContent()).toContain("Unknown");
    await page
      .getByRole("button", { name: "Cancel source", exact: true })
      .click();
    expect(await root().textContent()).toContain("Keep this");
  });

  it("reconciles a native composition without replacing its DOM until commit", async () => {
    await source("A");
    await select(0, 1);
    await root().evaluate((element) =>
      element.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      ),
    );
    await page
      .locator("[data-text-id]")
      .first()
      .evaluate((element) => {
        (window as any).composingText = element.firstChild;
        element.firstChild!.textContent = "A日本";
        document
          .getSelection()!
          .setBaseAndExtent(element.firstChild!, 3, element.firstChild!, 3);
        element.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertCompositionText",
            isComposing: true,
            data: "日本",
          }),
        );
      });
    await page
      .getByRole("combobox", { name: "Theme", exact: true })
      .selectOption("Blue");
    expect(
      await page
        .locator("[data-text-id]")
        .first()
        .evaluate(
          (element) => element.firstChild === (window as any).composingText,
        ),
    ).toBe(true);
    await root().evaluate((element) =>
      element.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true, data: "日本" }),
      ),
    );
    await page.waitForTimeout(50);
    expect(await exported()).toContain("A日本");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(() => page.locator("[data-text-id]").first().textContent())
      .toBe("A");
  });

  it("supports Markdown file import, read-only mode, and route teardown/remount", async () => {
    await page.getByLabel("Import Markdown file").setInputFiles({
      name: "note.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Imported\n\nFile content"),
    });
    await expect
      .poll(() => page.locator("[data-text-id]").first().textContent())
      .toBe("Imported");
    await page.getByRole("button", { name: "Read only", exact: true }).click();
    await expect
      .poll(() => root().getAttribute("contenteditable"))
      .toBe("false");
    await page.getByRole("link", { name: "Data grid", exact: true }).click();
    await expect.poll(() => root().count()).toBe(0);
    await page
      .getByRole("link", { name: "Document editor", exact: true })
      .click();
    await expect.poll(() => root().count()).toBe(1);
    expect(await root().textContent()).toContain("File content");
    await page
      .getByRole("button", { name: "Edit document", exact: true })
      .click();
    await select(0, 8);
    await page.keyboard.type(" again");
    expect(await exported()).toContain("# Imported again");
  });

  it("isolates two editors and their undo histories", async () => {
    await page.goto("http://127.0.0.1:4176/e2e/fixtures/editor.html", {
      waitUntil: "networkidle",
    });
    const first = page.locator('[data-editor-id="first"]');
    const second = page.locator('[data-editor-id="second"]');
    await first.locator("[data-text-id]").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" changed");
    await second.locator("[data-text-id]").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" updated");
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => second.locator("[data-text-id]").textContent())
      .toBe("Second");
    expect(await first.locator("[data-text-id]").textContent()).toBe(
      "First 0 changed",
    );
  });

  it("keeps labeled block actions open across pointer movement and acts on the outlined block", async () => {
    await source("Alpha\n\nBeta\n\nGamma");
    const blocks = page.locator("[data-top-block]");
    const handle = blocks.nth(1).locator("[data-drag-block]");
    const panel = page.getByRole("group", {
      name: "Text · Block 2 actions",
      exact: true,
    });
    await handle.click();
    await page.mouse.move(10, 10);
    expect(await panel.isVisible()).toBe(true);
    expect(await panel.locator("p").textContent()).toBe("Beta");
    expect(await page.locator("[data-actions-open]").count()).toBe(1);
    expect(await blocks.nth(1).getAttribute("data-actions-open")).toBe("true");
    expect(
      await blocks
        .nth(1)
        .evaluate((node) => getComputedStyle(node).outlineWidth),
    ).toBe("2px");
    await panel.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect
      .poll(() => page.locator("[data-text-id]").allTextContents())
      .toEqual(["Alpha", "Beta", "Beta", "Gamma"]);
    expect(await page.locator("[data-actions-open]").count()).toBe(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await handle.focus();
    await page.keyboard.press("Enter");
    expect(
      await panel
        .getByRole("button", { name: "Move up", exact: true })
        .evaluate((node) => node === document.activeElement),
    ).toBe(true);
    await page.keyboard.press("Escape");
    expect(await panel.isVisible()).toBe(false);
    expect(
      await handle.evaluate((node) => node === document.activeElement),
    ).toBe(true);
    await handle.click();
    await blocks.first().locator("[data-text-id]").click();
    expect(await panel.isVisible()).toBe(false);
    await blocks.first().locator("[data-drag-block]").click();
    expect(
      await blocks
        .first()
        .getByRole("button", { name: "Move up", exact: true })
        .isDisabled(),
    ).toBe(true);
  });

  it("fits block action targets and their panel on a narrow screen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await source("Alpha\n\nBeta");
    const handle = page.locator("[data-drag-block]").first();
    const target = await handle.boundingBox();
    expect(target!.width).toBeGreaterThanOrEqual(44);
    expect(target!.height).toBeGreaterThanOrEqual(44);
    await handle.click();
    const panel = page.getByRole("group", {
      name: "Text · Block 1 actions",
      exact: true,
    });
    const bounds = await panel.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    await panel.getByRole("button", { name: "Move down", exact: true }).click();
    await expect
      .poll(() => page.locator("[data-text-id]").allTextContents())
      .toEqual(["Beta", "Alpha"]);
  });

  it("moves a block through native dragging and restores it on undo", async () => {
    await source("One\n\nTwo\n\nThree");
    const nodes = page.locator("[data-top-block]");
    await nodes.first().hover();
    await nodes.first().locator("[data-drag-block]").dragTo(nodes.nth(2));
    await expect
      .poll(() => page.locator("[data-text-id]").allTextContents())
      .not.toEqual(["One", "Two", "Three"]);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(() => page.locator("[data-text-id]").allTextContents())
      .toEqual(["One", "Two", "Three"]);
  });

  it("indents and outdents list items without losing their text", async () => {
    await source("- One\n- Two\n- Three");
    await select(1, 3);
    await page.keyboard.press("Tab");
    await expect
      .poll(() => page.locator(".fw-editor__content ul ul").count())
      .toBe(1);
    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(() => page.locator(".fw-editor__content ul ul").count())
      .toBe(0);
    expect(await page.locator("[data-text-id]").allTextContents()).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });

  it("replaces Select All as one undoable edit and toggles stored bold off", async () => {
    await source("First\n\nSecond");
    await select(0, 0);
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Replacement");
    expect(await page.locator("[data-text-id]").allTextContents()).toEqual([
      "Replacement",
    ]);
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => page.locator("[data-text-id]").allTextContents())
      .toEqual(["First", "Second"]);
    await select(1, 6);
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    await page.keyboard.type(" B");
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    await page.keyboard.type(" plain");
    const markdown = await exported();
    // Markdown may escape boundary whitespace/entities while preserving marks.
    expect(markdown).toContain("plain");
    expect(
      await page
        .locator("[data-text-id]")
        .nth(1)
        .locator("strong")
        .allTextContents(),
    ).toEqual([" B"]);
    expect(await page.locator("[data-text-id]").nth(1).textContent()).toBe(
      "Second B plain",
    );
  });

  it("downloads an actual Markdown file", async () => {
    await source("# Download me\n\nA saved document.");
    await exported();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download document.md" }).click();
    expect((await download).suggestedFilename()).toBe("document.md");
  });
});
