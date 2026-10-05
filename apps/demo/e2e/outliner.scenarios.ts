import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

/** The visible outline as indented text, with `*` marking selected rows. */
const outline = (page: Page) =>
  page
    .locator("[data-outline-row]")
    .evaluateAll((rows) =>
      rows.map(
        (row) =>
          `${"  ".repeat(Number(row.getAttribute("aria-level")) - 1)}${row.getAttribute("data-selected") === "true" ? "*" : ""}${row.querySelector("textarea")?.value ?? ""}`,
      ),
    );

const slice = async (page: Page, first: string, count: number) => {
  const rows = await outline(page);
  const start = rows.findIndex((row) => row.trim().replace(/^\*/, "") === first);
  return rows.slice(start, start + count);
};

export const outlinerScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
) => {
  describe("outliner", () => {
    const start = async () => {
      const page = getPage();
      await page.goto(`${appUrl}/outliner`, { waitUntil: "networkidle" });
      await expect.poll(() => page.locator("[data-outline-row]").count()).toBeGreaterThan(10);
      return page;
    };
    const text = (page: Page, value: string) => page.locator(`textarea:text-is("${value}")`);

    it("creates, nests, and outdents items as fast as they are typed", async () => {
      const page = await start();
      await text(page, "Reading the weather").click();
      await page.keyboard.press("End");
      // Keys typed before the new row renders are held and replayed into it.
      const cdp = await page.context().newCDPSession(page);
      const key = (key: string, code: string, keyCode: number, text?: string, modifiers = 0) => [
        cdp.send("Input.dispatchKeyEvent", {
          type: text === undefined ? "rawKeyDown" : "keyDown",
          key,
          code,
          windowsVirtualKeyCode: keyCode,
          modifiers,
          ...(text === undefined ? {} : { text, unmodifiedText: text }),
        }),
        cdp.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key,
          code,
          windowsVirtualKeyCode: keyCode,
          modifiers,
        }),
      ];
      const letter = (value: string) =>
        key(value, `Key${value.toUpperCase()}`, value.toUpperCase().charCodeAt(0), value);
      await Promise.all([
        ...key("Enter", "Enter", 13, "\r"),
        ...key("Tab", "Tab", 9),
        ...letter("a"),
        ...key("Enter", "Enter", 13, "\r"),
        ...key("Tab", "Tab", 9, undefined, 8),
        ...letter("b"),
      ]);
      await expect
        .poll(() => slice(page, "Reading the weather", 3))
        .toEqual(["    Reading the weather", "      a", "    b"]);

      await page.keyboard.press("Control+z");
      await page.keyboard.press("Control+z");
      await expect
        .poll(() => slice(page, "Reading the weather", 3))
        .toEqual(["    Reading the weather", "      a", "      "]);
    });

    it("selects rows from the keyboard and moves them as a unit", async () => {
      const page = await start();
      await page
        .locator("[data-outline-row]")
        .filter({ has: text(page, "Birds you'll hear before you see") })
        .locator("[data-outline-toggle]")
        .click();
      await text(page, "Pacific wren").click();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Shift+ArrowDown");
      await expect
        .poll(() => slice(page, "Varied thrush", 3))
        .toEqual(["      Varied thrush", "      *Pacific wren", "      *Sooty grouse"]);
      await page.keyboard.press("Control+Shift+ArrowUp");
      await expect
        .poll(() => slice(page, "Birds you'll hear before you see", 4))
        .toEqual([
          "    Birds you'll hear before you see",
          "      *Pacific wren",
          "      *Sooty grouse",
          "      Varied thrush",
        ]);
      await page.keyboard.press("Shift+Tab");
      await expect
        .poll(() => slice(page, "Birds you'll hear before you see", 4))
        .toEqual([
          "    Birds you'll hear before you see",
          "    *Pacific wren",
          "    *Sooty grouse",
          "      Varied thrush",
        ]);
      await page.keyboard.press("Enter");
      await expect
        .poll(() => page.evaluate(() => (document.activeElement as HTMLTextAreaElement).value))
        .toBe("Sooty grouse");
    });

    it("drags an item to a new parent by sliding right", async () => {
      const page = await start();
      const row = (value: string) =>
        page
          .locator("[data-outline-row]")
          .filter({ has: text(page, value) })
          .first();
      const handle = await row("Print run: 200 or 500?")
        .locator("[data-outline-handle]")
        .boundingBox();
      const target = await row("Who owns updates after the first season?").boundingBox();
      if (handle === null || target === null) throw new Error("Rows are not visible.");
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
      await page.mouse.down();
      await page.mouse.move(handle.x + handle.width / 2, handle.y + 16, { steps: 3 });
      await page.mouse.move(handle.x + handle.width / 2 + 28, target.y + target.height - 4, {
        steps: 8,
      });
      await expect.poll(() => page.locator(".fw-outliner__drop").count()).toBe(1);
      await screenshot("outliner-drag");
      await page.mouse.up();
      await expect
        .poll(() => slice(page, "Open questions", 3))
        .toEqual([
          "  Open questions",
          "    Who owns updates after the first season?",
          "      *Print run: 200 or 500?",
        ]);
    });

    it("hoists an item from its bullet and returns through the path", async () => {
      const page = await start();
      await page
        .locator("[data-outline-row]")
        .filter({ has: text(page, "What to pack") })
        .locator("[data-outline-handle]")
        .click();
      await expect
        .poll(() => page.locator(".fw-outliner__title").textContent())
        .toBe("What to pack");
      expect(await outline(page)).toEqual([
        "Water, two liters at least",
        "Layers — mornings start near freezing",
        "Paper map; phones lose signal past the ridge",
      ]);
      await page.getByRole("button", { name: "Outline", exact: true }).click();
      await expect.poll(() => page.locator(".fw-outliner__title").count()).toBe(0);
      await screenshot("outliner");
    });

    it("mentions people and tags items, with suggestions and hover cards", async () => {
      const page = await start();
      const suggestions = () => page.locator('.fw-completion [role="option"]').allTextContents();
      await text(page, "Reading the weather").click();
      await page.keyboard.press("End");
      await page.keyboard.type(" @");
      await expect
        .poll(() => suggestions())
        .toEqual(["@mayaMaya Chen", "@jonahJonah Park", "@adaAda Ruiz", "@samSam Okafor"]);
      await page.keyboard.type("j");
      await expect.poll(() => suggestions()).toEqual(["@jonahJonah Park"]);
      await screenshot("outliner-mention-suggestions");
      await page.keyboard.press("Tab");
      await page.keyboard.type("#dr");
      await expect.poll(() => suggestions()).toEqual(["#draft"]);
      // Keys typed right after accepting land after the inserted tag.
      await page.keyboard.press("Enter");
      await page.keyboard.type("!");
      await expect
        .poll(() => page.evaluate(() => (document.activeElement as HTMLTextAreaElement).value))
        .toBe("Reading the weather @jonah #draft !");

      await page.getByRole("button", { name: "Expand all" }).click();
      const restOn = async (word: string) => {
        const pointOf = () =>
          page.locator(".fw-outliner__span").evaluateAll((spans, wanted) => {
            const rect = spans.find((span) => span.textContent === wanted)?.getBoundingClientRect();
            return rect === undefined
              ? null
              : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          }, word);
        await expect.poll(pointOf).not.toBeNull();
        const point = (await pointOf())!;
        await page.mouse.move(point.x, point.y);
      };
      await restOn("@priya");
      await expect
        .poll(() => page.locator(".fw-hover").textContent())
        .toBe("Warning No one on the crew is called @priya.");
      await page.mouse.move(4, 4);
      await expect.poll(() => page.locator(".fw-hover").count()).toBe(0);
      await restOn("@sam");
      await expect
        .poll(() => page.locator(".fw-hover").textContent())
        .toBe("Sam OkaforVolunteer coordinatorOn 1 item");
      await screenshot("outliner-mention-hover");
    });

    it("adds an entry by typing into a placeholder at the end of a list", async () => {
      const page = await start();
      const question = page.getByRole("textbox", { name: "Add question" });
      await question.click();
      await page.keyboard.type("Who prints the maps?");
      await expect
        .poll(() => slice(page, "Open questions", 4))
        .toEqual([
          "  Open questions",
          "    Print run: 200 or 500?",
          "    Who owns updates after the first season?",
          "    Who prints the maps?",
        ]);
      // The placeholder stays at the end for the next one, and arrows reach it.
      await page.keyboard.press("ArrowDown");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe(
        "Add question",
      );
      await page.keyboard.press("ArrowUp");
      expect(await page.evaluate(() => (document.activeElement as HTMLTextAreaElement).value)).toBe(
        "Who prints the maps?",
      );
      await page.keyboard.press("Control+z");
      await expect.poll(() => text(page, "Who prints the maps?").count()).toBe(0);
    });
  });
};
