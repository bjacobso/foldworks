import { Schema as S } from "effect";

/**
 * A run of text between two UTF-16 offsets, with `to` exclusive. Offsets are
 * relative to the text a surface addresses: a whole document in the code
 * editor, or one item's text in an outline.
 */
export const TextRange = S.Struct({ from: S.Number, to: S.Number });
export type TextRange = typeof TextRange.Type;

/**
 * A range with a meaning, such as `keyword`, `function`, or `mention`. Kinds
 * are open: surfaces paint them as `data-kind` for the host's stylesheet.
 */
export const SemanticToken = S.Struct({ from: S.Number, to: S.Number, kind: S.String });
export type SemanticToken = typeof SemanticToken.Type;

export const Severity = S.Literals(["error", "warning", "info", "hint"]);
export type Severity = typeof Severity.Type;

/** A problem with a range of text. An empty range marks a point, such as a missing token. */
export const Diagnostic = S.Struct({
  from: S.Number,
  to: S.Number,
  severity: Severity,
  message: S.String,
  code: S.optional(S.String),
});
export type Diagnostic = typeof Diagnostic.Type;

/** Severities from most to least serious. */
export const SEVERITIES: ReadonlyArray<Severity> = ["error", "warning", "info", "hint"];

/** The most serious diagnostic in a list, or `undefined` for an empty list. */
export const mostSevere = (diagnostics: ReadonlyArray<Diagnostic>): Diagnostic | undefined =>
  diagnostics.reduce<Diagnostic | undefined>(
    (worst, diagnostic) =>
      worst === undefined ||
      SEVERITIES.indexOf(diagnostic.severity) < SEVERITIES.indexOf(worst.severity)
        ? diagnostic
        : worst,
    undefined,
  );

/** Diagnostics whose range contains an offset. A point diagnostic contains its own offset. */
export const diagnosticsAt = (
  diagnostics: ReadonlyArray<Diagnostic>,
  offset: number,
): ReadonlyArray<Diagnostic> =>
  diagnostics.filter((diagnostic) =>
    diagnostic.from === diagnostic.to
      ? offset === diagnostic.from
      : offset >= diagnostic.from && offset < diagnostic.to,
  );

/** Something a completion can insert. */
export const CompletionItem = S.Struct({
  label: S.String,
  /** The text that replaces the completion's range. Defaults to `label`. */
  insert: S.optional(S.String),
  /** Secondary text, such as a type, a signature, or where the item comes from. */
  detail: S.optional(S.String),
  /** Exposed as `data-kind` on the option, such as `function` or `person`. */
  kind: S.optional(S.String),
  /** The text typing is matched against. Defaults to `label`. */
  filterText: S.optional(S.String),
});
export type CompletionItem = typeof CompletionItem.Type;

/** Where the pointer or the caret asks for information, and how. */
export const HoverSource = S.Literals(["Pointer", "Keyboard"]);
export type HoverSource = typeof HoverSource.Type;
