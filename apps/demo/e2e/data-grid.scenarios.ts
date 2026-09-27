import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

export const dataGridEditingScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
) => {
  describe("data grid editing", () => {
    const cell = (row: number, column: number) =>
      getPage().locator(`[data-row-id="person-${row}"] [role="gridcell"]`).nth(column);
    const start = async () => {
      const page = getPage();
      await page.goto(`${appUrl}/data-grid`, { waitUntil: "networkidle" });
      await expect.poll(() => cell(1, 2).isVisible()).toBe(true);
      return page;
    };

    it("extends a rectangular selection and copies it as TSV", async () => {
      const page = await start();
      await cell(1, 2).click();
      await cell(1, 2).press("Shift+ArrowRight");
      await cell(1, 3).press("Shift+ArrowDown");

      await expect
        .poll(() => page.locator('[role="grid"]').getAttribute("data-selection-size"))
        .toBe("4");
      expect(await page.locator('[role="gridcell"][data-selected="true"]').count()).toBe(4);
      await expect.poll(() => cell(2, 3).getAttribute("data-selection-focus")).toBe("true");

      await page.evaluate(() => {
        (window as typeof window & { __gridCopy?: string }).__gridCopy = "";
        document.addEventListener(
          "copy",
          (event) => {
            (window as typeof window & { __gridCopy?: string }).__gridCopy =
              event.clipboardData?.getData("text/plain") ?? "";
          },
          { once: true },
        );
      });
      await cell(2, 3).press("Control+c");
      expect(
        await page.evaluate(() => (window as typeof window & { __gridCopy?: string }).__gridCopy),
      ).toBe("Engineering\tSoftware engineer\nOperations\tData analyst");

      await cell(2, 3).press("ArrowLeft");
      await expect
        .poll(() => page.locator('[role="grid"]').getAttribute("data-selection-size"))
        .toBe("1");
    });

    it("pastes a TSV matrix into editable cells and saves it", async () => {
      const page = await start();
      await cell(1, 2).click();
      await cell(1, 2).evaluate((element) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData(
          "text/plain",
          "Research\tPrincipal engineer\nFinance\tFinancial analyst",
        );
        element.dispatchEvent(
          new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData,
          }),
        );
      });

      await expect
        .poll(() => page.locator('[role="grid"]').getAttribute("data-selection-size"))
        .toBe("4");
      await expect.poll(() => page.locator('[data-dirty="true"]').count()).toBe(4);
      await expect
        .poll(() =>
          page.evaluate(() => document.activeElement?.getAttribute("data-grid-cell-position")),
        )
        .toBe("1:3");
      expect(await cell(1, 2).textContent()).toContain("Research");
      expect(await cell(1, 3).textContent()).toContain("Principal engineer");
      expect(await cell(2, 2).textContent()).toContain("Finance");
      expect(await cell(2, 3).textContent()).toContain("Financial analyst");
      await expect
        .poll(() => page.getByRole("status").allTextContents())
        .toContain("4 changes across 2 rows");

      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect.poll(() => page.locator('[data-dirty="true"]').count()).toBe(0);
      expect(await cell(2, 3).textContent()).toBe("Financial analyst");
    });

    it("stages multiple cells, keeps sorted rows stable, and saves them together", async () => {
      const page = await start();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await cell(1, 2).click();
      await page.locator('[data-column-id="department"] .fk-data-grid__header-button').click();
      await expect
        .poll(() => page.locator('[data-column-id="department"]').getAttribute("aria-sort"))
        .toBe("ascending");
      const before = await cell(1, 2).getAttribute("data-grid-cell-position");
      await cell(1, 2).focus();
      await cell(1, 2).press("Enter");
      const editor = page.getByRole("textbox", { name: "Edit Department" });
      await expect
        .poll(() => editor.evaluate((element) => element === document.activeElement))
        .toBe(true);
      await editor.fill("Zoology");
      await editor.press("Enter");
      await expect.poll(() => cell(1, 2).getAttribute("data-dirty")).toBe("true");
      expect(await cell(1, 2).getAttribute("title")).toContain("Original: Engineering");
      expect(await cell(1, 2).getAttribute("data-grid-cell-position")).toBe(before);
      await expect.poll(() => cell(119, 4).isVisible()).toBe(true);
      await cell(119, 4).dblclick();
      await page.getByRole("textbox", { name: "Edit Location" }).fill("Paris");
      await page.getByRole("button", { name: "Stage edit", exact: true }).click();
      await expect
        .poll(() => page.getByRole("status").allTextContents())
        .toContain("2 changes across 2 rows");
      const saveButton = await page
        .getByRole("button", { name: "Save changes", exact: true })
        .boundingBox();
      expect(saveButton).not.toBeNull();
      expect(saveButton!.x + saveButton!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await screenshot("data-grid-batch-edits");
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect
        .poll(() => page.getByRole("button", { name: "Discard changes", exact: true }).isDisabled())
        .toBe(true);
      await expect.poll(() => page.locator('[data-dirty="true"]').count()).toBe(0);
      expect(await cell(119, 4).textContent()).toBe("Paris");
      await page.locator(".fk-data-grid__scroller").evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        element.dispatchEvent(new Event("scroll"));
      });
      await expect.poll(() => cell(1, 2).textContent()).toBe("Zoology");
      expect(errors).toEqual([]);
    });

    it("validates numbers, cancels edits, and discards staged values", async () => {
      const page = await start();
      await cell(1, 6).dblclick();
      const editor = page.getByRole("spinbutton", { name: "Edit Salary" });
      await editor.fill("-1");
      await editor.press("Enter");
      await expect
        .poll(() => page.getByRole("alert").textContent())
        .toBe("Salary must be zero or greater.");
      expect(
        await page.getByRole("button", { name: "Save changes", exact: true }).isDisabled(),
      ).toBe(true);
      await editor.fill("95000");
      await editor.press("Enter");
      await expect.poll(() => cell(1, 6).textContent()).toContain("$95,000");
      await cell(1, 6).press("Enter");
      await editor.fill("100000");
      await editor.press("Escape");
      await expect.poll(() => cell(1, 6).textContent()).toContain("$95,000");
      await page.getByRole("button", { name: "Discard changes", exact: true }).click();
      await expect.poll(() => cell(1, 6).textContent()).toBe("$72,000");
    });

    it("edits selects and checkboxes and supports immediate saving", async () => {
      const page = await start();
      await cell(1, 1).dblclick();
      await page.getByRole("combobox", { name: "Edit Status" }).selectOption("On leave");
      await page.getByRole("button", { name: "Stage edit", exact: true }).click();
      await expect.poll(() => cell(1, 1).textContent()).toContain("On leave");
      await cell(1, 7).dblclick();
      const checkbox = page.getByRole("checkbox", { name: "Edit Equipment issued" });
      await checkbox.check();
      await checkbox.press("Enter");
      await expect.poll(() => cell(1, 7).textContent()).toContain("Yes");
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect.poll(() => page.locator('[data-dirty="true"]').count()).toBe(0);
      await page.getByRole("combobox", { name: "Save behavior" }).selectOption("Immediate");
      await cell(1, 3).dblclick();
      const editor = page.getByRole("textbox", { name: "Edit Role" });
      await editor.fill("Research");
      await editor.press("Enter");
      await expect
        .poll(() => page.getByRole("status").allTextContents())
        .toContain("Saving changes…");
      await expect.poll(() => page.locator('[data-dirty="true"]').count()).toBe(0);
      expect(await cell(1, 3).textContent()).toBe("Research");
    });
  });
};

export const dataGridCoverageScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
) => {
  describe("data grid row groups", () => {
    const start = async () => {
      const page = getPage();
      await page.goto(`${appUrl}/data-grid?example=Coverage`, { waitUntil: "networkidle" });
      const grid = page.locator('[data-grid-id="i9-coverage"]');
      await expect.poll(() => grid.isVisible()).toBe(true);
      return { page, grid };
    };
    const cell = (rowId: string, columnId: string) =>
      getPage().locator(`[data-row-id="${rowId}"] [data-cell-column-id="${columnId}"]`);

    it("virtualizes 1,467 grouped rows and filters gaps without losing expansion", async () => {
      const { page, grid } = await start();
      expect(await grid.getAttribute("role")).toBe("treegrid");
      expect(await grid.getAttribute("aria-rowcount")).toBe("1468");
      expect(await grid.locator('[role="row"][data-row-id]').count()).toBeLessThan(60);
      expect(
        await page.locator('[data-row-id="field-002:condition-1"]').getAttribute("data-tone"),
      ).toBe("danger");
      expect(await page.locator('[data-row-id="field-002"]').getAttribute("data-tone")).toBe(
        "warning",
      );

      await page.getByRole("button", { name: /^Gaps only/ }).click();
      await expect.poll(() => grid.getAttribute("aria-rowcount")).toBe("162");
      await page.locator('[data-group-toggle="field-002"]').click();
      await expect
        .poll(() => page.locator('[data-row-id="field-002"]').getAttribute("aria-expanded"))
        .toBe("false");
      const collapsedGapCount = Number(await grid.getAttribute("aria-rowcount"));
      expect(collapsedGapCount).toBeLessThan(162);

      // The group key survives both filter changes, so field-002 stays collapsed.
      await page.getByRole("button", { name: /^Gaps only/ }).click();
      await expect
        .poll(() => grid.getAttribute("aria-rowcount"))
        .not.toBe(String(collapsedGapCount));
      expect(await page.locator('[data-row-id="field-002"]').getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(Number(await grid.getAttribute("aria-rowcount"))).toBeLessThan(1468);
      await page.locator('[data-group-toggle="field-002"]').click();
      await expect.poll(() => grid.getAttribute("aria-rowcount")).toBe("1468");
      await screenshot("data-grid-coverage");
    });

    it("selects rows, navigates the tree by keyboard, and shows stateless details", async () => {
      const { page, grid } = await start();
      await cell("field-003", "page").click();
      await expect
        .poll(() => page.locator('[data-row-id="field-003"]').getAttribute("aria-selected"))
        .toBe("true");
      await expect
        .poll(() => page.locator("[data-coverage-selection]").textContent())
        .toContain("Middle initial");

      const focusedRow = () =>
        page.evaluate(() =>
          document.activeElement?.closest("[data-row-id]")?.getAttribute("data-row-id"),
        );
      await cell("field-003", "label").click();
      await page.keyboard.press("ArrowLeft");
      await expect
        .poll(() => page.locator('[data-row-id="field-003"]').getAttribute("aria-expanded"))
        .toBe("false");
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => page.locator('[data-row-id="field-003"]').getAttribute("aria-expanded"))
        .toBe("true");
      await page.keyboard.press("ArrowDown");
      await expect.poll(focusedRow).toBe("field-003:condition-1");
      await page.keyboard.press("ArrowLeft");
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.activeElement?.closest("[data-row-id]")?.getAttribute("data-row-id"),
          ),
        )
        .toBe("field-003");

      await page.keyboard.press("Control+End");
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.activeElement?.closest("[data-row-id]")?.getAttribute("data-row-id"),
          ),
        )
        .toBe("field-279:condition-3");
      expect(await grid.locator('[role="row"][data-row-id]').count()).toBeLessThan(60);
      await page.keyboard.press("Control+Home");
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.activeElement?.closest("[data-row-id]")?.getAttribute("data-row-id"),
          ),
        )
        .toBe("field-001");
      await expect
        .poll(() =>
          grid.locator(".fk-data-grid__scroller").evaluate((element) => element.scrollTop),
        )
        .toBe(0);

      const details = page.locator(".fk-data-grid__hover-details");
      await cell("field-001", "journey-2").hover();
      await expect
        .poll(() => details.evaluate((element) => element.matches(":popover-open")))
        .toBe(true);
      expect(await details.textContent()).toContain("J2 · Lawful permanent resident");
      await page.keyboard.press("Escape");
      await expect
        .poll(() => details.evaluate((element) => element.matches(":popover-open")))
        .toBe(false);
    });
  });
};
