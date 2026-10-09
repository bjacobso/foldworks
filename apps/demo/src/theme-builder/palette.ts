import { oklch, parseColor, readableForeground, rgbToOklch } from "./color";
import { modes, surfaceRadii, type Mode, type Tokens, type ModeTokens } from "./contract";
import type { WorkingTheme } from "./model";

export const fontStacks = {
  System: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  Inter: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  Humanist: '"Segoe UI", Calibri, "Helvetica Neue", sans-serif',
  Monospace: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};
const neutralFamilies = {
  zinc: [0.006, 286],
  slate: [0.018, 258],
  stone: [0.008, 65],
  gray: [0.008, 264],
  neutral: [0, 0],
} as const;
const colorCoordinates = (color: string) => rgbToOklch(parseColor(color) ?? [0.2, 0.2, 0.2]);
export const generatePalette = (theme: WorkingTheme, mode: Mode): Tokens => {
  const dark = mode === "dark",
    base = theme.baseline[mode];
  const result: Record<string, string> = {};
  if (theme.neutral !== "preset") {
    const [c, h] = neutralFamilies[theme.neutral];
    const tone = (l: number) => oklch(l, c, h);
    Object.assign(result, {
      background: tone(dark ? 0.16 : 0.985),
      foreground: tone(dark ? 0.96 : 0.2),
      card: tone(dark ? 0.2 : 1),
      "card-foreground": tone(dark ? 0.96 : 0.2),
      popover: tone(dark ? 0.24 : 1),
      "popover-foreground": tone(dark ? 0.96 : 0.2),
      secondary: tone(dark ? 0.28 : 0.94),
      "secondary-foreground": tone(dark ? 0.96 : 0.2),
      muted: tone(dark ? 0.25 : 0.95),
      "muted-foreground": tone(dark ? 0.74 : 0.46),
      border: tone(dark ? 0.34 : 0.88),
      input: tone(dark ? 0.42 : 0.78),
      sidebar: tone(dark ? 0.19 : 0.965),
      "sidebar-foreground": tone(dark ? 0.96 : 0.2),
      "sidebar-border": tone(dark ? 0.34 : 0.88),
    });
  }
  if (theme.primary) {
    const [l, c, h] = colorCoordinates(theme.primary);
    const primary = dark
      ? oklch(Math.max(0.7, Math.min(0.82, l)), Math.min(c, 0.16), h)
      : theme.primary;
    Object.assign(result, {
      primary,
      "primary-foreground": readableForeground(primary),
      ring: primary,
      "sidebar-primary": primary,
      "sidebar-primary-foreground": readableForeground(primary),
      "sidebar-ring": primary,
    });
  }
  if (theme.accent || theme.primary || theme.neutral !== "preset") {
    const [, c, h] = colorCoordinates(theme.accent || theme.primary || base.accent || "#71717a");
    const surface = oklch(dark ? 0.28 : 0.95, Math.min(c, dark ? 0.05 : 0.025), h);
    const foreground = oklch(dark ? 0.9 : 0.3, Math.min(c, 0.08), h);
    Object.assign(result, {
      accent: surface,
      "accent-foreground": foreground,
      "sidebar-accent": surface,
      "sidebar-accent-foreground": foreground,
    });
  }
  if (theme.primary || theme.neutral !== "preset") {
    const primary = result.primary || base.primary || "#18181b";
    const [, c, h] = colorCoordinates(primary);
    // Text is deliberately darker/lighter than the action color on the subtle selection surface.
    result["foldworks-ui-selection"] = oklch(dark ? 0.28 : 0.95, Math.min(c, 0.025), h);
    result["foldworks-ui-selection-foreground"] = oklch(dark ? 0.9 : 0.3, Math.min(c, 0.07), h);
    result["foldworks-ui-selection-border"] = primary;
    result["foldworks-ui-drop-target-border"] = primary;
    result["foldworks-ui-drop-target-active-border"] = primary;
  }
  if (theme.deriveCharts) {
    const [, c, h] = colorCoordinates(theme.primary || base.primary || "#18181b");
    [0, 35, 80, 160, 230].forEach((offset, i) => {
      result[`chart-${i + 1}`] = oklch(
        dark ? 0.74 : 0.58,
        Math.max(0.1, Math.min(c, 0.16)),
        h + offset,
      );
    });
  }
  // Brand-generated palettes also correct preset text pairs that fall below AA.
  if (theme.primary || theme.neutral !== "preset" || theme.accent) {
    const palette = { ...base, ...result };
    for (const [fg, bg] of [
      ["muted-foreground", "background"],
      ["destructive-foreground", "destructive"],
    ] as const) {
      if (fg === "muted-foreground") {
        const [, c, h] = colorCoordinates(palette[fg] || "#71717a");
        result[fg] = oklch(dark ? 0.75 : 0.43, Math.min(c, 0.025), h);
      } else result[fg] = readableForeground(palette[bg] || "#dc2626");
    }
  }
  return result;
};
const shadows = {
  flat: ["none", "none", "none"],
  subtle: [
    "0 1px 2px rgb(0 0 0 / 7%)",
    "0 0 0 1px var(--border), 0 2px 6px rgb(0 0 0 / 8%)",
    "0 8px 24px rgb(0 0 0 / 16%)",
  ],
  raised: [
    "0 2px 8px rgb(0 0 0 / 12%)",
    "0 4px 16px rgb(0 0 0 / 14%)",
    "0 16px 40px rgb(0 0 0 / 24%)",
  ],
  floating: [
    "0 8px 24px rgb(0 0 0 / 16%)",
    "0 12px 32px rgb(0 0 0 / 20%)",
    "0 24px 64px rgb(0 0 0 / 32%)",
  ],
} as const;
export const resolveTheme = (theme: WorkingTheme): ModeTokens => {
  const resolve = (mode: Mode): Tokens => {
    const tokens: Record<string, string> = {
      ...theme.baseline[mode],
      ...generatePalette(theme, mode),
    };
    if (theme.radius !== null) {
      tokens.radius = `${theme.radius}rem`;
      tokens["radius-sm"] = `${theme.radius * 0.6}rem`;
      tokens["radius-md"] = `${theme.radius * 0.8}rem`;
      tokens["radius-lg"] = tokens.radius;
      tokens["radius-xl"] = `${theme.radius * 1.4}rem`;
      for (const surface of surfaceRadii)
        tokens[surface] = `${theme.radius * (surface === "radius-button-sm" ? 0.8 : 1)}rem`;
    }
    Object.assign(tokens, theme.radii);
    if (theme.font) tokens["font-sans"] = theme.font;
    if (theme.elevation !== "preset") {
      const [card, panel, float] = shadows[theme.elevation];
      Object.assign(tokens, { "shadow-card": card, "shadow-panel": panel, "shadow-float": float });
    }
    if (theme.outlined !== null)
      Object.assign(tokens, {
        "badge-border": theme.outlined ? "currentColor" : "transparent",
        "button-outline-surface": theme.outlined ? "transparent" : "var(--secondary)",
        "button-outline-shadow": theme.outlined ? "none" : "var(--shadow-card)",
      });
    return { ...tokens, ...theme.overrides[mode] };
  };
  return { light: resolve(modes[0]), dark: resolve(modes[1]) };
};
export const randomTheme = (theme: WorkingTheme, seed: number): WorkingTheme => {
  const hue = Math.floor(seed * 360) % 360;
  return {
    ...theme,
    primary: oklch(0.48 + seed * 0.1, 0.1 + seed * 0.06, hue),
    accent: oklch(0.6, 0.1, (hue + 40) % 360),
    neutral: ["zinc", "slate", "stone", "gray", "neutral"][
      Math.floor(seed * 5) % 5
    ] as WorkingTheme["neutral"],
    deriveCharts: true,
    radius: Math.round((0.25 + seed * 0.65) * 20) / 20,
    radii: {},
    elevation: "subtle",
    overrides: { light: {}, dark: {} },
  };
};
