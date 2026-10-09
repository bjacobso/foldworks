import { Schema as S } from "effect";
import { Stateful } from "@foldworks/ui";
import { ThemeName } from "../theme";

export const Tokens = S.Record(S.String, S.String);
export const ModeTokens = S.Struct({ light: Tokens, dark: Tokens });
export const Neutral = S.Literals(["preset", "zinc", "slate", "stone", "gray", "neutral"]);
export const Elevation = S.Literals(["preset", "flat", "subtle", "raised", "floating"]);
export const PreviewMode = S.Literals(["Light", "Dark", "Side-by-side"]);
export const EditMode = S.Literals(["light", "dark"]);
export const ExportFormat = S.Literals(["Foldworks CSS", "shadcn / Tailwind v4", "JSON tokens"]);
export const WorkingTheme = S.Struct({
  version: S.Literal(1),
  preset: ThemeName,
  baseline: ModeTokens,
  primary: S.String,
  accent: S.String,
  neutral: Neutral,
  deriveCharts: S.Boolean,
  radius: S.NullOr(S.Number),
  radii: Tokens,
  font: S.String,
  elevation: Elevation,
  outlined: S.NullOr(S.Boolean),
  overrides: ModeTokens,
  name: S.String,
});
export type WorkingTheme = typeof WorkingTheme.Type;
export const Model = S.Struct({
  working: WorkingTheme,
  presets: S.Record(S.String, ModeTokens),
  ready: S.Boolean,
  previewMode: PreviewMode,
  editMode: EditMode,
  sections: S.Array(S.String),
  dialog: Stateful.Dialog.Model,
  exportFormat: ExportFormat,
  copied: S.String,
  drafts: Tokens,
  announcement: S.String,
  projectName: S.String,
  currency: S.String,
  updates: S.Boolean,
  approved: S.Boolean,
  selectedRow: S.String,
  popoverOpen: S.Boolean,
});
export type Model = typeof Model.Type;
export const fromPreset = (
  preset: WorkingTheme["preset"],
  baseline: WorkingTheme["baseline"],
): WorkingTheme => ({
  version: 1,
  preset,
  baseline,
  primary: "",
  accent: "",
  neutral: "preset",
  deriveCharts: false,
  radius: null,
  radii: {},
  font: "",
  elevation: "preset",
  outlined: null,
  overrides: { light: {}, dark: {} },
  name: "custom",
});
export const initialModel = (): Model => ({
  working: fromPreset("Shadcn", { light: {}, dark: {} }),
  presets: {},
  ready: false,
  previewMode: "Light",
  editMode: "light",
  sections: ["Start from", "Color", "Shape"],
  dialog: Stateful.Dialog.init({ id: "theme-export" }),
  exportFormat: "Foldworks CSS",
  copied: "",
  drafts: {},
  announcement: "",
  projectName: "Acme Studio",
  currency: "usd",
  updates: true,
  approved: true,
  selectedRow: "INV-1042",
  popoverOpen: true,
});
