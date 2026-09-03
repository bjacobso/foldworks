import { Schema as S } from "effect";

export const ThemePreference = S.Literals(["System", "Light", "Dark"]);
export type ThemePreference = typeof ThemePreference.Type;

export type ThemeState = Readonly<{
  preference: ThemePreference;
  systemIsDark: boolean;
}>;

export const THEME_STORAGE_KEY = "foldworks-demo-theme";
export const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "System" || value === "Light" || value === "Dark";

export const readThemeState = (): ThemeState => {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return {
    preference: isThemePreference(stored) ? stored : "System",
    systemIsDark: window.matchMedia(SYSTEM_DARK_QUERY).matches,
  };
};

export const applyThemePreference = (
  preference: ThemePreference,
  systemIsDark: boolean,
): void => {
  const isDark = preference === "Dark" ||
    (preference === "System" && systemIsDark);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.themePreference = preference.toLowerCase();
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Applying the in-memory preference is still useful without persistence.
  }
};
