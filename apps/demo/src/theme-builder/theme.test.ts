import { describe, expect, it } from "vitest";
import {
  contrast,
  contrastLabel,
  oklch,
  oklchToRgb,
  parseColor,
  readableForeground,
  rgbToOklch,
  toHex,
} from "./color";
import { contrastPairs, modes, tokenNames } from "./contract";
import { exportFoldworks, exportJson, exportTailwind, slugify } from "./export";
import { fromPreset, type WorkingTheme } from "./model";
import { randomTheme, resolveTheme } from "./palette";
import {
  deserializeTheme,
  restoredTheme,
  serializeTheme,
  themeFromHash,
  themeHash,
  validateTheme,
} from "./serialization";

// A synthetic complete contract, not a copy of any preset.
const fixture = (): WorkingTheme => {
  const baseline = Object.fromEntries(tokenNames.map((name) => [name, "#eeeeee"]));
  Object.assign(baseline, {
    foreground: "#222222",
    "card-foreground": "#222222",
    "popover-foreground": "#222222",
    "secondary-foreground": "#222222",
    "sidebar-foreground": "#222222",
    primary: "#414141",
    "primary-foreground": "#ffffff",
    destructive: "#bb2222",
    "destructive-foreground": "#ffffff",
    "muted-foreground": "#555555",
    radius: "0.4rem",
    "radius-panel": "0.6rem",
    "radius-button": "0.4rem",
    "radius-button-sm": "0.3rem",
    "radius-badge": "999px",
    "font-sans": "Inter, sans-serif",
    "shadow-card": "none",
    "shadow-panel": "none",
    "shadow-float": "none",
  });
  return fromPreset("Shadcn", {
    light: baseline,
    dark: {
      ...baseline,
      background: "#161616",
      foreground: "#eeeeee",
      card: "#222222",
      "card-foreground": "#eeeeee",
      popover: "#222222",
      "popover-foreground": "#eeeeee",
      secondary: "#333333",
      "secondary-foreground": "#eeeeee",
      sidebar: "#222222",
      "sidebar-foreground": "#eeeeee",
    },
  });
};
describe("theme color math", () => {
  it("matches known WCAG ratios and distinguishes AA from AAA", () => {
    expect(contrast("#000000", "#ffffff")).toBe(21);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.478, 3);
    expect(contrastLabel(7)).toBe("AAA");
    expect(contrastLabel(4.5)).toBe("AA");
    expect(contrastLabel(4.49)).toBe("4.49:1");
    expect(contrast("bad", "#ffffff")).toBeUndefined();
  });
  it("composites translucent foregrounds and requires a backing for translucent surfaces", () => {
    expect(contrast("rgb(0 0 0 / 50%)", "#ffffff")).toBeCloseTo(3.977, 3);
    expect(contrast("#ffffff", "rgb(0 0 0 / 50%)", "#ffffff")).toBeCloseTo(3.977, 3);
    expect(contrast("#fff", "rgb(0 0 0 / 50%)")).toBeUndefined();
    expect(toHex("#1234")).toBe("#112233");
    expect(parseColor("oklch(.5 .1 120 .4)")).toBeUndefined();
    expect(parseColor("rgb(0 0 0 / 150%)")).toBeUndefined();
  });
  it("round-trips RGB through OKLCH and clips out-of-gamut channels", () => {
    for (const color of ["#e46731", "#2356af", "#148854", "#abcdef", "#111111"]) {
      const rgb = parseColor(color)!;
      const converted = oklchToRgb(rgbToOklch(rgb));
      converted.forEach((channel, index) => expect(channel).toBeCloseTo(rgb[index]!, 5));
      expect(toHex(oklch(...rgbToOklch(rgb)))).toBe(color);
    }
    expect(oklchToRgb([0.8, 0.4, 50]).every((channel) => channel >= 0 && channel <= 1)).toBe(true);
  });
  it("supports hex, RGB, and percentage OKLCH and rejects incomplete input", () => {
    expect(toHex("#abc")).toBe("#aabbcc");
    expect(toHex("rgb(100% 0% 0%)")).toBe("#ff0000");
    expect(toHex("oklch(100% 0 0)")).toBe("#ffffff");
    for (const value of [
      "#12",
      "oklch(2 0 0)",
      "oklch(.5 -1 0)",
      "rgb(NaN 0 0)",
      "red; color: blue",
      "oklch(.4 .1)",
    ])
      expect(parseColor(value)).toBeUndefined();
  });
  it("chooses a foreground passing AA for any opaque primary", () => {
    for (let hue = 0; hue < 360; hue += 15)
      for (const l of [0.2, 0.4, 0.55, 0.7, 0.9]) {
        const primary = oklch(l, 0.2, hue);
        expect(contrast(readableForeground(primary), primary)).toBeGreaterThanOrEqual(4.5);
      }
  });
});
describe("theme palette and token resolution", () => {
  it("preserves every preset token before edits", () => {
    const theme = fixture();
    expect(resolveTheme(theme)).toEqual(theme.baseline);
    expect(tokenNames).toContain("foldworks-ui-selection");
    expect(tokenNames).toContain("shadow-float");
    expect(tokenNames).not.toContain("foldworks-ui-background");
  });
  it("generates coherent AA palettes for every neutral and constrained random seed", () => {
    for (const neutral of ["zinc", "slate", "stone", "gray", "neutral"] as const) {
      for (const seed of [0, 0.2, 0.4, 0.6, 0.8, 0.999]) {
        const theme = { ...randomTheme(fixture(), seed), neutral };
        const palette = resolveTheme(theme);
        for (const mode of modes)
          for (const [label, fg, bg] of contrastPairs) {
            expect(
              contrast(palette[mode][fg]!, palette[mode][bg]!),
              `${neutral}/${seed}/${mode}/${label}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        expect(new Set([1, 2, 3, 4, 5].map((i) => palette.light[`chart-${i}`])).size).toBe(5);
      }
    }
  });
  it("keeps manual overrides through generation and reset removes only that override", () => {
    const theme = {
      ...fixture(),
      primary: "#1256ab",
      neutral: "slate" as const,
      overrides: { light: { primary: "#ad3180" }, dark: {} },
    };
    expect(resolveTheme(theme).light.primary).toBe("#ad3180");
    expect(resolveTheme(theme).light["primary-hover"]).toContain("var(--primary)");
    expect(resolveTheme(theme).light["ring-muted"]).toContain("var(--ring)");
    expect(resolveTheme({ ...theme, overrides: { light: {}, dark: {} } }).light.primary).toBe(
      "#1256ab",
    );
  });
  it("links radii, preserves unlinked surfaces, and resolves treatment and elevation", () => {
    const theme = {
      ...fixture(),
      radius: 0.8,
      radii: { "radius-panel": "0.2rem" },
      outlined: true,
      elevation: "raised" as const,
    };
    for (const mode of modes) {
      const tokens = resolveTheme(theme)[mode];
      expect(tokens.radius).toBe("0.8rem");
      expect(tokens["radius-button"]).toBe("0.8rem");
      expect(parseFloat(tokens["radius-button-sm"]!)).toBeCloseTo(0.64);
      expect(tokens["radius-panel"]).toBe("0.2rem");
      expect(tokens["badge-border"]).toBe("currentColor");
      expect(tokens["shadow-float"]).toContain("40px");
    }
  });
});
describe("theme exports and serialization", () => {
  it("exports both modes with exactly the resolved preview contract", () => {
    const theme = { ...fixture(), name: "My Studio!", primary: "#1256ab", radius: 0.75 };
    const resolved = resolveTheme(theme),
      css = exportFoldworks(theme);
    expect(css).toContain('[data-theme="my-studio"]');
    expect(css).toContain('[data-theme="my-studio"][data-mode="dark"]');
    expect(css).toContain('@import "@foldworks/ui/base.css"');
    const blocks = [...css.matchAll(/\{\n([\s\S]*?)\n\}/g)];
    for (const [index, mode] of modes.entries()) {
      const parsed = Object.fromEntries(
        [...blocks[index]![1]!.matchAll(/  --([\w-]+): (.*);/g)].map((match) => [
          match[1],
          match[2],
        ]),
      );
      expect(parsed).toEqual(resolved[mode]);
    }
    expect(css).not.toContain("undefined");
  });
  it("exports usable Tailwind mappings and JSON including mode-specific shape", () => {
    const theme = { ...fixture(), primary: "#1256ab", radius: 0.75 };
    const tailwind = exportTailwind(theme);
    expect(tailwind).toContain(":root {");
    expect(tailwind).toContain(".dark {");
    expect(tailwind).toContain("@theme inline");
    expect(tailwind).toContain("--color-sidebar-primary: var(--sidebar-primary)");
    expect(tailwind).toContain("--font-sans: var(--theme-font-sans)");
    expect(tailwind).not.toContain("--font-sans: var(--font-sans)");
    const json = JSON.parse(exportJson(theme));
    expect(json.light).toEqual(resolveTheme(theme).light);
    expect(json.dark).toEqual(resolveTheme(theme).dark);
    expect(json.shape.radius).toEqual({ light: "0.75rem", dark: "0.75rem" });
  });
  it("slugifies arbitrary selector names safely", () => {
    expect(slugify('  Café Studio / v2 " ] ')).toBe("cafe-studio-v2");
    expect(slugify("!!!")).toBe("custom");
  });
  it("round-trips complete themes, Unicode names, and mode overrides through the URL", () => {
    const theme = {
      ...fixture(),
      name: "Café 日本語",
      primary: "#1256ab",
      radius: 1.125,
      overrides: { light: { "chart-2": "oklch(0.65 0.1 160)" }, dark: { primary: "#9988ff" } },
    };
    const hash = themeHash(theme);
    expect(hash).toMatch(/^#theme=[A-Za-z0-9_-]+$/);
    expect(themeFromHash(hash)).toEqual(theme);
    expect(deserializeTheme(serializeTheme(theme))).toEqual(theme);
    expect(validateTheme({ ...theme, radii: { "radius-button": ".5rem" } })).toBeDefined();
    expect(restoredTheme(hash, serializeTheme(fixture()))).toEqual(theme);
    expect(restoredTheme("#theme=broken", serializeTheme(theme))).toEqual(theme);
  });
  it("rejects unsupported versions, incomplete contracts, hostile CSS, and malformed links", () => {
    for (const theme of [
      { ...fixture(), version: 2 },
      { ...fixture(), radius: Infinity },
      { ...fixture(), radius: 2 },
      { ...fixture(), baseline: { light: {}, dark: {} } },
      { ...fixture(), font: "Arial; } body { display:none" },
      { ...fixture(), overrides: { light: { primary: "url(https://invalid)" }, dark: {} } },
      { ...fixture(), radii: { "radius-panel": "-1rem" } },
    ])
      expect(validateTheme(theme)).toBeUndefined();
    for (const hash of [
      "#theme=%",
      "#theme=!!!!",
      "#unrelated",
      "#theme=e30",
      `#theme=${"a".repeat(80001)}`,
    ])
      expect(themeFromHash(hash)).toBeUndefined();
    expect(deserializeTheme("{")).toBeUndefined();
  });
});
