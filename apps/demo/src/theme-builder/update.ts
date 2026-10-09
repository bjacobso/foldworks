import { Command, Update } from "foldkit";
import { Effect, Option, Schema as S } from "effect";
import { CodeBlock, Stateful } from "@foldworks/ui";
import { ThemeName } from "../theme";
import { Message } from "./message";
import { fromPreset, WorkingTheme, type Model } from "./model";
import { modes, tokenNames } from "./contract";
import { parseColor } from "./color";
import { randomTheme, resolveTheme } from "./palette";
import {
  editableTokens,
  restoredTheme,
  serializeTheme,
  STORAGE_KEY,
  themeHash,
} from "./serialization";
import { exportTheme } from "./export";

const LoadPresets = Command.define("ReadThemeBuilderPresets", {
  messages: [Message.Loaded],
  execute: Effect.sync(() => {
    const presets: Record<string, { light: Record<string, string>; dark: Record<string, string> }> =
      {};
    const probe = document.createElement("div");
    probe.hidden = true;
    const colorProbe = document.createElement("span");
    probe.append(colorProbe);
    document.body.append(probe);
    try {
      for (const name of ThemeName.literals) {
        const snapshot = { light: {}, dark: {} } as {
          light: Record<string, string>;
          dark: Record<string, string>;
        };
        for (const mode of modes) {
          probe.dataset.theme = name.toLowerCase();
          probe.dataset.mode = mode;
          const computed = getComputedStyle(probe);
          for (const token of tokenNames) {
            const value = computed.getPropertyValue(`--${token}`).trim();
            if (editableTokens.includes(token) && !parseColor(value)) {
              colorProbe.style.color = `var(--${token})`;
              snapshot[mode][token] = getComputedStyle(colorProbe).color;
            } else snapshot[mode][token] = value;
          }
        }
        presets[name] = snapshot;
      }
    } finally {
      probe.remove();
    }
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* Work without storage. */
    }
    const hash = window.location.hash;
    const restored = restoredTheme(hash, stored) ?? null;
    return Message.Loaded({
      presets,
      restored,
      warning:
        hash.startsWith("#theme=") && !restoredTheme(hash, null)
          ? "This theme link is invalid. Your saved theme or Shadcn was loaded."
          : "",
    });
  }),
});
const Persist = Command.define("PersistThemeBuilder", {
  args: { json: S.String },
  messages: [Message.Persisted],
  execute: ({ json }) =>
    Effect.sync(() => {
      try {
        localStorage.setItem(STORAGE_KEY, json);
        return Message.Persisted({ succeeded: true });
      } catch {
        return Message.Persisted({ succeeded: false });
      }
    }),
});
const Random = Command.define("RandomizeThemeBuilder", {
  messages: [Message.Randomized],
  execute: Effect.sync(() => Message.Randomized({ seed: Math.random() })),
});
const Copy = Command.define("CopyThemeBuilder", {
  args: { text: S.String, kind: S.String },
  messages: [Message.Copied],
  execute: ({ text, kind }) =>
    CodeBlock.writeClipboard(text).pipe(
      Effect.map((succeeded) => Message.Copied({ kind, succeeded })),
    ),
});
const Share = Command.define("ShareThemeBuilder", {
  args: { theme: WorkingTheme },
  messages: [Message.Copied],
  execute: ({ theme }) =>
    Effect.sync(() => {
      const url = new URL(window.location.href);
      url.hash = themeHash(theme);
      window.history.replaceState(window.history.state, "", url);
      return url.href;
    }).pipe(
      Effect.flatMap(CodeBlock.writeClipboard),
      Effect.map((succeeded) => Message.Copied({ kind: "share", succeeded })),
    ),
});
const ClearCopied = Command.define("ClearThemeBuilderCopy", {
  args: { kind: S.String },
  messages: [Message.ClearCopied],
  execute: ({ kind }) => Effect.sleep("2 seconds").pipe(Effect.as(Message.ClearCopied({ kind }))),
});
const persist = (model: Model, working: WorkingTheme): Update.Return<Model, Message> => ({
  model: { ...model, working, copied: "" },
  commands: [Persist({ json: serializeTheme(working) })],
});
const foldDialog = Update.foldChild({
  update: Stateful.Dialog.update,
  read: (model: Model) => Option.some(model.dialog),
  write: (model, dialog) => ({ ...model, dialog }),
  toParentMessage: (message) => Message.GotDialogMessage({ message }),
  foldOutMessage: (_message: Stateful.Dialog.OutMessage) => (model: Model) => ({ model }),
});
export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    Initialize: () => ({ model, commands: [LoadPresets()] }),
    Loaded: ({ presets, restored, warning }) =>
      persist(
        { ...model, presets, ready: true, drafts: {}, announcement: warning },
        restored ?? fromPreset("Shadcn", presets.Shadcn!),
      ),
    SelectedPreset: ({ preset }) =>
      persist({ ...model, drafts: {} }, fromPreset(preset, model.presets[preset]!)),
    ChangedPrimary: ({ value }) => {
      const next = { ...model, drafts: { ...model.drafts, primary: value } };
      return parseColor(value)
        ? persist(next, { ...model.working, primary: value })
        : { model: next };
    },
    ChangedAccent: ({ value }) => {
      const next = { ...model, drafts: { ...model.drafts, accent: value } };
      return parseColor(value)
        ? persist(next, { ...model.working, accent: value })
        : { model: next };
    },
    ChangedNeutral: ({ value }) => persist(model, { ...model.working, neutral: value }),
    ToggledCharts: ({ value }) => persist(model, { ...model.working, deriveCharts: value }),
    ChangedToken: ({ token, value }) => {
      if (!editableTokens.includes(token)) return { model };
      const next = { ...model, drafts: { ...model.drafts, [`${model.editMode}:${token}`]: value } };
      return parseColor(value)
        ? persist(next, {
            ...model.working,
            overrides: {
              ...model.working.overrides,
              [model.editMode]: { ...model.working.overrides[model.editMode], [token]: value },
            },
          })
        : { model: next };
    },
    ResetToken: ({ token }) => {
      const overrides = { ...model.working.overrides[model.editMode] },
        drafts = { ...model.drafts };
      delete overrides[token];
      delete drafts[`${model.editMode}:${token}`];
      return persist(
        { ...model, drafts },
        {
          ...model.working,
          overrides: { ...model.working.overrides, [model.editMode]: overrides },
        },
      );
    },
    ChangedRadius: ({ value }) =>
      persist(model, { ...model.working, radius: Math.max(0, Math.min(1.25, value)) }),
    ChangedSurfaceRadius: ({ token, value }) =>
      persist(model, {
        ...model.working,
        radii: { ...model.working.radii, [token]: `${Math.max(0, Math.min(1.25, value))}rem` },
      }),
    ToggledRadiusLink: ({ token }) => {
      const radii = { ...model.working.radii };
      if (radii[token]) delete radii[token];
      else radii[token] = resolveTheme(model.working)[model.editMode][token]!;
      return persist(model, { ...model.working, radii });
    },
    ChangedFont: ({ value }) => persist(model, { ...model.working, font: value }),
    ChangedElevation: ({ value }) => persist(model, { ...model.working, elevation: value }),
    ToggledOutlined: ({ value }) => persist(model, { ...model.working, outlined: value }),
    ChangedPreviewMode: ({ value }) => ({
      model: { ...model, previewMode: value, editMode: value === "Dark" ? "dark" : "light" },
    }),
    ChangedEditMode: ({ value }) => ({ model: { ...model, editMode: value } }),
    ToggledSection: ({ section, isOpen }) => ({
      model: {
        ...model,
        sections: isOpen
          ? [...model.sections, section]
          : model.sections.filter((x) => x !== section),
      },
    }),
    Randomize: () => ({ model, commands: [Random()] }),
    Randomized: ({ seed }) => persist({ ...model, drafts: {} }, randomTheme(model.working, seed)),
    Reset: () =>
      persist(
        { ...model, drafts: {} },
        fromPreset(model.working.preset, model.presets[model.working.preset]!),
      ),
    Share: () => ({ model, commands: [Share({ theme: model.working })] }),
    OpenExport: () => foldDialog(model, Stateful.Dialog.Message.RequestedOpen()),
    GotDialogMessage: ({ message }) => foldDialog(model, message),
    ChangedExportFormat: ({ value }) => ({ model: { ...model, exportFormat: value, copied: "" } }),
    ChangedName: ({ value }) => persist(model, { ...model.working, name: value.slice(0, 100) }),
    CopyExport: () => ({
      model,
      commands: [
        Copy({ text: exportTheme(model.working, model.exportFormat), kind: model.exportFormat }),
      ],
    }),
    Copied: ({ kind, succeeded }) => ({
      model: {
        ...model,
        copied: succeeded ? kind : "",
        announcement: succeeded
          ? kind === "share"
            ? "Theme link copied."
            : "Theme copied."
          : kind === "share"
            ? "Theme link is in the address bar. Clipboard access is unavailable."
            : "Clipboard access is unavailable; select and copy the code.",
      },
      commands: succeeded ? [ClearCopied({ kind })] : [],
    }),
    ClearCopied: ({ kind }) => ({
      model: model.copied === kind ? { ...model, copied: "" } : model,
    }),
    Persisted: ({ succeeded }) => ({
      model: succeeded
        ? model
        : {
            ...model,
            announcement: "Storage is unavailable. Your theme is kept for this session.",
          },
    }),
    ChangedProjectName: ({ value }) => ({ model: { ...model, projectName: value } }),
    ChangedCurrency: ({ value }) => ({ model: { ...model, currency: value } }),
    ToggledUpdates: ({ value }) => ({ model: { ...model, updates: value } }),
    ToggledApproved: ({ value }) => ({ model: { ...model, approved: value } }),
    SelectedRow: ({ value }) => ({ model: { ...model, selectedRow: value } }),
    ToggledPopover: ({ value }) => ({ model: { ...model, popoverOpen: value } }),
    PreviewAction: ({ value }) => ({
      model: { ...model, announcement: `${value} selected in the preview.` },
    }),
  });
