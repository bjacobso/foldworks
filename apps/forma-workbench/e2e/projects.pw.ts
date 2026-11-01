import { expect, test } from "@playwright/test";

test("loads example projects and keeps scratch definitions and errors in the REPL", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("combobox", { name: "Example project" }).selectOption("functions");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  const input = page.getByRole("textbox", { name: "REPL input" });
  const log = page.getByRole("log", { name: "REPL history" });
  await page.getByRole("button", { name: "Evaluate", exact: true }).click();
  await expect(log).toContainText("[4 16 64]");
  await input.fill("(define answer (square 7))");
  await input.press("Control+Enter");
  await expect(log).toContainText("define answer");
  await input.fill("(+ answer 1)");
  await input.press("Control+Enter");
  await expect(log).toContainText("50");
  await input.fill("missing-name");
  await input.press("Control+Enter");
  await expect(log).toContainText(/unbound|undefined|not found/i);
  await input.fill("answer");
  await input.press("Control+Enter");
  await expect(log).toContainText("49");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await input.press("Control+Enter");
  await expect(log).toContainText(/unbound|undefined|not found/i);
});

test("jumps across a re-export, preserves file edits, and evaluates current modules", async ({
  page,
}) => {
  await page.goto("./?project=modules");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  const tree = page.getByRole("tree", { name: "Program" });
  const use = tree.getByRole("treeitem", { name: /^with-tax / }).locator("textarea");
  await use.click();
  await use.press("Home");
  await use.press("ArrowRight");
  await use.press("F12");
  await expect(page.getByRole("button", { name: "pricing.forma", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("textbox", { name: "Forma source" })).toHaveValue(/define with-tax/);
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "main.forma", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText(/0 errors/)).toBeVisible();
  await page.getByRole("button", { name: "Evaluate", exact: true }).click();
  await expect(page.getByRole("log", { name: "REPL history" })).toContainText("99");
  await page.getByRole("button", { name: "pricing.forma", exact: true }).click();
  const source = page.getByRole("textbox", { name: "Forma source" });
  await source.fill("(export with-tax)\n(define with-tax [amount] (+ amount 5))\n");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  await page.getByRole("button", { name: "main.forma", exact: true }).click();
  await expect(page.getByText(/0 errors/)).toBeVisible();
  await page.getByRole("button", { name: "Evaluate", exact: true }).click();
  await expect(page.getByRole("log", { name: "REPL history" })).toContainText("95");
  await page.getByRole("button", { name: "pricing.forma", exact: true }).click();
  await expect(source).toHaveValue(/amount 5/);
  await page.getByRole("combobox", { name: "Example project" }).selectOption("functions");
  await page.getByRole("combobox", { name: "Example project" }).selectOption("modules");
  await expect(source).toHaveValue(/amount 5/);
  await page.getByRole("button", { name: "Reset example", exact: true }).click();
  await expect(page.getByRole("button", { name: "main.forma", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("log", { name: "REPL history" })).toBeEmpty();
});

test("adds a module and imports it from an edited file", async ({ page }) => {
  await page.goto("./?project=functions");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  await page.getByRole("textbox", { name: "New file path" }).fill("lib/helper.forma");
  await page.getByRole("button", { name: "Add file", exact: true }).click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Forma source" })
    .fill("(export triple) (define triple [x] (* x 3))");
  await expect(page.getByText(/0 errors/)).toBeVisible();
  await page.getByRole("button", { name: "functions.forma", exact: true }).click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Forma source" })
    .fill('(import "./lib/helper.forma" [triple]) (triple 14)');
  await expect(page.getByText(/0 errors/)).toBeVisible();
  await page.getByRole("textbox", { name: "REPL input" }).fill("(triple 15)");
  await page.getByRole("button", { name: "Evaluate", exact: true }).click();
  await expect(page.getByRole("log", { name: "REPL history" })).toContainText("45");
});
