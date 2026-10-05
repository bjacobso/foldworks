import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

/** The value, warning, or error shown at the end of the row whose text is `text`. */
const valueOf = (page: Page, text: string) =>
  page.locator("[data-outline-row]").evaluateAll(
    (rows, wanted) =>
      rows
        .find((row) => row.querySelector("textarea")?.value === wanted)
        ?.querySelector(".fw-outliner__accessory")
        ?.textContent?.trim() ?? null,
    text,
  );

/** The visible outline as indented text. */
const outline = (page: Page) =>
  page
    .locator("[data-outline-row]")
    .evaluateAll((rows) =>
      rows.map(
        (row) =>
          `${"  ".repeat(Number(row.getAttribute("aria-level")) - 1)}${row.querySelector("textarea")?.value ?? ""}`,
      ),
    );

/** Rests the pointer on a word in the painted text of the row whose text is `text`. */
const pointAt = async (page: Page, text: string, word: string) => {
  const point = await page.locator("[data-outline-mirror]").evaluateAll(
    (mirrors, [wanted, target]) => {
      const mirror = mirrors.find(
        (element) => element.parentElement?.querySelector("textarea")?.value === wanted,
      );
      const span = [...(mirror?.querySelectorAll("span") ?? [])].find(
        (element) => element.textContent === target,
      );
      const rect = span?.getBoundingClientRect();
      return rect === undefined
        ? null
        : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    },
    [text, word] as const,
  );
  if (point === null) throw new Error(`No ${word} in ${text}`);
  await page.mouse.move(point.x, point.y);
};

const suggestions = (page: Page) =>
  page.locator('.fw-completion [role="option"]').allTextContents();

const hoverText = (page: Page) =>
  page.locator(".fw-hover").evaluateAll((popups) => popups[0]?.textContent ?? null);

export const lispScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
) => {
  describe("structural lisp", () => {
    const start = async () => {
      const page = getPage();
      await page.goto(`${appUrl}/lisp`, { waitUntil: "networkidle" });
      await expect.poll(() => valueOf(page, "invoice-total 100")).toBe("→108.25");
      return page;
    };
    const text = (page: Page, value: string) => page.locator(`textarea:text-is("${value}")`);

    it("evaluates every row as it is typed", async () => {
      const page = await start();
      expect(await valueOf(page, "round (+ revenue tax) 2")).toBe("→1299×4");
      await text(page, "invoice-total 100").click();
      await page.keyboard.press("End");
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      await page.keyboard.type("50");
      await expect.poll(() => valueOf(page, "invoice-total 150")).toBe("→162.38");
      await page.keyboard.press("Enter");
      await page.keyboard.type("(+ 1 tax-rat)");
      await expect.poll(() => valueOf(page, "(+ 1 tax-rat)")).toBe("tax-rat is not defined");
      // The rest of the section keeps running.
      expect(await valueOf(page, "map invoice-total [40 250 1200]")).toBe("→[43.3 270.63 1299]");
    });

    it("describes the token under the pointer or the caret", async () => {
      const page = await start();
      await pointAt(page, "round (+ revenue tax) 2", "revenue");
      await expect.poll(() => hoverText(page)).toBe("revenuelocalnumber1200last of 4");
      await screenshot("lisp-hover");
      // Moving off the word hides it; the caret can ask for the same information.
      await page.mouse.move(4, 4);
      await expect.poll(() => page.locator(".fw-hover").count()).toBe(0);
      await text(page, "invoice-total 100").click();
      await page.mouse.move(4, 4);
      await page.keyboard.press("Home");
      await page.keyboard.press("Control+Shift+Space");
      await expect
        .poll(() => hoverText(page))
        .toBe(
          "invoice-totalfunction(invoice-total revenue)Revenue plus sales tax, rounded to cents.Usedin 2 rows",
        );
      expect(await text(page, "invoice-total 100").getAttribute("aria-describedby")).toBe(
        "lisp-outline-hover",
      );
      await page.keyboard.press("Escape");
      await expect.poll(() => page.locator(".fw-hover").count()).toBe(0);
      // Esc dismissed the information and left the caret where it was.
      expect(await page.evaluate(() => (document.activeElement as HTMLTextAreaElement).value)).toBe(
        "invoice-total 100",
      );
    });

    it("underlines problems where they occur and explains them on hover", async () => {
      const page = await start();
      await pointAt(page, "collect-i9", "collect-i9");
      await expect
        .poll(() => hoverText(page))
        .toBe(
          "Warning reads :identity, but verify-identity never runscollect-i9stepSystemDocsReads:identityWrites:i9Usedin 3 rows",
        );
      await page.mouse.move(4, 4);
      await text(page, "invoice-total 100").click();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await page.keyboard.type("(+ 1 tax-rat)");
      const squiggle = page.locator(".fw-text-diagnostic[data-severity='error']");
      await expect.poll(() => squiggle.allTextContents()).toEqual(["tax-rat"]);
      await pointAt(page, "(+ 1 tax-rat)", "tax-rat");
      await expect.poll(() => hoverText(page)).toBe("Error tax-rat is not defined");
    });

    it("suggests names as they are typed and on request", async () => {
      const page = await start();
      await text(page, "map invoice-total [40 250 1200]").click();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await page.keyboard.type("inv");
      await expect.poll(() => suggestions(page)).toEqual(["invoice-totalfunction [revenue]"]);
      await screenshot("lisp-completion");
      // Return accepts instead of starting a new row; typing continues after the name.
      await page.keyboard.press("Enter");
      await page.keyboard.type(" 5");
      await expect.poll(() => valueOf(page, "invoice-total 5")).toBe("→5.41");
      await page.keyboard.press("Enter");
      await page.keyboard.type("(round ");
      await page.keyboard.press("Control+Space");
      await expect.poll(async () => (await suggestions(page)).length).toBeGreaterThan(20);
      await page.keyboard.type("tax");
      await expect.poll(() => suggestions(page)).toEqual(["tax-ratedef"]);
      await page.keyboard.press("Escape");
      await expect.poll(() => suggestions(page)).toEqual([]);
      expect(await page.evaluate(() => (document.activeElement as HTMLTextAreaElement).value)).toBe(
        "(round tax",
      );
      // A finished word offers nothing, so Return starts the next row.
      await page.keyboard.type("-rate 2)");
      await page.keyboard.press("Enter");
      await page.keyboard.type("let");
      await page.keyboard.press("Enter");
      await expect.poll(() => valueOf(page, "(round tax-rate 2)")).toBe("→0.08");
      await expect.poll(() => text(page, "let").count()).toBe(1);
    });

    it("keeps every key when typing outruns rendering", async () => {
      const page = await start();
      await text(page, "invoice-total 100").click();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      // Each key re-evaluates the program and offers suggestions, so renders lag the keys.
      await page.keyboard.type("defn twice-the-amount [x y z] (+ x y z) ; and a note");
      await expect
        .poll(() => page.evaluate(() => (document.activeElement as HTMLTextAreaElement).value))
        .toBe("defn twice-the-amount [x y z] (+ x y z) ; and a note");
    });

    it("offers the parts a form is missing as placeholder rows", async () => {
      const page = await start();
      const placeholders = () =>
        page
          .locator("[data-outline-placeholder] textarea")
          .evaluateAll((texts) => texts.map((text) => (text as HTMLTextAreaElement).placeholder));
      // Every flow ends with a place for another step.
      expect(await placeholders()).toEqual(["step"]);
      await text(page, "activate").click();
      await page.keyboard.press("End");
      await page.keyboard.press("ArrowDown");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe(
        "Add step",
      );
      await page.keyboard.type("verify");
      await expect.poll(() => suggestions(page)).toEqual(["verify-identitystep"]);
      await screenshot("lisp-placeholder-step");
      await page.keyboard.press("Enter");
      await expect
        .poll(() => valueOf(page, "collect-i9"))
        .toBe("may read :identity before verify-identity writes it");
      const rows = await outline(page);
      const at = rows.findIndex((row) => row.trim() === "activate");
      expect(rows[at + 1]).toBe("    verify-identity");

      // A function without a body asks for one.
      await text(page, "invoice-total 100").click();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await page.keyboard.type("defn twice [x]");
      await expect.poll(() => placeholders()).toEqual(["body", "step"]);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.type("* x 2");
      await page.keyboard.press("Escape");
      await expect.poll(() => placeholders()).toEqual(["step"]);
      await text(page, "* x 2").click();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.type("twice 21");
      await expect.poll(() => valueOf(page, "twice 21")).toBe("→42");
    });

    it("inspects a value as a tree that loads its branches when they open", async () => {
      const page = await start();
      const tree = page.getByRole("tree", { name: "Value" });
      const rows = () =>
        tree
          .locator('[role="treeitem"]')
          .evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));
      await text(page, "map invoice-total [40 250 1200]").click();
      await expect.poll(rows).toEqual(["[43.3 270.63 1299]"]);
      await tree.locator('[role="treeitem"]').first().click();
      await expect.poll(rows).toEqual(["[43.3 270.63 1299]", "0: 43.3", "1: 270.63", "2: 1299"]);
      // A long value loads a page at a time.
      await text(page, "map invoice-total [40 250 1200]").click();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await page.keyboard.type("range 45");
      await text(page, "range 45").click();
      await tree.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(async () => (await rows()).slice(-2)).toEqual(["19: 19", "Show 25 more"]);
      await tree.getByRole("treeitem", { name: "Show 25 more" }).click();
      await expect.poll(async () => (await rows()).slice(-2)).toEqual(["39: 39", "Show 5 more"]);
      await screenshot("lisp-value-tree");
    });

    it("keeps steps in their flows and shared code read only", async () => {
      const page = await start();
      const live = () => page.locator(".lisp-ide .fw-outliner__live").textContent();
      const before = await outline(page);
      // Outdenting a step would take it out of the workflow.
      await text(page, "collect-i9").click();
      await page.keyboard.press("Shift+Tab");
      await expect.poll(live).toBe("Can't move there.");
      expect(await outline(page)).toEqual(before);

      // Dragging it out shows a refused insertion marker, and dropping does nothing.
      const handle = page.locator('[aria-label="collect-i9"] [data-outline-handle]');
      const from = (await handle.boundingBox())!;
      const to = (await text(page, "invoice-total 100").boundingBox())!;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + 10, from.y - 10, { steps: 3 });
      await page.mouse.move(from.x + 4, to.y + to.height - 2, { steps: 12 });
      await expect
        .poll(() => page.locator(".fw-outliner__drop").getAttribute("data-refused"))
        .toBe("true");
      await screenshot("lisp-refused-drop");
      await page.mouse.up();
      expect(await outline(page)).toEqual(before);

      // The Library is shared code, shown in context and read only.
      await page.locator('[aria-label="section \\"Library\\""] [data-outline-toggle]').click();
      const cents = text(page, "defn cents [amount] (round amount 2)");
      await cents.click();
      await page.keyboard.press("End");
      await page.keyboard.type("!");
      expect(await cents.inputValue()).toBe("defn cents [amount] (round amount 2)");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Backspace");
      await expect.poll(live).toBe("Read-only items can't change.");
      expect(await cents.count()).toBe(1);
      expect(await page.getByRole("button", { name: "Unwrap" }).isDisabled()).toBe(true);
    });

    it("proposes a structural edit for selected rows and applies it", async () => {
      const page = await start();
      expect(await valueOf(page, "collect-i9")).toBe(
        "reads :identity, but verify-identity never runs",
      );
      await text(page, "background-check").click();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Shift+ArrowDown");
      await expect
        .poll(() => page.locator(".lisp-assistant__context").textContent())
        .toBe("Acting on 2 selected rows");
      await page.getByRole("button", { name: /Run these concurrently/ }).click();
      await expect
        .poll(() =>
          page.getByRole("region", { name: "Structural diff" }).locator("li").allTextContents(),
        )
        .toEqual([
          "workflow onboarding",
          "+parallel (added)",
          "→background-check (moved)",
          "+sequence (added)",
          "+verify-identity (added)",
          "→collect-i9 (moved)",
          "create-payroll-record",
          "activate",
        ]);
      await screenshot("lisp-proposal");
      await page.getByRole("button", { name: "Accept" }).click();
      await expect
        .poll(() => valueOf(page, "before? onboarding verify-identity collect-i9"))
        .toBe("true");
      const rows = await outline(page);
      const at = rows.findIndex((row) => row.trim() === "workflow onboarding");
      expect(rows.slice(at, at + 6)).toEqual([
        "  workflow onboarding",
        "    parallel",
        "      background-check",
        "      sequence",
        "        verify-identity",
        "        collect-i9",
      ]);
      // Accepting is one undoable step.
      await page.getByRole("button", { name: "Undo" }).click();
      await expect
        .poll(() => valueOf(page, "before? onboarding verify-identity collect-i9"))
        .toBe("false");
    });

    it("shows the same program as Lisp and reads edits back", async () => {
      const page = await start();
      await text(page, "def tax-rate 0.0825").click();
      await page.keyboard.press("Control+l");
      const source = page.getByRole("textbox", { name: "Lisp source" });
      await expect.poll(() => source.count()).toBe(1);
      expect(await source.inputValue()).toContain(
        "(defn invoice-total [revenue]\n    ; Revenue plus sales tax, rounded to cents.",
      );
      // The line for the row with the caret is highlighted, and follows it.
      const highlighted = page.locator(".lisp-source .native-editor__line--highlighted");
      await expect.poll(() => highlighted.allTextContents()).toEqual(["  (def tax-rate 0.0825)"]);
      await text(page, "invoice-total 100").click();
      await expect.poll(() => highlighted.allTextContents()).toEqual(["  (invoice-total 100)"]);
      // Highlighting comes from the outline's analysis.
      expect(
        await page
          .locator(".lisp-source .native-token--semantic")
          .evaluateAll((spans) =>
            spans
              .slice(0, 8)
              .map((span) => `${(span as HTMLElement).dataset.kind}:${span.textContent}`),
          ),
      ).toEqual([
        "comment:; A program is an outline: every row is a form, and indentation is nesting.",
        "paren:(",
        "special:section",
        'string:"Pricing"',
        "paren:(",
        "special:def",
        "definition:tax-rate",
        "number:0.0825",
      ]);
      // Hovering the source explains it as the rows do.
      const word = await page
        .locator(".lisp-source .native-token--semantic")
        .evaluateAll((spans) => {
          const rect = spans
            .find((span) => span.textContent === "tax-rate")!
            .getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        });
      await page.mouse.move(word.x, word.y);
      await expect.poll(() => hoverText(page)).toBe("tax-ratedefinitionnumber0.0825Usedin 1 row");
      await page.mouse.move(4, 4);
      await screenshot("lisp-source");

      const value = await source.inputValue();
      const at = value.indexOf("0.0825");
      await source.focus();
      await source.evaluate((element, offset) => {
        (element as HTMLTextAreaElement).setSelectionRange(offset, offset + 6);
      }, at);
      await page.keyboard.type("0.1");
      await expect.poll(() => valueOf(page, "invoice-total 100")).toBe("→110");
      // Text that does not read leaves the outline alone and says why.
      await page.keyboard.type(" ]");
      await expect
        .poll(() => page.locator(".lisp-source__error").textContent())
        .toBe("Expected ) on line 3");
      expect(await valueOf(page, "invoice-total 100")).toBe("→110");
      await expect
        .poll(() => page.locator(".lisp-source .native-token--issue").allTextContents())
        .toEqual(["]"]);
    });
  });
};
