import { Schema as S } from "effect";

export const ThemeName = S.Literals(["Neutral", "Zinc", "Blue", "Soft"]);
export type ThemeName = typeof ThemeName.Type;

export const ThemePreference = S.Literals(["System", "Light", "Dark"]);
export type ThemePreference = typeof ThemePreference.Type;

export type ThemeState = Readonly<{
  name: ThemeName;
  preference: ThemePreference;
  systemIsDark: boolean;
}>;

export const THEME_STORAGE_KEY = "foldworks-demo-theme";
export const COLOR_THEME_STORAGE_KEY = "foldworks-demo-color-theme";
export const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

const isThemeName = (value: string | null): value is ThemeName =>
  value === "Neutral" || value === "Zinc" || value === "Blue" || value === "Soft";

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "System" || value === "Light" || value === "Dark";

export const readThemeState = (): ThemeState => {
  let storedName: string | null = null;
  let storedPreference: string | null = null;
  try {
    storedName = window.localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return {
    name: isThemeName(storedName) ? storedName : "Neutral",
    preference: isThemePreference(storedPreference) ? storedPreference : "System",
    systemIsDark: window.matchMedia(SYSTEM_DARK_QUERY).matches,
  };
};

export const applyTheme = (
  name: ThemeName,
  preference: ThemePreference,
  systemIsDark: boolean,
): void => {
  const isDark = preference === "Dark" ||
    (preference === "System" && systemIsDark);
  document.documentElement.dataset.theme = name.toLowerCase();
  document.documentElement.dataset.mode = isDark ? "dark" : "light";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.themePreference = preference.toLowerCase();
  try {
    window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, name);
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Applying the in-memory preference is still useful without persistence.
  }
};
