import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

const storageKey = "foldworks-workers-v1";

export const workbenchScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
) => {
  describe("workers workbench", () => {
    const bobRow = () =>
      getPage()
        .getByRole("row")
        .filter({
          has: getPage().getByRole("button", { name: "Inspect Bob Williams", exact: true }),
        });
    const inspect = () => getPage().getByRole("complementary", { name: "Worker inspector" });
    const start = async () => {
      const page = getPage();
      await page.setViewportSize({ width: 1600, height: 1100 });
      await page.goto(`${appUrl}/workbench`, { waitUntil: "networkidle" });
      await expect
        .poll(() => page.getByRole("grid", { name: "Workers", exact: true }).isVisible())
        .toBe(true);
    };
    const propose = async (page: Page) => {
      await page.getByRole("button", { name: "Edit Bob Williams state, NY", exact: true }).click();
      await page.getByLabel("Proposed state", { exact: true }).selectOption("CA");
      await page.getByRole("button", { name: "Preview consequences", exact: true }).click();
      await expect
        .poll(() => page.getByRole("region", { name: "Proposed change", exact: true }).isVisible())
        .toBe(true);
    };

    it("inspects, explains, previews, applies, and reloads a recorded change", async () => {
      const page = getPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await start();
      await screenshot("workbench-01-workers");

      // Keyboard entry into a real grid cell action, with the table retained.
      const selectBob = bobRow().getByRole("button", { name: "Inspect Bob Williams", exact: true });
      await selectBob.focus();
      await page.keyboard.press("Enter");
      await expect
        .poll(() =>
          inspect().getByRole("heading", { name: "Bob Williams", exact: true }).isVisible(),
        )
        .toBe(true);
      await expect
        .poll(() =>
          inspect().getByRole("heading", { name: "Open tasks · 2", exact: true }).isVisible(),
        )
        .toBe(true);
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.id))
        .toBe("worker-inspector-heading");
      await screenshot("workbench-02-inspect");

      await inspect().getByRole("button", { name: "Why this result?", exact: true }).click();
      const explanation = page.getByRole("region", {
        name: "Eligibility explanation",
        exact: true,
      });
      await expect
        .poll(() => explanation.getByText("Current value: missing", { exact: true }).isVisible())
        .toBe(true);
      await expect.poll(() => explanation.getByText("✓ Passed", { exact: true }).count()).toBe(2);
      await expect.poll(() => explanation.getByText("× Failed", { exact: true }).count()).toBe(1);
      await page.getByText("Evidence · 3 evaluated inputs", { exact: true }).click();
      await expect
        .poll(() => page.getByText("worker:bob / i9Complete = false", { exact: true }).isVisible())
        .toBe(true);
      await screenshot("workbench-03-explain");

      await inspect().getByRole("button", { name: "Propose state change", exact: true }).click();
      await expect
        .poll(() =>
          page.getByRole("button", { name: "Preview consequences", exact: true }).isDisabled(),
        )
        .toBe(true);
      await page.getByLabel("Proposed state", { exact: true }).selectOption("CA");
      await screenshot("workbench-04-draft");
      await page.getByRole("button", { name: "Preview consequences", exact: true }).click();
      const preview = page.getByRole("region", { name: "Proposed change", exact: true });
      for (const label of [
        "CA Wage Notice",
        "CA Sick Leave Policy",
        "NY Wage Notice",
        "Open tasks: 2 → 3",
      ]) {
        await expect.poll(() => preview.getByText(label, { exact: true }).isVisible()).toBe(true);
      }
      await expect
        .poll(() =>
          bobRow()
            .getByRole("button", { name: "Edit Bob Williams state, NY", exact: true })
            .count(),
        )
        .toBe(1);
      await expect.poll(() => bobRow().getByRole("gridcell").last().textContent()).toBe("2");
      expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.id))
        .toBe("worker-inspector-heading");
      await screenshot("workbench-05-preview");

      await page.getByRole("button", { name: "Apply change", exact: true }).click();
      await expect
        .poll(() =>
          inspect().getByRole("heading", { name: "State change applied", exact: true }).isVisible(),
        )
        .toBe(true);
      await expect
        .poll(() =>
          bobRow()
            .getByRole("button", { name: "Edit Bob Williams state, CA", exact: true })
            .count(),
        )
        .toBe(1);
      await expect.poll(() => bobRow().getByRole("gridcell").last().textContent()).toBe("3");
      await expect
        .poll(() => bobRow().getByText("× Ineligible", { exact: true }).isVisible())
        .toBe(true);
      await expect
        .poll(() => inspect().getByText("State: NY → CA", { exact: true }).isVisible())
        .toBe(true);
      await screenshot("workbench-06-history");

      const saved = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        storageKey,
      );
      expect(saved.revision).toBe(1);
      expect(saved.transactions).toHaveLength(1);
      expect(saved.transactions[0]).toMatchObject({
        workerId: "worker:bob",
        before: "NY",
        after: "CA",
        added: ["CA Wage Notice", "CA Sick Leave Policy"],
        removed: ["NY Wage Notice"],
      });

      await page.reload({ waitUntil: "networkidle" });
      await bobRow().getByRole("button", { name: "Inspect Bob Williams", exact: true }).click();
      await expect
        .poll(() =>
          inspect().getByRole("heading", { name: "Open tasks · 3", exact: true }).isVisible(),
        )
        .toBe(true);
      await inspect().getByRole("button", { name: "History", exact: true }).click();
      await expect
        .poll(() => inspect().getByText(saved.transactions[0].id, { exact: true }).isVisible())
        .toBe(true);
      await screenshot("workbench-07-reloaded");
      await page.getByLabel("Appearance", { exact: true }).selectOption("Dark");
      await expect.poll(() => page.locator("html").getAttribute("data-mode")).toBe("dark");
      await screenshot("workbench-08-dark");
      expect(errors).toEqual([]);
    });

    it("discards a preview without modifying saved data or history", async () => {
      const page = getPage();
      await start();
      await propose(page);
      await page.getByRole("button", { name: "Discard change", exact: true }).click();
      await expect
        .poll(() =>
          inspect().getByRole("heading", { name: "Open tasks · 2", exact: true }).isVisible(),
        )
        .toBe(true);
      await expect
        .poll(() =>
          bobRow()
            .getByRole("button", { name: "Edit Bob Williams state, NY", exact: true })
            .isEnabled(),
        )
        .toBe(true);
      await inspect().getByRole("button", { name: "History", exact: true }).click();
      await expect
        .poll(() => inspect().getByText("No changes recorded.", { exact: true }).isVisible())
        .toBe(true);
      expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
    });

    it("rejects a stale preview after a second tab applies a change", async () => {
      const page = getPage();
      await start();
      await propose(page);
      const second = await page.context().newPage();
      try {
        await second.goto(`${appUrl}/workbench`, { waitUntil: "networkidle" });
        await propose(second);
        await second.getByRole("button", { name: "Apply change", exact: true }).click();
        await expect
          .poll(() =>
            second.getByRole("heading", { name: "State change applied", exact: true }).isVisible(),
          )
          .toBe(true);
        await page.getByRole("button", { name: "Apply change", exact: true }).click();
        await expect
          .poll(() => inspect().getByRole("alert").textContent())
          .toContain("The data changed since this preview");
        await expect
          .poll(() => page.getByRole("button", { name: "Apply change", exact: true }).isDisabled())
          .toBe(true);
        await page.setViewportSize({ width: 1600, height: 1280 });
        await screenshot("workbench-09-conflict");
        const saved = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)!),
          storageKey,
        );
        expect(saved.transactions).toHaveLength(1);
        expect(saved.revision).toBe(1);
      } finally {
        await second.close();
      }
    });

    it("keeps the saved row unchanged when persistence fails", async () => {
      const page = getPage();
      await start();
      await propose(page);
      await page.evaluate(() => {
        Storage.prototype.setItem = () => {
          throw new Error("Browser storage is full.");
        };
      });
      await page.getByRole("button", { name: "Apply change", exact: true }).click();
      await expect
        .poll(() => inspect().getByRole("alert").textContent())
        .toContain("Browser storage is full.");
      await expect
        .poll(() =>
          bobRow()
            .getByRole("button", { name: "Edit Bob Williams state, NY", exact: true })
            .count(),
        )
        .toBe(1);
      expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
      await page.getByRole("button", { name: "Discard change", exact: true }).click();
      await expect
        .poll(() =>
          inspect().getByRole("heading", { name: "Open tasks · 2", exact: true }).isVisible(),
        )
        .toBe(true);
    });

    it("opens a worker's source record a branch at a time", async () => {
      const page = getPage();
      await start();
      await bobRow().getByRole("button", { name: "Inspect Bob Williams", exact: true }).click();
      await inspect().getByRole("button", { name: "Record", exact: true }).click();
      const tree = inspect().getByRole("tree", { name: "Bob Williams record", exact: true });
      const item = (name: string) => tree.getByRole("treeitem", { name, exact: true });
      const node = (id: string) => tree.locator(`[data-value-node="${id}"]`);
      const shifts = item("shifts: list · 22 entries");
      const loadedShifts = () => tree.locator('[data-value-node^="record/shifts/"]').count();

      // The top level arrives with the record; nested branches load when opened, a page at a time.
      await expect.poll(() => shifts.getAttribute("aria-expanded")).toBe("false");
      expect(await loadedShifts()).toBe(0);
      await shifts.click();
      await expect.poll(loadedShifts).toBe(10);
      await expect
        .poll(() => node("record/shifts/0").textContent())
        .toContain('date: "2026-09-30"');
      await item("Show 12 more").click();
      await expect.poll(loadedShifts).toBe(20);
      await expect.poll(() => item("Show 2 more").isVisible()).toBe(true);
      await screenshot("workbench-11-record");

      // The tree takes the keyboard: close shifts, then open the I-9 under documents.
      await shifts.click();
      await expect.poll(loadedShifts).toBe(0);
      for (const key of ["ArrowUp", "ArrowUp", "ArrowRight", "ArrowRight", "ArrowRight"])
        await page.keyboard.press(key);
      await expect.poll(() => item('status: "missing"').isVisible()).toBe(true);
      await expect
        .poll(() => tree.getAttribute("aria-activedescendant"))
        .toContain(encodeURIComponent("record/documents/0"));

      // A saved change appears in the record's history with its before and after data.
      await bobRow()
        .getByRole("button", { name: "Edit Bob Williams state, NY", exact: true })
        .click();
      await page.getByLabel("Proposed state", { exact: true }).selectOption("CA");
      await page.getByRole("button", { name: "Preview consequences", exact: true }).click();
      await page.getByRole("button", { name: "Apply change", exact: true }).click();
      await expect
        .poll(() =>
          inspect().getByRole("heading", { name: "State change applied", exact: true }).isVisible(),
        )
        .toBe(true);
      await inspect().getByRole("button", { name: "Record", exact: true }).click();
      await item("history: list · 1 entry").click();
      await node("record/history/0").click();
      await node("record/history/0/state").click();
      await expect.poll(() => item('before: "NY"').isVisible()).toBe(true);
      await expect.poll(() => item('after: "CA"').isVisible()).toBe(true);
      await expect.poll(() => item('workState: "CA"').count()).toBe(0);
      await node("record/employment").click();
      await expect.poll(() => item('workState: "CA"').isVisible()).toBe(true);
      await screenshot("workbench-12-record-change");
    });

    it("keeps the inspector usable at a narrow viewport", async () => {
      const page = getPage();
      await start();
      await page.setViewportSize({ width: 390, height: 844 });
      await inspect().getByRole("button", { name: "Inspect Bob Williams", exact: true }).click();
      await inspect().getByRole("button", { name: "Why this result?", exact: true }).click();
      await expect
        .poll(() => inspect().getByText("Current value: missing", { exact: true }).isVisible())
        .toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await screenshot("workbench-10-mobile");
    });
  });
};
