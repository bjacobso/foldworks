import type { Page } from "playwright";
import { expect, it } from "vitest";

const center = async (page: Page, selector: string) => {
  const box = await page.locator(selector).first().boundingBox();
  if (box === null) throw new Error(`${selector} is not visible.`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
};

const drag = async (page: Page, from: { x: number; y: number }, to: { x: number; y: number }) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
};

const announcement = (page: Page) => page.locator('main > [aria-live="assertive"]').textContent();

export const statechartScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
): void => {
  it("statechart editor nests, connects, simulates, and opens submachines", async () => {
    const page = getPage();
    await page.goto(`${appUrl}/statechart`, { waitUntil: "networkidle" });
    await expect.poll(() => page.locator("[data-edge-id]").count()).toBe(17);
    await screenshot("statechart-editor");

    const cancelled = await center(page, '[data-state-id="cancelled"]');
    const details = await center(page, '[data-state-id="details"]');
    await drag(page, cancelled, {
      x: details.box.x + details.box.width - 30,
      y: details.box.y + details.box.height - 24,
    });
    await expect.poll(() => announcement(page)).toBe("Cancelled moved into Details.");

    await page.locator('[data-state-id="picking"]').click();
    const port = await center(page, '[data-diagram-port-node="picking"]');
    const emailing = await center(page, '[data-state-id="emailing"]');
    await drag(page, port, emailing);
    await expect.poll(() => page.locator("[data-edge-id]").count()).toBe(18);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => page.locator("[data-edge-id]").count()).toBe(17);

    await page.getByRole("button", { name: "Simulate", exact: true }).click();
    for (const edgeId of ["t-checkout", "t-next", "t-pay", "t-paid"]) {
      await page.locator(`[data-fire-transition="${edgeId}"]`).click();
    }
    await expect
      .poll(() => page.locator('[data-active="true"][data-state-kind="atomic"]').count())
      .toBe(2);
    await screenshot("statechart-simulation");

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Open Payment", exact: true }).click();
    await expect.poll(() => page.locator('[data-state-id="authorizing"]').count()).toBe(1);
    await page
      .getByRole("navigation", { name: "Machine path" })
      .getByRole("button", { name: "Checkout" })
      .click();
    await expect.poll(() => page.locator('[data-state-id="cart"]').count()).toBe(1);
  });
};
