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
