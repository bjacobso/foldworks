import { semanticTokens, tokenNames, type Tokens } from "./contract";
import { resolveTheme } from "./palette";
import type { WorkingTheme, Model } from "./model";

export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "custom";
const declarations = (tokens: Tokens, names: readonly string[] = tokenNames): string =>
  names.map((name) => `  --${name}: ${tokens[name]};`).join("\n");
export const exportFoldworks = (theme: WorkingTheme): string => {
  const { light, dark } = resolveTheme(theme),
    name = slugify(theme.name);
  return `/* After @import "@foldworks/ui/base.css" and any preset imports.\n   Use data-theme="${name}" and data-mode="light" or "dark" on your app. */\n\n[data-theme="${name}"] {\n  color-scheme: light;\n${declarations(light)}\n}\n\n[data-theme="${name}"][data-mode="dark"],\n[data-theme="${name}"].dark {\n  color-scheme: dark;\n${declarations(dark)}\n}\n`;
};
export const exportTailwind = (theme: WorkingTheme): string => {
  const { light, dark } = resolveTheme(theme);
  const names = [...semanticTokens, "radius", "font-sans"];
  const colors = semanticTokens.map((name) => `  --color-${name}: var(--${name});`).join("\n");
  return `:root {\n${declarations(light, names)}\n}\n\n.dark {\n${declarations(dark, names)}\n}\n\n@theme inline {\n${colors}\n  --font-sans: var(--theme-font-sans);\n  --radius-sm: calc(var(--radius) - 4px);\n  --radius-md: calc(var(--radius) - 2px);\n  --radius-lg: var(--radius);\n  --radius-xl: calc(var(--radius) + 4px);\n}\n`
    .replaceAll("  --font-sans: ", "  --theme-font-sans: ")
    .replace(
      "  --theme-font-sans: var(--theme-font-sans);",
      "  --font-sans: var(--theme-font-sans);",
    );
};
export const exportJson = (theme: WorkingTheme): string => {
  const { light, dark } = resolveTheme(theme);
  return JSON.stringify(
    {
      light,
      dark,
      shape: Object.fromEntries(
        [
          "radius",
          "radius-panel",
          "radius-button",
          "radius-button-sm",
          "radius-badge",
          "badge-border",
          "button-outline-surface",
          "button-outline-shadow",
          "shadow-card",
          "shadow-panel",
          "shadow-float",
          "font-sans",
        ].map((name) => [name, { light: light[name], dark: dark[name] }]),
      ),
    },
    null,
    2,
  );
};
export const exportTheme = (theme: WorkingTheme, format: Model["exportFormat"]): string =>
  format === "Foldworks CSS"
    ? exportFoldworks(theme)
    : format === "JSON tokens"
      ? exportJson(theme)
      : exportTailwind(theme);
