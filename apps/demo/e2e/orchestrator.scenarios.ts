import type { Page } from "playwright";
import { expect, it } from "vitest";

const poll = <Value>(read: () => Value | Promise<Value>) => expect.poll(read, { timeout: 10_000 });

export const orchestratorScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
) => {
  it("orchestrator runs folded threads, reviews results, promotes with undo, and persists dates", async () => {
    const page = getPage();
    await page.goto(`${appUrl}/orchestrator`, { waitUntil: "networkidle" });
    const status = (id: string) => page.locator(`[data-thread-id="${id}"]`);
    await page.getByRole("button", { name: "Start task", exact: true }).first().click();
    await page.getByRole("button", { name: "Start task", exact: true }).click();
    await page.getByRole("button", { name: "Collapse all branches", exact: true }).click();
    await poll(() => page.locator('[data-outline-row="launch"]').innerText()).toContain(
      "2 needs you",
    );
    await page.getByRole("button", { name: "2 needs you", exact: true }).click();
    await poll(() => page.locator('[data-detail-node="onboarding"]').count()).toBe(1);
    await page.getByRole("button", { name: "Context", exact: true }).click();
    await poll(() => page.locator("[data-context-view]").innerText()).toContain(
      "People arrive with an existing project",
    );
    await page.getByRole("button", { name: "Thread", exact: true }).click();
    await page.getByRole("button", { name: "Accept result", exact: true }).click();
    await poll(() => page.getByRole("button", { name: "1 needs you", exact: true }).count()).toBe(
      1,
    );
    await page.getByRole("button", { name: "Result", exact: true }).click();
    await poll(() => page.locator("[data-result-view]").innerText()).toContain(
      "Open directly into a useful outline",
    );
    await page.getByRole("button", { name: "Expand all branches", exact: true }).click();
    await poll(() => status("onboarding").getAttribute("data-thread-status")).toBe("Ready");
    await page.getByRole("button", { name: "Add result to outline", exact: true }).click();
    await poll(() => page.locator('[data-outline-row="onboarding-result"]').count()).toBe(1);
    await page.getByRole("button", { name: "Undo outline edit", exact: true }).click();
    await poll(() => page.locator('[data-outline-row="onboarding-result"]').count()).toBe(0);
    await page.getByRole("button", { name: "Redo outline edit", exact: true }).click();
    await page.getByLabel("Due date", { exact: true }).fill("2026-10-09");
    await page.getByLabel("Due date", { exact: true }).press("Enter");
    await poll(() => page.locator('[data-outline-row="onboarding"]').innerText()).toContain(
      "Oct 9",
    );
    await screenshot("orchestrator-result");
    await page.reload({ waitUntil: "networkidle" });
    await poll(() => status("onboarding").getAttribute("data-thread-status")).toBe("Ready");
    await poll(() => status("keyboard").getAttribute("data-thread-status")).toBe("Paused");
    await poll(() => page.locator('[data-outline-row="onboarding-result"]').count()).toBe(1);
    await status("onboarding").click();
    await poll(() => page.getByLabel("Due date", { exact: true }).inputValue()).toBe("2026-10-09");
  });

  it("orchestrator attaches through completion, hoists, and preserves typing during background work", async () => {
    const page = getPage();
    await page.goto(`${appUrl}/orchestrator`, { waitUntil: "networkidle" });
    const thought = page.locator('[data-outline-row="thought"] textarea');
    await thought.fill("Explore a small welcome /ag");
    await poll(() => page.getByRole("option", { name: /\/agent/ }).count()).toBe(1);
    await thought.press("Enter");
    await poll(() => thought.inputValue()).toBe("Explore a small welcome");
    await poll(() =>
      page.locator('[data-thread-id="thought"]').getAttribute("data-thread-status"),
    ).toBe("Thread");
    await page.getByRole("button", { name: "Start this task", exact: true }).click();
    const note = page.locator('[data-outline-row="audience"] textarea');
    await note.fill("New people bring their own project. #context");
    await note.press("End");
    await note.press("ArrowLeft");
    const caret = await note.evaluate((element: HTMLTextAreaElement) => element.selectionStart);
    await poll(() =>
      page.locator('[data-thread-id="thought"]').getAttribute("data-thread-status"),
    ).toBe("Needs you");
    expect(await note.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(
      caret,
    );
    expect(await note.evaluate((element) => element === document.activeElement)).toBe(true);
    await page.locator('[data-thread-id="thought"]').click();
    await page.getByRole("button", { name: "Context", exact: true }).click();
    await poll(() => page.locator("[data-context-view]").innerText()).toContain("Scratchpad");
    await poll(() => page.locator("[data-context-view]").innerText()).not.toContain(
      "New people bring",
    );
    await page.getByRole("button", { name: "Focus branch", exact: true }).click();
    await page.getByRole("button", { name: "New thread", exact: true }).click();
    await poll(() => page.locator(".orchestrator__detail-header h2").innerText()).toBe(
      "Untitled thread",
    );
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem("foldworks-outline-workspace-v1")!).items,
    );
    const scratch = saved.find((node: { id: string }) => node.id === "scratch");
    const task = scratch.children.find((node: { id: string }) => node.id === "thought");
    expect(task.children[0].text).toBe("Untitled thread");
  });

  it("orchestrator keeps background runs alive across navigation and exposes discarded results", async () => {
    const page = getPage();
    await page.goto(`${appUrl}/orchestrator`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Start task", exact: true }).first().click();
    await page.getByRole("link", { name: "Outliner", exact: true }).click();
    await poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("foldworks-outline-workspace-v1")!).threads.onboarding
            .agent.runState._tag,
      ),
    ).toBe("AwaitingPermission");
    await page.getByRole("link", { name: "Outline workspace", exact: true }).click();
    await page.locator('[data-thread-id="onboarding"]').click();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await poll(() =>
      page.locator('[data-thread-id="onboarding"]').getAttribute("data-thread-status"),
    ).toBe("Paused");
    await page.getByRole("button", { name: "Result", exact: true }).click();
    await poll(() =>
      page.getByRole("button", { name: "Add result to outline", exact: true }).count(),
    ).toBe(0);
  });

  it("orchestrator works in a narrow dark viewport without horizontal overflow", async () => {
    const page = getPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${appUrl}/orchestrator`, { waitUntil: "networkidle" });
    await page.getByLabel("Appearance", { exact: true }).selectOption("Dark");
    await page.locator('[data-thread-id="onboarding"]').click();
    await page.getByRole("button", { name: "Context", exact: true }).click();
    await poll(() => page.locator("[data-context-view]").isVisible()).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await screenshot("orchestrator-mobile-dark");
  });
};
