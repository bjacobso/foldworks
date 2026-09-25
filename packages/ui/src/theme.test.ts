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
  for (const theme of ["shadcn", "blueprint", "office", "google", "apple", "polaris"] as const) {
    it(`${theme} defines every semantic token in light and dark mode`, async () => {
      const css = await readFile(resolve(import.meta.dirname, "themes", `${theme}.css`), "utf8");

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

  it("ships Shadcn as the default palette", async () => {
    const css = await readFile(resolve(import.meta.dirname, "themes", "shadcn.css"), "utf8");

    expect(css).toContain(":root:not([data-theme])");
    expect(css).toContain("--foreground: #09090b");
    expect(css).toContain("--primary: #18181b");
    expect(css).toContain("--muted: #f4f4f5");
    expect(css).toContain("--radius: 0.5rem");
    expect(css).toContain("--background: #ffffff");
    expect(css).toContain("--sidebar: #fafafa");
    expect(css).toContain("--background: #09090b");
    expect(css).toContain("--primary: #fafafa");
  });

  it("maps the Polaris 2 admin palette and geometry", async () => {
    const css = await readFile(resolve(import.meta.dirname, "themes", "polaris.css"), "utf8");

    expect(css).toContain("--foreground: #101010");
    expect(css).toContain("--primary: #101010");
    expect(css).toContain("--ring: #5083f0");
    expect(css).toContain("--radius-button: 999px");
    expect(css).toContain("--radius-panel: 1.25rem");
    expect(css).toContain("--background: #0a0a0a");
    expect(css).toContain("--primary: #fcfcfc");
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
