import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

export const dataGridEditingScenarios = (getPage: () => Page, appUrl: string, screenshot: (name: string) => Promise<void>) => {
  describe("data grid editing", () => {
    const cell = (row: number, column: number) => getPage().locator(`[data-row-id="person-${row}"] [role="gridcell"]`).nth(column);
    const start = async () => {
      const page = getPage();
      await page.goto(`${appUrl}/data-grid`, { waitUntil: "networkidle" });
      await expect.poll(() => cell(1, 2).isVisible()).toBe(true);
      return page;
    };

    it("stages multiple cells, keeps sorted rows stable, and saves them together", async () => {
      const page = await start();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.locator('[data-column-id="department"] button').click();
      const before = await page.locator('[data-row-id]').evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-id")));
      await cell(1, 2).focus();
      await cell(1, 2).press("Enter");
      const editor = page.getByRole("textbox", { name: "Edit Department" });
      await expect.poll(() => editor.evaluate((element) => element === document.activeElement)).toBe(true);
      await editor.fill("Zoology");
      await editor.press("Enter");
      await expect.poll(() => cell(1, 2).getAttribute("data-dirty")).toBe("true");
      expect(await cell(1, 2).getAttribute("title")).toContain("Original: Engineering");
      expect(await page.locator('[data-row-id]').evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-id")))).toEqual(before);
      await cell(2, 4).dblclick();
      await page.getByRole("textbox", { name: "Edit Location" }).fill("Paris");
      await page.getByRole("button", { name: "Stage edit", exact: true }).click();
      await expect.poll(() => page.getByRole("status").allTextContents()).toContain("2 changes across 2 rows");
      const saveButton = await page.getByRole("button", { name: "Save changes", exact: true }).boundingBox();
      expect(saveButton).not.toBeNull();
      expect(saveButton!.x + saveButton!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await screenshot("data-grid-batch-edits");
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect.poll(() => page.getByRole("button", { name: "Discard changes", exact: true }).isDisabled()).toBe(true);
      await expect.poll(() => page.locator('[data-dirty="true"]').count()).toBe(0);
      expect(await cell(1, 2).textContent()).toBe("Zoology");
      expect(await cell(2, 4).textContent()).toBe("Paris");
      expect(errors).toEqual([]);
    });

    it("validates numbers, cancels edits, and discards staged values", async () => {
      const page = await start();
      await cell(1, 6).dblclick();
      const editor = page.getByRole("spinbutton", { name: "Edit Salary" });
      await editor.fill("-1");
      await editor.press("Enter");
      await expect.poll(() => page.getByRole("alert").textContent()).toBe("Salary must be zero or greater.");
      expect(await page.getByRole("button", { name: "Save changes", exact: true }).isDisabled()).toBe(true);
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
      await expect.poll(() => page.getByRole("status").allTextContents()).toContain("Saving changes…");
      await expect.poll(() => page.locator('[data-dirty="true"]').count()).toBe(0);
      expect(await cell(1, 3).textContent()).toBe("Research");
    });
  });
};
