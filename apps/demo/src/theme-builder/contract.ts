import baseCss from "@foldworks/ui/base.css?raw";

/** Names only: the CSS remains the source of all preset values. */
export const semanticTokens = [
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
export const tokenNames = [
  ...new Set([
    ...semanticTokens,
    ...Array.from(
      baseCss.split("/* Compatibility aliases")[0]!.matchAll(/--([\w-]+)\s*:/g),
      (match) => match[1]!,
    ),
  ]),
];
/** Rebind dependent base formulas after a user changes their inputs. */
export const reactiveBaseTokens = Object.fromEntries(
  Array.from(baseCss.split("/* Compatibility aliases")[0]!.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g))
    .filter(
      (match) =>
        match[2]!.includes("var(") &&
        /^(primary-hover|ring-muted|destructive-surface|destructive-border)$/.test(match[1]!),
    )
    .map((match) => [match[1]!, match[2]!.trim()]),
);
export const surfaceRadii = [
  "radius-panel",
  "radius-button",
  "radius-button-sm",
  "radius-badge",
] as const;
export const modes = ["light", "dark"] as const;
export type Mode = (typeof modes)[number];
export type Tokens = Readonly<Record<string, string>>;
export type ModeTokens = Readonly<{ light: Tokens; dark: Tokens }>;
export const contrastPairs = [
  ["Text", "foreground", "background"],
  ["Primary", "primary-foreground", "primary"],
  ["Muted text", "muted-foreground", "background"],
  ["Card", "card-foreground", "card"],
  ["Popover", "popover-foreground", "popover"],
  ["Secondary", "secondary-foreground", "secondary"],
  ["Accent", "accent-foreground", "accent"],
  ["Destructive", "destructive-foreground", "destructive"],
  ["Sidebar", "sidebar-foreground", "sidebar"],
  ["Sidebar primary", "sidebar-primary-foreground", "sidebar-primary"],
  ["Sidebar accent", "sidebar-accent-foreground", "sidebar-accent"],
  ["Selected row", "foldworks-ui-selection-foreground", "foldworks-ui-selection"],
] as const;
