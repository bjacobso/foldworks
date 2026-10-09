import { Schema as S } from "effect";
import { WorkingTheme } from "./model";
import { modes, semanticTokens, surfaceRadii, tokenNames } from "./contract";
import { parseColor } from "./color";

export const STORAGE_KEY = "foldworks-theme-builder-v1";
const safeValue = (value: string): boolean =>
  value.length <= 1200 && !/[;{}<>@]|url\s*\(|\/\*/i.test(value);
export const validateTheme = (input: unknown): WorkingTheme | undefined => {
  try {
    const theme = S.decodeUnknownSync(WorkingTheme)(input);
    if (
      theme.radius !== null &&
      (!Number.isFinite(theme.radius) || theme.radius < 0 || theme.radius > 1.25)
    )
      return undefined;
    if (theme.name.length > 100 || theme.font.length > 500 || !safeValue(theme.font))
      return undefined;
    if (
      (theme.primary && !parseColor(theme.primary)) ||
      (theme.accent && !parseColor(theme.accent))
    )
      return undefined;
    for (const mode of modes) {
      if (!tokenNames.every((name) => Boolean(theme.baseline[mode][name]))) return undefined;
      for (const [name, value] of Object.entries(theme.baseline[mode]))
        if (!tokenNames.includes(name) || !safeValue(value)) return undefined;
      for (const [name, value] of Object.entries(theme.overrides[mode])) {
        if (!tokenNames.includes(name) || !safeValue(value) || !parseColor(value)) return undefined;
      }
    }
    for (const [name, value] of Object.entries(theme.radii)) {
      if (
        !surfaceRadii.some((surface) => surface === name) ||
        !/^\d*\.?\d+(rem|px)$/.test(value) ||
        parseFloat(value) > (value.endsWith("px") ? 999 : 1.25)
      )
        return undefined;
    }
    return theme;
  } catch {
    return undefined;
  }
};
export const serializeTheme = (theme: WorkingTheme): string => JSON.stringify(theme);
export const deserializeTheme = (json: string): WorkingTheme | undefined => {
  if (json.length > 60_000) return undefined;
  try {
    return validateTheme(JSON.parse(json));
  } catch {
    return undefined;
  }
};
export const themeHash = (theme: WorkingTheme): string => {
  const bytes = new TextEncoder().encode(serializeTheme(theme));
  return `#theme=${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")}`;
};
export const themeFromHash = (hash: string): WorkingTheme | undefined => {
  if (!/^#theme=[A-Za-z0-9_-]+$/.test(hash) || hash.length > 80_000) return undefined;
  try {
    const bytes = Uint8Array.from(
      atob(hash.slice(7).replaceAll("-", "+").replaceAll("_", "/")),
      (char) => char.charCodeAt(0),
    );
    return deserializeTheme(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
};
export const restoredTheme = (hash: string, stored: string | null): WorkingTheme | undefined =>
  themeFromHash(hash) ?? (stored ? deserializeTheme(stored) : undefined);
export const editableTokens = tokenNames.filter(
  (name) =>
    semanticTokens.some((token) => token === name) ||
    (name.startsWith("foldworks-ui-") &&
      !name.startsWith("foldworks-ui-code-") &&
      name !== "foldworks-ui-overlay"),
);
