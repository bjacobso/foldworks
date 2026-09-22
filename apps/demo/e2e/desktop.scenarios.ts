import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

export const desktopScenarios = (getPage: () => Page, appUrl: string) => {
  const visit = async () => {
    const page = getPage();
    page.setDefaultTimeout(8000);
    await page.goto(`${appUrl}/ui-kit`);
    await page.locator("#desktop-primitives").waitFor();
    await page.locator("#desktop-primitives").scrollIntoViewIfNeeded();
    return page;
  };
  const focused = (page: Page, selector: string) =>
    expect
      .poll(() =>
        page.locator(selector).evaluate((el) => el === document.activeElement),
      )
      .toBe(true);
  const announcement = (page: Page, text: string) =>
    expect
      .poll(() => page.locator("#desktop-announcement").textContent())
      .toBe(text);
  describe("desktop primitives", () => {
    it("shares command execution across keyboard, menu, palette and help with scope and editable policies", async () => {
      const page = await visit();
      const section = page.locator("#desktop-primitives");
      await page.keyboard.press("Control+Shift+s");
      await announcement(page, "Workspace saved (1).");
      await section
        .getByRole("button", { name: "Workspace commands", exact: true })
        .click();
      await page.getByRole("menuitem", { name: /Save workspace/ }).click();
      await announcement(page, "Workspace saved (2).");
      const search = section.getByRole("combobox", {
        name: "Search workspace commands",
      });
      await search.fill("Save");
      await search.press("Control+Shift+s");
      await announcement(page, "Workspace saved (2).");
      await search.press("Enter");
      await announcement(page, "Workspace saved (3).");
      await section
        .getByText("Keyboard shortcut reference", { exact: true })
        .click();
      await section
        .locator("dl")
        .getByRole("button", { name: "Save workspace", exact: true })
        .click();
      await announcement(page, "Workspace saved (4).");
      const save = section
        .getByRole("button", { name: "Save workspace", exact: true })
        .first();
      expect(await save.getAttribute("aria-keyshortcuts")).toBe(
        "Control+Shift+s",
      );
      await page.locator("#desktop-permissions").focus();
      await page.keyboard.press("Control+Enter");
      await announcement(page, "Inspector preview requested.");
      await save.focus();
      await page.keyboard.press("Control+Enter");
      await announcement(page, "global-preview requested.");
    });
    it("updates disabled shortcut registrations without remounting controls or duplicating execution", async () => {
      const page = await visit();
      const section = page.locator("#desktop-primitives");
      await section
        .getByRole("button", {
          name: "Disable workspace commands",
          exact: true,
        })
        .click();
      const toggle = section.getByRole("button", {
        name: "Enable workspace commands",
        exact: true,
      });
      await toggle.waitFor();
      expect(await toggle.evaluate((el) => el === document.activeElement)).toBe(
        true,
      );
      const save = section
        .getByRole("button", { name: "Save workspace", exact: true })
        .first();
      await expect.poll(() => save.isDisabled()).toBe(true);
      const prevented = await toggle.evaluate((el) => {
        const event = new KeyboardEvent("keydown", {
          key: "s",
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        });
        el.dispatchEvent(event);
        return event.defaultPrevented;
      });
      expect(prevented).toBe(false);
      await announcement(page, "Workspace ready.");
      await section
        .getByRole("button", { name: "Workspace commands", exact: true })
        .click();
      expect(
        await page
          .getByRole("menuitem", { name: /Save workspace/ })
          .getAttribute("aria-disabled"),
      ).toBe("true");
      await page.keyboard.press("Escape");
      await toggle.click();
      await expect.poll(() => save.isDisabled()).toBe(false);
      await page.keyboard.press("Control+Shift+s");
      await announcement(page, "Workspace saved (1).");
      await section
        .getByRole("button", {
          name: "Disable workspace commands",
          exact: true,
        })
        .click();
      await toggle.click();
      await expect.poll(() => save.isDisabled()).toBe(false);
      await page.keyboard.press("Control+Shift+s");
      await announcement(page, "Workspace saved (2).");
    });
    it("edits single and multiline values with validation, IME safety, cancellation and focus return", async () => {
      const page = await visit();
      const trigger = page.getByRole("button", {
        name: "Edit project name",
        exact: true,
      });
      await trigger.click();
      const input = page.getByRole("textbox", {
        name: "project name",
        exact: true,
      });
      await focused(page, "#desktop-name-edit");
      await input.fill("");
      await input.press("Enter");
      await expect
        .poll(() => page.locator("#desktop-name-edit-status").textContent())
        .toBe("Enter a name.");
      await input.fill("Release gates");
      await input.evaluate((el) =>
        el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            isComposing: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(await input.count()).toBe(1);
      await input.press("Enter");
      await expect.poll(() => trigger.textContent()).toBe("Release gates");
      await focused(page, "#desktop-name-view");
      await trigger.click();
      await input.fill("Discard");
      await input.press("Escape");
      await expect.poll(() => trigger.textContent()).toBe("Release gates");
      await page
        .getByRole("button", { name: "Edit description", exact: true })
        .click();
      const multiline = page.getByRole("textbox", {
        name: "description",
        exact: true,
      });
      await multiline.fill("First");
      await multiline.press("End");
      await multiline.press("Enter");
      await multiline.press("x");
      expect(await multiline.inputValue()).toBe("First\nx");
      await multiline.press("Control+Enter");
      await expect
        .poll(() =>
          page
            .getByRole("button", { name: "Edit description", exact: true })
            .textContent(),
        )
        .toBe("First\nx");
    });
    it("composes suggestions, custom tokens, atomic paste, keyboard removal and form values", async () => {
      const page = await visit();
      const input = page.getByRole("combobox", {
        name: "Project teams",
        exact: true,
      });
      await input.fill("Oper");
      await page
        .getByRole("option", { name: "Operations", exact: true })
        .first()
        .click();
      await expect
        .poll(() =>
          page.locator('#desktop-tags [data-token="Operations"]').count(),
        )
        .toBe(1);
      await input.fill("Research");
      await page
        .getByRole("option", { name: "Add “Research”", exact: true })
        .click();
      await expect
        .poll(() =>
          page.locator('#desktop-tags [data-token="Research"]').count(),
        )
        .toBe(1);
      await input.fill("");
      const paste = (text: string) =>
        input.evaluate((el, text) => {
          const data = new DataTransfer();
          data.setData("text/plain", text);
          el.dispatchEvent(
            new ClipboardEvent("paste", {
              clipboardData: data,
              bubbles: true,
              cancelable: true,
            }),
          );
        }, text);
      await paste(" Platform; Legal ");
      await expect
        .poll(() => page.locator('#desktop-tags [data-token="Legal"]').count())
        .toBe(1);
      await paste("Extra; Another");
      await expect
        .poll(() => page.locator("#desktop-tags-status").textContent())
        .toBe("Choose at most 5 values.");
      await input.focus();
      await input.press("Backspace");
      await focused(
        page,
        '#desktop-tags [data-token="Legal"] button:first-child',
      );
      await page.keyboard.press("Delete");
      await expect
        .poll(() => page.locator('#desktop-tags [data-token="Legal"]').count())
        .toBe(0);
      await page
        .getByRole("button", { name: "Remove Research", exact: true })
        .click();
      await expect
        .poll(() =>
          page
            .locator("#desktop-form")
            .evaluate((form) =>
              new FormData(form as HTMLFormElement).getAll("teams"),
            ),
        )
        .toEqual(["Platform", "Design", "Operations"]);
    });
    it("restores focus through a controlled nested inspector and respects reduced motion", async () => {
      const page = await visit();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page
        .getByRole("button", { name: "Permissions", exact: true })
        .click();
      await focused(page, "#desktop-stack-heading");
      expect(
        await page
          .locator('[data-panel-id="permissions"]')
          .evaluate((panel) => {
            const input = document.createElement("input");
            panel.append(input);
            const event = new KeyboardEvent("keydown", {
              key: "ArrowLeft",
              altKey: true,
              bubbles: true,
              cancelable: true,
            });
            input.dispatchEvent(event);
            input.remove();
            return event.defaultPrevented;
          }),
      ).toBe(false);
      expect(
        await page
          .locator('[data-panel-id="permissions"]')
          .evaluate((el) => getComputedStyle(el).animationDuration),
      ).toBe("0s");
      await page
        .getByRole("button", { name: "Advanced permissions", exact: true })
        .click();
      await focused(page, "#desktop-stack-heading");
      await page.keyboard.press("Alt+ArrowLeft");
      await focused(page, "#desktop-advanced");
      await page
        .getByRole("button", { name: "Back to previous panel", exact: true })
        .click();
      await focused(page, "#desktop-permissions");
    });
    it("anchors context menus and navigates nested checkbox/radio items with keyboard and pointer intent", async () => {
      const page = await visit();
      const trigger = page.locator("#desktop-context-trigger");
      const box = await trigger.boundingBox();
      await trigger.click({ button: "right", position: { x: 50, y: 12 } });
      await focused(page, "#desktop-context-layer");
      const layer = page.locator("#desktop-context-layer");
      const position = await layer.boundingBox();
      expect(position!.x).toBeCloseTo(box!.x + 50, 0);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      await expect
        .poll(() =>
          page
            .getByRole("menuitemcheckbox", { name: "Compact rows" })
            .getAttribute("aria-checked"),
        )
        .toBe("false");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect
        .poll(() =>
          page
            .getByRole("menuitemradio", { name: "Modified date" })
            .getAttribute("aria-checked"),
        )
        .toBe("true");
      await page.keyboard.press("Escape");
      expect(await layer.isVisible()).toBe(true);
      await page.keyboard.press("Escape");
      expect(await layer.isVisible()).toBe(true);
      await page.keyboard.press("Escape");
      await expect.poll(() => layer.count()).toBe(0);
      await focused(page, "#desktop-context-trigger");
      await trigger.press("Shift+F10");
      await focused(page, "#desktop-context-layer");
      await page
        .getByRole("menuitem", { name: "View options", exact: true })
        .hover();
      await page
        .getByRole("menuitemcheckbox", { name: "Compact rows" })
        .waitFor();
      await page.locator("#desktop-announcement").click();
      await expect.poll(() => layer.count()).toBe(0);
    });
    it("shares constrained dates between text, keyboard calendar and form values", async () => {
      const page = await visit();
      const input = page.getByRole("textbox", {
        name: "Deadline",
        exact: true,
      });
      await input.fill("25/09/2026");
      await input.press("Enter");
      await expect
        .poll(() => page.locator("#desktop-date-status").textContent())
        .toBe("This date is unavailable.");
      await input.fill("28/09/2026");
      await input.press("Enter");
      await page
        .getByRole("button", { name: "Choose Deadline", exact: true })
        .click();
      await expect
        .poll(() =>
          page.evaluate(() => document.activeElement?.getAttribute("role")),
        )
        .toBe("grid");
      expect(
        await page
          .locator('#desktop-date-picker-calendar-grid [role="columnheader"]')
          .first()
          .textContent(),
      ).toBe("Mon");
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.activeElement?.getAttribute("aria-activedescendant"),
          ),
        )
        .toContain("2026-9-29");
      await page.keyboard.press("Enter");
      await expect.poll(() => input.inputValue()).toBe("29/09/2026");
      expect(
        await page
          .locator("#desktop-form")
          .evaluate((form) =>
            new FormData(form as HTMLFormElement).get("deadline"),
          ),
      ).toBe("2026-09-29");
      await page
        .getByRole("button", { name: "Choose Deadline", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Switch to month picker" })
        .click();
      await expect
        .poll(() =>
          page
            .getByRole("grid", { name: /Month picker/ })
            .getByRole("row")
            .count(),
        )
        .toBe(4);
      await page.getByRole("button", { name: "Switch to year picker" }).click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.activeElement?.getAttribute("aria-label"),
          ),
        )
        .toContain("Year picker");
      await page.keyboard.press("Enter");
      await page.getByRole("grid", { name: /Month picker/ }).waitFor();
      await page
        .getByRole("button", { name: "October 2026", exact: true })
        .click();
      await page
        .getByRole("grid", { name: /Calendar, October 2026/ })
        .waitFor();
      await page.keyboard.press("Escape");
      expect(await input.inputValue()).toBe("29/09/2026");
    });
    it("owns nested overlay focus and Escape and cleans up streams on route unmount", async () => {
      const page = getPage();
      await page.addInitScript(() => {
        const Original = window.ResizeObserver;
        const state = window as unknown as { measuredObservers: number };
        state.measuredObservers = 0;
        window.ResizeObserver = class extends Original {
          tracked = false;
          override observe(target: Element, options?: ResizeObserverOptions) {
            if (!this.tracked && target.querySelector("[data-measure]")) {
              this.tracked = true;
              state.measuredObservers++;
            }
            super.observe(target, options);
          }
          override disconnect() {
            if (this.tracked) {
              state.measuredObservers--;
              this.tracked = false;
            }
            super.disconnect();
          }
        };
      });
      await visit();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as { measuredObservers: number })
                .measuredObservers,
          ),
        )
        .toBe(2);
      await page
        .getByRole("button", { name: "Open activity drawer", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Clear activity", exact: true })
        .click();
      await expect
        .poll(() =>
          page
            .getByRole("button", { name: "Keep activity", exact: true })
            .evaluate((el) => el === document.activeElement),
        )
        .toBe(true);
      await page.keyboard.press("Shift+Tab");
      expect(
        await page
          .getByRole("button", { name: "Confirm clear", exact: true })
          .evaluate((el) => el === document.activeElement),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect.poll(() => page.getByRole("alertdialog").count()).toBe(0);
      await expect
        .poll(() =>
          page
            .getByRole("button", { name: "Clear activity", exact: true })
            .evaluate((el) => el === document.activeElement),
        )
        .toBe(true);
      await page.keyboard.press("Escape");
      await expect
        .poll(() =>
          page
            .getByRole("button", { name: "Open activity drawer", exact: true })
            .evaluate((el) => el === document.activeElement),
        )
        .toBe(true);
      await page
        .getByRole("button", { name: "Open settings sheet", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Sheet view options", exact: true })
        .click();
      await focused(page, "#desktop-sheet-menu-layer");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowRight");
      await page
        .getByRole("menuitemcheckbox", { name: "Compact rows" })
        .waitFor();
      await page.keyboard.press("Escape");
      expect(await page.locator("#desktop-sheet-menu-layer").count()).toBe(1);
      await page.keyboard.press("Escape");
      await expect
        .poll(() => page.locator("#desktop-sheet-menu-layer").count())
        .toBe(0);
      expect(
        await page
          .getByRole("dialog", { name: "Workspace settings", exact: true })
          .isVisible(),
      ).toBe(true);
      // Route removal while the sheet is still open exercises Dialog's unmount cleanup.
      await page
        .locator('a[href="/"]')
        .first()
        .evaluate((el) => (el as HTMLElement).click());
      await expect
        .poll(() => page.locator("#desktop-primitives").count())
        .toBe(0);
      await expect
        .poll(() => page.evaluate(() => document.body.style.overflow))
        .not.toBe("hidden");
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as { measuredObservers: number })
                .measuredObservers,
          ),
        )
        .toBe(0);
      expect(
        await page.evaluate(() =>
          document.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "s",
              ctrlKey: true,
              shiftKey: true,
              bubbles: true,
              cancelable: true,
            }),
          ),
        ),
      ).toBe(true);
    });
    it("measures narrow and desktop action rows without losing actions or overflowing the viewport", async () => {
      const page = await visit();
      const actions = page.getByRole("group", {
        name: "Workspace actions",
        exact: true,
      });
      await expect.poll(() => actions.getByRole("button").count()).toBe(5);
      await page.setViewportSize({ width: 390, height: 1600 });
      await expect
        .poll(() => actions.getByText("More", { exact: true }).count())
        .toBe(1);
      await actions.getByText("More", { exact: true }).click();
      await actions
        .getByRole("button", { name: "Archive", exact: true })
        .click();
      await announcement(page, "Archive requested.");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await actions.getByText("More", { exact: true }).click();
      await page
        .locator("#desktop-primitives")
        .screenshot({ path: "../../.context/desktop-narrow.png" });
      await page.setViewportSize({ width: 1440, height: 1100 });
      await expect.poll(() => actions.getByRole("button").count()).toBe(5);
      await page
        .locator("#desktop-primitives")
        .screenshot({ path: "../../.context/desktop-wide.png" });
    });
  });
};
