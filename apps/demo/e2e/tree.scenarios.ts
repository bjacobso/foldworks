import type { Page } from "playwright";
import { expect, it } from "vitest";

export const treeScenarios = (getPage: () => Page, appUrl: string): void => {
  it("tree explorer selects, renames and reorders form pages with undo", async () => {
    const page = getPage();
    await page.goto(`${appUrl}/form-builder?example=Handoff&mode=Editor`, { waitUntil: "networkidle" });
    const tree = page.getByRole("tree", { name: "Form outline" });
    await tree.getByText("Emergency contact", { exact: true }).click();
    await expect.poll(() => page.getByRole("heading", { name: "Emergency contact", exact: true }).isVisible()).toBe(true);
    await tree.press("ArrowUp");
    // Moving focus alone does not open a different page.
    expect(await page.getByRole("heading", { name: "Emergency contact", exact: true }).isVisible()).toBe(true);
    await tree.press("Enter");
    await expect.poll(() => page.getByRole("heading", { name: "About you", exact: true }).isVisible()).toBe(true);
    await tree.press("F2");
    const rename = page.getByRole("textbox", { name: "Rename About you", exact: true });
    await expect.poll(() => rename.evaluate(el => document.activeElement === el)).toBe(true);
    await rename.fill("Profile"); await rename.press("Enter");
    await expect.poll(() => tree.getByRole("treeitem", { name: "Profile", exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByRole("heading", { name: "Profile", exact: true }).isVisible()).toBe(true);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => tree.getByRole("treeitem", { name: "About you", exact: true }).count()).toBe(1);

    await tree.getByText("Emergency contact", { exact: true }).click();
    await tree.press("Alt+ArrowUp");
    const section = tree.getByRole("treeitem", { name: "Employee details", exact: true });
    await expect.poll(() => section.getByRole("group").getByRole("treeitem").first().getAttribute("aria-label")).toBe("Emergency contact");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => section.getByRole("group").getByRole("treeitem").first().getAttribute("aria-label")).toBe("About you");
    const actions = page.getByRole("group", { name: "Form outline actions" });
    expect(await actions.getByRole("button", { name: "Outdent", exact: true }).isEnabled()).toBe(false);
    await tree.press("F2");
    const cancel = page.getByRole("textbox", { name: "Rename Emergency contact" });
    await cancel.fill("Discard me"); await cancel.press("Escape");
    expect(await tree.getByRole("treeitem", { name: "Discard me", exact: true }).count()).toBe(0);
    await page.getByRole("button", { name: "Card view", exact: true }).click();
    await expect.poll(() => page.locator('[data-form-page-id="handoff-emergency"]').count()).toBe(1);
    await page.getByRole("button", { name: "Tree view", exact: true }).click();
    await page.getByRole("button", { name: "Add section", exact: true }).click();
    await expect.poll(() => tree.getByRole("treeitem", { name: "New section", exact: true }).getAttribute("aria-selected")).toBe("true");
    await page.getByRole("button", { name: "Add page", exact: true }).click();
    await expect.poll(() => tree.getByRole("treeitem", { name: "New section", exact: true })
      .getByRole("treeitem", { name: "Untitled page", exact: true }).count()).toBe(1);
  });

  it("tree explorer navigates folders and moves files without losing editor content", async () => {
    const page = getPage();
    await page.goto(`${appUrl}/code-editor`, { waitUntil: "networkidle" });
    const tree = page.getByRole("tree", { name: "Workspace files" });
    const working = page.getByRole("textbox", { name: "Working document", exact: true });
    await working.fill('{"keep":true}');
    await tree.getByText("configuration.json", { exact: true }).click();
    await tree.press("Alt+ArrowLeft");
    await expect.poll(() => tree.getByRole("treeitem", { name: "configuration.json", exact: true }).getAttribute("aria-level")).toBe("2");
    await tree.press("Alt+ArrowRight");
    await expect.poll(() => tree.getByRole("treeitem", { name: "configuration.json", exact: true }).getAttribute("aria-level")).toBe("3");
    await tree.press("ArrowLeft"); // Parent folder.
    await tree.press("ArrowLeft"); // Collapse it.
    await expect.poll(() => tree.getByRole("treeitem", { name: "configuration.json", exact: true }).count()).toBe(0);
    await tree.press("ArrowRight"); await tree.press("ArrowRight");
    await expect.poll(() => tree.getAttribute("aria-activedescendant")).toContain("working");
    await page.getByRole("button", { name: "Hide Reference", exact: true }).click();
    await tree.getByText("configuration.ts", { exact: true }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "TypeScript reference", exact: true }).isVisible()).toBe(true);
    expect(await working.inputValue()).toBe('{"keep":true}');
    await tree.press("Home"); await tree.press("e");
    await expect.poll(() => tree.getAttribute("aria-activedescendant")).toContain("examples");
    await tree.press("F2");
    const rename = page.getByRole("textbox", { name: "Rename examples", exact: true });
    await rename.fill("samples");
    await page.getByRole("button", { name: "Save name", exact: true }).click();
    await expect.poll(() => tree.getByRole("treeitem", { name: "samples", exact: true }).count()).toBe(1);
  });
};
