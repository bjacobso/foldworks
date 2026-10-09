import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { Stateful } from "@foldworks/ui";
import { ThemeName } from "../theme";
import {
  EditMode,
  Elevation,
  ExportFormat,
  ModeTokens,
  Neutral,
  PreviewMode,
  WorkingTheme,
} from "./model";

export const Message = defineMessageUnion({
  Initialize: {},
  Loaded: {
    presets: S.Record(S.String, ModeTokens),
    restored: S.NullOr(WorkingTheme),
    warning: S.String,
  },
  SelectedPreset: { preset: ThemeName },
  ChangedPrimary: { value: S.String },
  ChangedAccent: { value: S.String },
  ChangedNeutral: { value: Neutral },
  ToggledCharts: { value: S.Boolean },
  ChangedToken: { token: S.String, value: S.String },
  ResetToken: { token: S.String },
  ChangedRadius: { value: S.Number },
  ChangedSurfaceRadius: { token: S.String, value: S.Number },
  ToggledRadiusLink: { token: S.String },
  ChangedFont: { value: S.String },
  ChangedElevation: { value: Elevation },
  ToggledOutlined: { value: S.Boolean },
  ChangedPreviewMode: { value: PreviewMode },
  ChangedEditMode: { value: EditMode },
  ToggledSection: { section: S.String, isOpen: S.Boolean },
  Randomize: {},
  Randomized: { seed: S.Number },
  Reset: {},
  Share: {},
  OpenExport: {},
  GotDialogMessage: { message: Stateful.Dialog.Message },
  ChangedExportFormat: { value: ExportFormat },
  ChangedName: { value: S.String },
  CopyExport: {},
  Copied: { kind: S.String, succeeded: S.Boolean },
  ClearCopied: { kind: S.String },
  Persisted: { succeeded: S.Boolean },
  ChangedProjectName: { value: S.String },
  ChangedCurrency: { value: S.String },
  ToggledUpdates: { value: S.Boolean },
  ToggledApproved: { value: S.Boolean },
  SelectedRow: { value: S.String },
  ToggledPopover: { value: S.Boolean },
  PreviewAction: { value: S.String },
});
export type Message = typeof Message.Type;
