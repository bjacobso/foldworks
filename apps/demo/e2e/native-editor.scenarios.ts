import type { Page } from "playwright";
import { expect, it } from "vitest";
import type { CodeEditor } from "@foldworks/code-editor";
import { jsonSample } from "../src/code-editor/model";
import { yamlSample } from "../src/code-editor/configuration";

const input = (page: Page) => page.getByRole("textbox", { name: "Working document", exact: true });
const editor = (page: Page) => page.locator('[data-native-editor="native-working"]');
const snapshot = (page: Page, id = "native-working") => page.locator(`#${id}`).evaluate((element) => (element as HTMLTextAreaElement & { foldkitNative: CodeEditor.Model }).foldkitNative);
const select = async (page: Page, anchor: number, head: number) => {
  await input(page).evaluate((element, { anchor, head }) => {
    const area = element as HTMLTextAreaElement;
    area.focus(); area.setSelectionRange(Math.min(anchor, head), Math.max(anchor, head), anchor > head ? "backward" : "forward");
    area.dispatchEvent(new Event("select"));
  }, { anchor, head });
  await expect.poll(async () => (await snapshot(page)).selection).toEqual({ anchor, head });
};

export const nativeEditorScenarios = (getPage: () => Page, appUrl: string, screenshot: (name: string) => Promise<void>): void => {
  const open = async () => {
    const page = getPage();
    await page.goto(`${appUrl}/code-editor`, { waitUntil: "networkidle" });
    await expect.poll(async () => (await snapshot(page)).status).toBe("Ready");
    return page;
  };
  it("native editor is the default and saves application snapshots", async () => {
    const page = await open();
    expect(await page.getByRole("group", { name: "Editor implementation" }).count()).toBe(0);
    expect(await page.locator(".native-editor").count()).toBe(2);
    await input(page).fill('{"saved": true}');
    await expect.poll(async () => (await snapshot(page)).document.text).toBe('{"saved": true}');
    await expect.poll(() => page.getByRole("button", { name: "Save snapshot" }).isEnabled()).toBe(true);
    await page.getByRole("button", { name: "Save snapshot" }).click();
    await expect.poll(() => page.getByRole("button", { name: "Save snapshot" }).isDisabled()).toBe(true);
    await page.getByLabel("Example language").selectOption("typescript");
    await expect.poll(async () => (await snapshot(page)).document.languageId).toBe("typescript");
    await expect.poll(() => page.getByRole("button", { name: "Save snapshot" }).isDisabled()).toBe(true);
  });
  it("native editor renders highlighted Foldkit lines and diagnostic squiggles", async () => {
    const page = await open();
    expect(await editor(page).locator(".native-token--property").count()).toBeGreaterThan(2);
    await input(page).fill('{"broken": }');
    await expect.poll(async () => (await snapshot(page)).document.text).toBe('{"broken": }');
    await expect.poll(() => editor(page).locator(".native-token--issue").count()).toBeGreaterThan(0);
    await editor(page).getByRole("list", { name: "Working document problems" }).getByRole("button").click();
    await expect.poll(async () => (await snapshot(page)).selection.head).toBeGreaterThan(0);
    await input(page).fill(jsonSample);
    await expect.poll(() => editor(page).locator(".native-editor__problems").count()).toBe(0);
    await screenshot("native-editor-light");
  });
  it("native editor validates JSON and YAML against the same Effect Schema", async () => {
    const page = await open();
    const problems = editor(page).getByRole("list", { name: "Working document problems" });
    await input(page).fill(jsonSample.replace('"retryAttempts": 3', '"retryAttempts": 20'));
    await expect.poll(() => problems.getByRole("button").count()).toBe(1);
    expect(await problems.textContent()).toContain("retryAttempts");
    await problems.getByRole("button").click();
    await expect.poll(async () => {
      const model = await snapshot(page);
      return model.document.text.slice(model.selection.anchor, model.selection.head);
    }).toBe("20");
    await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => editor(page).locator(".native-editor__problems").count()).toBe(0);
    await page.getByLabel("Example language").selectOption("yaml");
    await expect.poll(async () => (await snapshot(page)).document.languageId).toBe("yaml");
    await expect.poll(async () => (await snapshot(page)).status).toBe("Ready");
    expect(await editor(page).locator(".native-token--property").count()).toBeGreaterThan(2);
    expect(await editor(page).locator(".native-editor__problems").count()).toBe(0);
    await input(page).fill(yamlSample.replace("validation: true", 'validation: "yes"'));
    await expect.poll(() => problems.getByRole("button").count()).toBe(1);
    expect(await problems.textContent()).toContain("features.validation");
    await problems.getByRole("button").click();
    await expect.poll(async () => {
      const model = await snapshot(page);
      return model.document.text.slice(model.selection.anchor, model.selection.head);
    }).toBe('"yes"');
    await screenshot("native-editor-yaml-validation");
    const sidebar = page.getByRole("complementary", { name: "Foldworks navigation" });
    await sidebar.getByRole("link", { name: "Home", exact: true }).click();
    await sidebar.getByRole("link", { name: "Code editor", exact: true }).click();
    await expect.poll(() => problems.getByRole("button").count()).toBe(1);
    expect(await problems.textContent()).toContain("features.validation");
    await input(page).fill("features: [\n");
    await expect.poll(() => problems.getByRole("button").count()).toBeGreaterThan(0);
    await input(page).fill(yamlSample);
    await expect.poll(() => editor(page).locator(".native-editor__problems").count()).toBe(0);
  });
  it("native editor handles rapid typing, own undo and redo, and Unicode input", async () => {
    const page = await open();
    await page.getByLabel("Example language").selectOption("text");
    await expect.poll(async () => (await snapshot(page)).document.languageId).toBe("text");
    await expect.poll(async () => (await snapshot(page)).status).toBe("Ready");
    await input(page).fill("");
    await expect.poll(async () => (await snapshot(page)).document.text).toBe("");
    await input(page).pressSequentially("const editor = foldkit", { delay: 0 });
    await expect.poll(async () => (await snapshot(page)).document.text).toBe("const editor = foldkit");
    await input(page).press("ControlOrMeta+z");
    await expect.poll(async () => (await snapshot(page)).document.text).toBe("");
    await input(page).press("ControlOrMeta+Shift+z");
    await expect.poll(async () => (await snapshot(page)).document.text).toBe("const editor = foldkit");
    await page.keyboard.insertText(" 😀 café 👩‍💻");
    await expect.poll(async () => (await snapshot(page)).document.text).toBe("const editor = foldkit 😀 café 👩‍💻");
    await page.getByLabel("Appearance", { exact: true }).selectOption("Dark");
    expect(await input(page).inputValue()).toBe("const editor = foldkit 😀 café 👩‍💻");
    await screenshot("native-editor-dark");
  });
  it("native editor pairs brackets, indents newlines and selected lines, and keeps Tab accessible", async () => {
    const page = await open();
    await input(page).fill("");
    await expect.poll(async () => (await snapshot(page)).document.text).toBe("");
    await input(page).pressSequentially("{");
    await expect.poll(() => input(page).inputValue()).toBe("{}");
    await input(page).press("Enter");
    await expect.poll(() => input(page).inputValue()).toBe("{\n  \n}");
    await expect.poll(async () => (await snapshot(page)).selection.head).toBe(4);
    await input(page).fill("one\ntwo\nthree");
    await select(page, 8, 0);
    await editor(page).getByRole("button", { name: "Indent", exact: true }).click();
    await expect.poll(() => input(page).inputValue()).toBe("  one\n  two\nthree");
    await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).selection).toEqual({ anchor: 8, head: 0 });
    await input(page).press("Tab");
    expect(await input(page).evaluate((element) => element === document.activeElement)).toBe(false);
  });
  it("native editor finds, replaces, undoes replacement, and accepts word suggestions", async () => {
    const page = await open();
    await input(page).fill("const customWidget = 1;\ncustomWidget;");
    const originalInput = await input(page).elementHandle();
    await input(page).press("ControlOrMeta+f");
    const find = page.getByRole("textbox", { name: "Working document find", exact: true });
    await expect.poll(() => find.evaluate((element) => element === document.activeElement)).toBe(true);
    expect(await originalInput!.evaluate((element) => element === document.querySelector("#native-working"))).toBe(true);
    await find.fill("customWidget");
    await page.getByRole("textbox", { name: "Working document replace with", exact: true }).fill("nativeEditor");
    await editor(page).getByRole("button", { name: "Replace all", exact: true }).click();
    await expect.poll(() => input(page).inputValue()).toBe("const nativeEditor = 1;\nnativeEditor;");
    await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => input(page).inputValue()).toBe("const customWidget = 1;\ncustomWidget;");
    await input(page).fill("customWidget ".repeat(1200));
    await expect.poll(async () => (await snapshot(page)).document.text).toBe("customWidget ".repeat(1200));
    await editor(page).getByRole("button", { name: "Replace all", exact: true }).click();
    await expect.poll(() => input(page).inputValue()).toBe("nativeEditor ".repeat(1200));
    await editor(page).getByRole("button", { name: "Close search" }).click();
    await expect.poll(() => editor(page).locator(".native-editor__search").count()).toBe(0);
    expect(await originalInput!.evaluate((element) => element === document.querySelector("#native-working"))).toBe(true);
    await input(page).fill("const customWidget = 1;\ncust");
    await input(page).press("Control+Space");
    await expect.poll(() => editor(page).getByRole("option").count()).toBe(1);
    await editor(page).getByRole("button", { name: "customWidget", exact: true }).click();
    await expect.poll(() => input(page).inputValue()).toBe("const customWidget = 1;\ncustomWidget");
    await input(page).fill("ret");
    await input(page).press("Control+Space");
    await input(page).press("Enter");
    await expect.poll(() => input(page).inputValue()).toBe("return");
  });
  it("native editor commits composition as one undo group and accepts multiline clipboard text", async () => {
    const page = await open();
    await input(page).fill("");
    await expect.poll(async () => (await snapshot(page)).document.text).toBe("");
    await input(page).evaluate((element) => {
      const area = element as HTMLTextAreaElement;
      area.dispatchEvent(new CompositionEvent("compositionstart"));
      for (const text of ["に", "日本", "日本語"]) {
        area.value = text; area.setSelectionRange(text.length, text.length);
        area.dispatchEvent(new InputEvent("input", { inputType: "insertCompositionText", isComposing: true }));
      }
      area.dispatchEvent(new CompositionEvent("compositionend", { data: "日本語" }));
    });
    await expect.poll(async () => (await snapshot(page)).document.text).toBe("日本語");
    await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => input(page).inputValue()).toBe("");
    await expect.poll(async () => (await snapshot(page)).document.text).toBe("");
    const groupsBefore = (await snapshot(page)).past.length;
    await input(page).evaluate((element) => {
      const area = element as HTMLTextAreaElement;
      area.dispatchEvent(new CompositionEvent("compositionstart"));
      for (const text of ["n", ""]) {
        area.value = text; area.setSelectionRange(text.length, text.length);
        area.dispatchEvent(new InputEvent("input", { inputType: "insertCompositionText", isComposing: true }));
      }
      area.dispatchEvent(new CompositionEvent("compositionend"));
    });
    await expect.poll(async () => (await snapshot(page)).past.length).toBe(groupsBefore + 1);
    await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).past.length).toBe(groupsBefore);
    expect(await input(page).inputValue()).toBe("");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const pasted = "// clipboard\nconst greeting = '😀';\n";
    await page.evaluate((text) => navigator.clipboard.writeText(text), pasted);
    await input(page).focus(); await input(page).press("ControlOrMeta+v");
    await expect.poll(async () => (await snapshot(page)).document.text).toBe(pasted);
    await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => input(page).inputValue()).toBe("");
  });
  it("native editor virtualizes 2,000 lines and aligns the gutter after scrolling", async () => {
    const page = await open();
    await page.getByRole("button", { name: "Load 2,000 lines" }).click();
    await expect.poll(async () => (await snapshot(page)).lines.length).toBe(2000);
    expect(await editor(page).locator("[data-native-line]").count()).toBeLessThan(40);
    await input(page).evaluate((element) => { element.scrollTop = 22000; element.dispatchEvent(new Event("scroll")); });
    await expect.poll(async () => Number(await editor(page).locator("[data-native-line]").first().getAttribute("data-native-line"))).toBeGreaterThan(980);
    const delta = await editor(page).evaluate((element) => Math.abs(element.querySelector("[data-native-line]")!.getBoundingClientRect().top - element.querySelector("[data-native-number]")!.getBoundingClientRect().top));
    expect(delta).toBeLessThan(1);
    await page.getByLabel("Working document go to line", { exact: true }).fill("2000");
    await editor(page).getByRole("button", { name: "Go", exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).selection.head).toBe((await snapshot(page)).starts[1999]);
    await expect.poll(() => editor(page).locator('[data-native-line="1999"]').count()).toBe(1);
    await editor(page).getByText("Explore editor state", { exact: true }).click();
    await screenshot("native-editor-large");
  });
  it("native editor preserves history across remounts and keeps instances independent", async () => {
    const page = await open();
    const reference = page.getByRole("textbox", { name: "TypeScript reference", exact: true });
    const initialReference = await reference.inputValue();
    await reference.focus(); await page.keyboard.type("ignored");
    expect(await reference.inputValue()).toBe(initialReference);
    await page.getByRole("button", { name: "Enable reference editing" }).click();
    await expect.poll(() => reference.evaluate((element) => (element as HTMLTextAreaElement).readOnly)).toBe(false);
    await reference.press("ControlOrMeta+End"); await page.keyboard.insertText("// independent");
    await expect.poll(() => reference.inputValue()).toBe(initialReference + "// independent");
    await input(page).fill("preserved");
    const prior = await input(page).elementHandle();
    const sidebar = page.getByRole("complementary", { name: "Foldworks navigation" });
    await sidebar.getByRole("link", { name: "Home", exact: true }).click();
    await expect.poll(() => prior!.evaluate((element) => "nativeRequest" in element)).toBe(false);
    await sidebar.getByRole("link", { name: "Code editor", exact: true }).click();
    await expect.poll(() => input(page).inputValue()).toBe("preserved");
    await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => input(page).inputValue()).not.toBe("preserved");
    expect(await reference.inputValue()).toBe(initialReference + "// independent");
  });
  it("native editor wraps on a narrow viewport without misaligning logical line numbers", async () => {
    const page = await open();
    await page.setViewportSize({ width: 390, height: 844 });
    await input(page).fill('const message = "' + "A long line with spaces. ".repeat(8) + '";\nconst second = 2;');
    await page.getByRole("button", { name: "Wrap lines", exact: true }).click();
    await expect.poll(async () => {
      return editor(page).evaluate((element) => {
        const line = element.querySelector('[data-native-line="1"]')!.getBoundingClientRect();
        const gutter = element.querySelector('[data-native-number="1"]')!.getBoundingClientRect();
        return Math.abs(line.top - gutter.top);
      });
    }).toBeLessThan(1);
    expect(await page.locator(".code-demo").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await screenshot("native-editor-mobile");
  });
};
