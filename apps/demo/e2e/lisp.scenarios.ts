import type { Page } from "playwright";
import { expect, it } from "vitest";
import type { CodeEditor } from "@foldworks/code-editor";

const file = (page: Page) => page.getByRole("textbox", { name: "ledger.clj", exact: true });
const repl = (page: Page) => page.getByRole("textbox", { name: "REPL input", exact: true });
const snapshot = (page: Page, id = "lisp-file") =>
  page
    .locator(`#${id}`)
    .evaluate(
      (element) =>
        (element as HTMLTextAreaElement & { foldkitNative: CodeEditor.Model }).foldkitNative,
    );
const caret = async (page: Page, needle: string, delta: number) => {
  const text = (await snapshot(page)).document.text;
  const offset = text.indexOf(needle) + delta;
  await file(page).evaluate((element, offset) => {
    const area = element as HTMLTextAreaElement;
    area.focus();
    area.setSelectionRange(offset, offset);
    area.dispatchEvent(new Event("select"));
  }, offset);
  await expect.poll(async () => (await snapshot(page)).selection.head).toBe(offset);
};
// Read annotations from the model: the editor only renders lines near the viewport.
const labels = async (page: Page, filter: "all" | "error" | "stale" = "all") =>
  (await snapshot(page)).annotations
    .filter((item) =>
      filter === "all" ? true : filter === "error" ? item.tone === "error" : item.stale,
    )
    .map((item) => item.label);

export const lispScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
): void => {
  it("evaluates Lisp forms inline, edits structurally, and keeps a REPL transcript", async () => {
    const page = getPage();
    await page.goto(`${appUrl}/lisp`, { waitUntil: "networkidle" });
    await expect.poll(async () => (await snapshot(page)).status).toBe("Ready");
    await expect.poll(() => labels(page)).toContain("118");

    // Cmd/Ctrl + Enter evaluates the form at the cursor, including forms in a rich comment.
    await caret(page, '(parse-row "oops")', 3);
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect
      .poll(() => page.locator(".lisp-entry__source").allTextContents())
      .toEqual(['(parse-row "oops")']);
    await expect
      .poll(() => labels(page, "error"))
      .toEqual(["parse-double expects a string, got nil."]);

    // Typing stays balanced: openers pair, closers leave the form, and live results follow.
    await caret(page, "(total rows)\n", 12);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("(* 2 (total rows");
    await page.keyboard.type(") 3");
    await expect
      .poll(async () => (await snapshot(page)).document.text)
      .toContain("(* 2 (total rows) 3)");
    await expect.poll(() => labels(page)).toContain("708");
    await page.keyboard.press("Control+Alt+ArrowLeft");
    await expect
      .poll(async () => (await snapshot(page)).document.text)
      .toContain("(* 2 (total rows)) 3");

    // With live evaluation off, an edited form's result dims as stale.
    await page.getByRole("switch", { name: "Live evaluation" }).click();
    await caret(page, "(total rows)\n", 7);
    await page.keyboard.type("x");
    await expect.poll(() => labels(page, "stale")).toEqual(["118"]);

    // The REPL shares the file's image and renders sequences of maps as tables.
    await repl(page).focus();
    await page.keyboard.type("(take 2 rows");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect.poll(() => repl(page).inputValue()).toBe("");
    await expect
      .poll(() => page.locator(".lisp-entry__table th").allTextContents())
      .toEqual([":date", ":category", ":amount"]);
    await screenshot("lisp-repl");
  }, 60_000);
};
