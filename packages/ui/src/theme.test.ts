import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const requiredThemeTokens = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

describe("theme contract", () => {
  for (const theme of ["neutral", "zinc", "blue"] as const) {
    it(`${theme} defines every semantic token in light and dark mode`, async () => {
      const css = await readFile(
        resolve(import.meta.dirname, "themes", `${theme}.css`),
        "utf8",
      );

      for (const token of requiredThemeTokens) {
        const declarations = css.match(new RegExp(`--${token}:`, "g")) ?? [];
        expect(declarations, `--${token}`).toHaveLength(2);
      }
    });
  }

  it("derives interaction roles from the semantic theme", async () => {
    const css = await readFile(resolve(import.meta.dirname, "base.css"), "utf8");

    expect(css).toContain("--primary-hover: color-mix(in oklch, var(--primary)");
    expect(css).toContain("--ring-muted: color-mix(in oklch, var(--ring)");
    expect(css).toContain("--destructive-surface: color-mix(in oklch, var(--destructive)");
    expect(css).toContain("--foldworks-ui-selection: color-mix(in oklch, var(--primary)");
    expect(css).toContain("--foldworks-ui-selection-foreground: var(--primary)");
    expect(css).toContain("--foldworks-ui-selection-border: var(--primary)");
    expect(css).toContain("--foldworks-ui-drop-target: color-mix(in oklch, var(--primary)");
    expect(css).toContain("--foldworks-ui-drop-target-active-border: var(--primary)");
  });

  it("ships the neutral palette as the default theme", async () => {
    const css = await readFile(resolve(import.meta.dirname, "themes", "neutral.css"), "utf8");

    expect(css).toContain("--foreground: oklch(0.145 0 0)");
    expect(css).toContain("--primary: oklch(0.205 0 0)");
    expect(css).toContain("--muted: oklch(0.97 0 0)");
    expect(css).toContain("--chart-5: oklch(0.269 0 0)");
    expect(css).toContain("--radius: 0.45rem");
    expect(css).toContain("--background: oklch(0.96 0 0)");
    expect(css).toContain("--sidebar: oklch(0.935 0 0)");
    expect(css).toContain("--background: oklch(0.145 0 0)");
    expect(css).toContain("--primary: oklch(0.922 0 0)");
  });

  it("includes a low-specificity browser reset", async () => {
    const css = await readFile(resolve(import.meta.dirname, "base.css"), "utf8");

    expect(css).toContain("@layer foldworks-reset");
    expect(css).toContain("box-sizing: border-box");
    expect(css).toContain("text-size-adjust: 100%");
    expect(css).toContain(":where(button, input, optgroup, select, textarea)");
    expect(css).toContain(":where(img, picture, video, canvas, svg)");
    expect(css).toContain(":where([hidden])");
  });
});
