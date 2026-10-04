import { Schema as S } from "effect";

export const Action = S.Literals([
  "Split",
  "Indent",
  "Outdent",
  "MoveUp",
  "MoveDown",
  "Collapse",
  "Expand",
  "ToggleChecked",
  "ZoomIn",
  "ZoomOut",
  "Undo",
  "Redo",
  "MergePrevious",
  "MergeNext",
  "Delete",
  "FocusPrevious",
  "FocusNext",
  "FocusPreviousEnd",
  "FocusNextStart",
  "SelectRow",
  "ExtendUp",
  "ExtendDown",
  "SelectPrevious",
  "SelectNext",
  "CollapseOrParent",
  "ExpandOrChild",
  "Edit",
  "ClearSelection",
  "SelectAll",
]);
export type Action = typeof Action.Type;

export type Platform = "mac" | "other";

const FOCUS_KEEPING: ReadonlySet<Action> = new Set([
  "Indent",
  "Outdent",
  "Collapse",
  "Expand",
  "ToggleChecked",
]);

/**
 * Actions that change rows in place. The focused element survives them, so
 * typing continues at once; every other action moves focus after a render.
 */
export const keepsFocus = (action: Action): boolean => FOCUS_KEEPING.has(action);

export type KeyInput = Readonly<{
  key: string;
  code?: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isComposing?: boolean;
}>;

/** Where the caret sits inside the focused row's text. */
export type Caret = Readonly<{
  start: number;
  end: number;
  length: number;
  onFirstLine: boolean;
  onLastLine: boolean;
}>;

export type KeyContext = Readonly<{ mode: "Text"; caret: Caret }> | Readonly<{ mode: "Rows" }>;

type Modifiers = Readonly<{ mod: boolean; shift: boolean; alt: boolean; ctrl: boolean }>;

const modifiers = (event: KeyInput, platform: Platform): Modifiers =>
  platform === "mac"
    ? { mod: event.metaKey, shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey }
    : {
        mod: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
        ctrl: event.metaKey,
      };

const only = (m: Modifiers, ...wanted: ReadonlyArray<keyof Modifiers>): boolean =>
  (["mod", "shift", "alt", "ctrl"] as const).every((name) => m[name] === wanted.includes(name));

/** Punctuation is matched by physical key so shifted and international layouts agree. */
const isKey = (event: KeyInput, key: string, code?: string): boolean =>
  event.key === key || (code !== undefined && event.code === code);

/** Shortcuts shared by text editing and row selection. */
const structural = (event: KeyInput, m: Modifiers, platform: Platform): Action | undefined => {
  if (event.key === "Tab" && only(m)) return "Indent";
  if (event.key === "Tab" && only(m, "shift")) return "Outdent";
  if (isKey(event, "]", "BracketRight") && only(m, "mod")) return "Indent";
  if (isKey(event, "[", "BracketLeft") && only(m, "mod")) return "Outdent";
  const vertical = event.key === "ArrowUp" ? "Up" : event.key === "ArrowDown" ? "Down" : undefined;
  if (vertical !== undefined) {
    // ⌘⇧↑ everywhere, plus ⌃⌘↑ as OmniOutliner spells it on the Mac.
    if (only(m, "mod", "shift") || (platform === "mac" && only(m, "mod", "ctrl"))) {
      return vertical === "Up" ? "MoveUp" : "MoveDown";
    }
    if (only(m, "mod")) return vertical === "Up" ? "Collapse" : "Expand";
  }
  if (isKey(event, ".", "Period") && only(m, "mod")) return "ZoomIn";
  if ((isKey(event, ".", "Period") || event.key === ">") && only(m, "mod", "shift")) {
    return "ZoomOut";
  }
  if (event.key === "Enter" && only(m, "mod")) return "ToggleChecked";
  if (event.key.toLowerCase() === "z" && only(m, "mod")) return "Undo";
  if (event.key.toLowerCase() === "z" && only(m, "mod", "shift")) return "Redo";
  if (event.key.toLowerCase() === "y" && platform === "other" && only(m, "mod")) return "Redo";
  return undefined;
};

/**
 * Maps a key press to an outliner action, or `undefined` to leave it to the
 * browser. Text-mode arrows only leave the row at its edges, so moving within
 * wrapped text stays native.
 */
export const resolveKey = (
  event: KeyInput,
  context: KeyContext,
  platform: Platform,
): Action | undefined => {
  if (event.isComposing) return undefined;
  const m = modifiers(event, platform);
  const shared = structural(event, m, platform);
  if (shared !== undefined) return shared;

  if (context.mode === "Rows") {
    if (event.key === "ArrowUp" && only(m)) return "SelectPrevious";
    if (event.key === "ArrowDown" && only(m)) return "SelectNext";
    if (event.key === "ArrowUp" && only(m, "shift")) return "ExtendUp";
    if (event.key === "ArrowDown" && only(m, "shift")) return "ExtendDown";
    if (event.key === "ArrowLeft" && only(m)) return "CollapseOrParent";
    if (event.key === "ArrowRight" && only(m)) return "ExpandOrChild";
    if ((event.key === "Enter" || event.key === "F2") && only(m)) return "Edit";
    if (event.key === " " && only(m)) return "ToggleChecked";
    if (event.key === "Escape" && only(m)) return "ClearSelection";
    if ((event.key === "Backspace" || event.key === "Delete") && only(m)) return "Delete";
    if (event.key.toLowerCase() === "a" && only(m, "mod")) return "SelectAll";
    return undefined;
  }

  const { caret } = context;
  const collapsedCaret = caret.start === caret.end;
  if (event.key === "Enter" && only(m)) return "Split";
  if (event.key === "Escape" && only(m)) return "SelectRow";
  if (event.key === "Backspace" && only(m, "mod", "shift")) return "Delete";
  if (event.key === "Backspace" && only(m) && collapsedCaret && caret.start === 0) {
    return "MergePrevious";
  }
  if (event.key === "Delete" && only(m) && collapsedCaret && caret.end === caret.length) {
    return "MergeNext";
  }
  if (event.key === "ArrowUp" && only(m) && collapsedCaret && caret.onFirstLine) {
    return "FocusPrevious";
  }
  if (event.key === "ArrowDown" && only(m) && collapsedCaret && caret.onLastLine) {
    return "FocusNext";
  }
  if (event.key === "ArrowLeft" && only(m) && collapsedCaret && caret.start === 0) {
    return "FocusPreviousEnd";
  }
  if (event.key === "ArrowRight" && only(m) && collapsedCaret && caret.end === caret.length) {
    return "FocusNextStart";
  }
  // Once the text is selected to an edge, another ⇧↑ or ⇧↓ selects whole rows.
  if (event.key === "ArrowUp" && only(m, "shift") && caret.start === 0 && caret.onFirstLine) {
    return "ExtendUp";
  }
  if (
    event.key === "ArrowDown" &&
    only(m, "shift") &&
    caret.end === caret.length &&
    caret.onLastLine
  ) {
    return "ExtendDown";
  }
  if (
    event.key.toLowerCase() === "a" &&
    only(m, "mod") &&
    caret.start === 0 &&
    caret.end === caret.length
  ) {
    return "SelectAll";
  }
  return undefined;
};

export type ShortcutHelp = Readonly<{ keys: string; label: string }>;

/** A legend for the default key map, for help panels and tooltips. */
export const shortcutHelp = (platform: Platform): ReadonlyArray<ShortcutHelp> => {
  const mod = platform === "mac" ? "⌘" : "Ctrl+";
  const shift = platform === "mac" ? "⇧" : "Shift+";
  return [
    { keys: "Return", label: "New item, or split at the caret" },
    { keys: `${shift}Return`, label: "Line break inside an item" },
    { keys: `Tab · ${shift}Tab`, label: "Indent · outdent" },
    { keys: `${mod}${shift}↑ · ${mod}${shift}↓`, label: "Move up · down" },
    { keys: `${mod}↑ · ${mod}↓`, label: "Collapse · expand" },
    { keys: `${mod}. · ${mod}${shift}.`, label: "Hoist · unhoist" },
    { keys: `${mod}Return`, label: "Mark done" },
    { keys: "Esc", label: "Select rows; Return to edit again" },
    { keys: `${shift}↑ · ${shift}↓`, label: "Extend the row selection" },
    { keys: `${mod}Z · ${mod}${shift}Z`, label: "Undo · redo" },
  ];
};
