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

    it("replaces a whole mention at a middle caret, preserves delimiters, and undoes acceptance", async () => {
      const page = await start();
      const row = text(page, "Reading the weather");
      await row.fill("Check @mystery, next");
      const input = text(page, "Check @mystery, next");
      await input.evaluate((element: HTMLTextAreaElement) => {
        element.focus();
        element.setSelectionRange(8, 8);
        element.dispatchEvent(new Event("select", { bubbles: true }));
      });
      await page.keyboard.press("Control+Space");
      await expect
        .poll(() => page.locator('.fw-completion [role="option"]').allTextContents())
        .toEqual(["@mayaMaya Chen"]);
      await page.keyboard.press("Tab");
      await page.keyboard.type("!");
      await expect
        .poll(() => page.evaluate(() => (document.activeElement as HTMLTextAreaElement).value))
        .toBe("Check @maya!, next");
      await page.keyboard.press("Control+z");
      await page.keyboard.press("Control+z");
      await expect.poll(() => text(page, "Check @mystery, next").count()).toBe(1);
      await page.keyboard.press("Control+Shift+z");
      await expect.poll(() => text(page, "Check @maya, next").count()).toBe(1);
    });

    it("waits for committed composition before offering a mention", async () => {
      const page = await start();
      await text(page, "Reading the weather").fill("Invite @");
      const input = text(page, "Invite @");
      await expect.poll(() => page.getByRole("listbox").count()).toBe(1);
      await input.evaluate((element) =>
        element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })),
      );
      await expect.poll(() => page.getByRole("listbox").count()).toBe(0);
      await input.evaluate((element: HTMLTextAreaElement) => {
        element.value = "Invite @jo";
        element.setSelectionRange(10, 10);
        element.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            isComposing: true,
            inputType: "insertCompositionText",
            data: "jo",
          }),
        );
      });
      expect(await page.getByRole("listbox").count()).toBe(0);
      await input.evaluate((element) =>
        element.dispatchEvent(
          new CompositionEvent("compositionend", { bubbles: true, data: "jo" }),
        ),
      );
      await expect
        .poll(() => page.locator('.fw-completion [role="option"]').allTextContents())
        .toEqual(["@jonahJonah Park"]);
      await page.keyboard.press("Enter");
      await expect.poll(() => text(page, "Invite @jonah ").count()).toBe(1);
      await page.keyboard.press("Control+z");
      await expect.poll(() => text(page, "Invite @jo").count()).toBe(1);
    });

    it("keeps reference popups visible in desktop, dark, and mobile inline layouts", async () => {
      const page = await start();
      for (const variant of ["desktop", "dark", "mobile"] as const) {
        await page.setViewportSize(
          variant === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 1100 },
        );
        await page.emulateMedia({ colorScheme: variant === "dark" ? "dark" : "light" });
        const input = text(page, "Reading the weather");
        await input.click();
        await page.keyboard.press("End");
        await page.keyboard.type(" @");
        await expect.poll(() => page.getByRole("listbox").isVisible()).toBe(true);
        const bounds = await page.locator(".fw-completion").boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(variant === "mobile" ? 390 : 1440);
        await screenshot(`outliner-references-${variant}`);
        await page.keyboard.press("Escape");
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Backspace");
        await expect.poll(() => text(page, "Reading the weather").count()).toBe(1);
      }
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

    it("refuses moving an item into a done one, from the keyboard and by dragging", async () => {
      const page = await start();
      const live = () => page.locator(".fw-outliner__live").textContent();
      // "What to pack" above it is done, so Tab would reopen it.
      await text(page, "Reading the weather").click();
      await page.keyboard.press("Tab");
      await expect.poll(live).toBe("Can't move there.");
      expect(await slice(page, "Reading the weather", 1)).toEqual(["    Reading the weather"]);
      expect(await page.evaluate(() => (document.activeElement as HTMLTextAreaElement).value)).toBe(
        "Reading the weather",
      );

      // Sliding right under a done chapter falls back to the depth that is allowed.
      const row = (value: string) =>
        page
          .locator("[data-outline-row]")
          .filter({ has: text(page, value) })
          .first();
      const handle = await row("A night-sky chapter")
        .locator("[data-outline-handle]")
        .boundingBox();
      const target = await row("Getting to the trailheads @maya").boundingBox();
      if (handle === null || target === null) throw new Error("Rows are not visible.");
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
      await page.mouse.down();
      await page.mouse.move(handle.x + handle.width / 2, handle.y - 16, { steps: 3 });
      await page.mouse.move(handle.x + handle.width / 2 + 56, target.y + target.height - 4, {
        steps: 10,
      });
      await expect
        .poll(() => page.locator('.fw-outliner__drop[data-refused="false"]').count())
        .toBe(1);
      await page.mouse.up();
      await expect
        .poll(() => slice(page, "Getting to the trailheads @maya", 2))
        .toEqual(["    Getting to the trailheads @maya", "    *A night-sky chapter"]);
    });

    it("keeps the quoted principles read only and refuses drops into them", async () => {
      const page = await start();
      const live = () => page.locator(".fw-outliner__live").textContent();
      await expect
        .poll(() =>
          page
            .locator("[data-outline-row]")
            .filter({ has: text(page, "The seven principles, as Leave No Trace publishes them") })
            .locator(".fw-outliner__accessory")
            .textContent(),
        )
        .toBe("Quoted · read only");
      const principle = text(page, "Plan ahead and prepare");
      expect(await principle.getAttribute("readonly")).not.toBeNull();
      await principle.click();
      await page.keyboard.type("!");
      await page.keyboard.press("Shift+Tab");
      await expect.poll(live).toBe("Read-only items can't move.");
      expect(await principle.count()).toBe(1);

      // No depth between two principles is allowed, so the marker and ghost show the refusal.
      const row = (value: string) =>
        page
          .locator("[data-outline-row]")
          .filter({ has: text(page, value) })
          .first();
      const handle = await row("A night-sky chapter")
        .locator("[data-outline-handle]")
        .boundingBox();
      const target = await row("Leave what you find").boundingBox();
      if (handle === null || target === null) throw new Error("Rows are not visible.");
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
      await page.mouse.down();
      await page.mouse.move(handle.x + handle.width / 2, handle.y - 16, { steps: 3 });
      await page.mouse.move(handle.x + handle.width / 2 + 60, target.y + target.height - 4, {
        steps: 10,
      });
      await expect
        .poll(() => page.locator('.fw-outliner__drop[data-refused="true"]').count())
        .toBe(1);
      await expect
        .poll(() => page.locator('.fw-outliner-ghost[data-refused="true"]').count())
        .toBe(1);
      await screenshot("outliner-refused-drop");
      await page.mouse.up();
      await expect.poll(live).toBe("Can't move there.");
      expect(await slice(page, "Someday", 2)).toEqual(["Someday", "  *A night-sky chapter"]);
    });

    it("summarizes a folded checklist and marks entries done from it", async () => {
      const page = await start();
      const summary = (name: string) => page.getByRole("group", { name });
      await expect
        .poll(() => summary("Volunteer day, April 12: 1 of 3 tasks done").count())
        .toBe(1);
      await page.getByRole("button", { name: "Signage @jonah" }).click();
      await expect
        .poll(() => summary("Volunteer day, April 12: 2 of 3 tasks done").count())
        .toBe(1);
      expect(
        await page.getByRole("button", { name: "Signage @jonah" }).getAttribute("aria-pressed"),
      ).toBe("true");

      // Fold the chapters; the keyboard reaches the summary from the row and returns with Esc.
      await page
        .locator("[data-outline-row]")
        .filter({ has: text(page, "Chapters") })
        .locator("[data-outline-toggle]")
        .click();
      await text(page, "Chapters").click();
      await page.keyboard.press("End");
      await page.keyboard.press("ArrowDown");
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-label")))
        .toBe("Chapters: 2 of 5 chapters done");
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe(
        "Getting to the trailheads @maya",
      );
      await screenshot("outliner-folded-checklist");
      await page.keyboard.press("Escape");
      await expect
        .poll(() => page.evaluate(() => (document.activeElement as HTMLTextAreaElement).value))
        .toBe("Chapters");

      // Marking done from the summary is one undoable step.
      await page.getByRole("button", { name: "Undo" }).click();
      await expect
        .poll(() => summary("Volunteer day, April 12: 1 of 3 tasks done").count())
        .toBe(1);
      await page.getByRole("button", { name: "Expand all" }).click();
      expect(
        await page
          .locator("[data-outline-row]")
          .filter({ has: text(page, "Signage @jonah #print") })
          .getAttribute("data-checked"),
      ).toBe("false");
    });
  });
};
