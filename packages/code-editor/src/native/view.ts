import { Mount } from "foldkit";
import { type Html, type HtmlBuilder } from "foldkit/html";
import {
  Completion,
  CompletionPopup,
  HoverPopup,
  diagnosticsAt,
  mostSevere,
  optionId,
  segments,
  type Diagnostic,
  type SemanticToken,
  type TextRange,
} from "@foldworks/text-intelligence";
import type { Highlight } from "../contracts";
import type { Model } from "./model";
import { Message, type Action } from "./message";
import { ObserveInput } from "./mount";
import { findMatches } from "./operations";
import { lineAt, type Line } from "./tokenize";

export const visibleLines = (model: Model): Readonly<{ from: number; to: number }> =>
  model.options.lineWrapping
    ? { from: 0, to: model.lines.length }
    : {
        from: Math.min(
          model.lines.length - 1,
          Math.max(0, Math.floor((model.viewport.top - 12) / 22) - 8),
        ),
        to: Math.min(
          model.lines.length,
          Math.ceil((model.viewport.top + model.viewport.height) / 22) + 8,
        ),
      };

export type ViewConfig<ParentMessage> = import("../contracts").ViewConfig<
  Model,
  Message,
  ParentMessage
>;

type Layers = Readonly<{
  semantic: readonly SemanticToken[];
  issues: readonly Diagnostic[];
  matches: readonly TextRange[];
  highlights: readonly Highlight[];
  hovered: readonly TextRange[];
}>;

const touching = <Range extends TextRange>(
  ranges: readonly Range[],
  from: number,
  to: number,
): readonly Range[] => ranges.filter((range) => range.to >= from && range.from <= to);

/** One line as styled pieces: lexical and host token kinds, problems, matches, highlights, and the hovered range. */
const paintedLine = <ParentMessage>(
  line: Line,
  start: number,
  layers: Layers,
  h: HtmlBuilder<ParentMessage>,
): readonly Html[] => {
  const end = start + line.text.length;
  const issues = touching(layers.issues, start, end);
  const pieces = segments(
    line.text,
    {
      lexical: line.tokens.map((token) => ({
        from: start + token.from,
        to: start + token.to,
        kind: token.kind,
      })),
      semantic: touching(layers.semantic, start, end),
      issues,
      matches: touching(layers.matches, start, end),
      highlights: touching(layers.highlights, start, end),
      hovered: touching(layers.hovered, start, end),
    },
    start,
  );
  // An empty range marks a point, such as a missing token, with a caret-sized mark.
  const point = (at: number): readonly Html[] =>
    issues.some((issue) => issue.from === issue.to && issue.from === at)
      ? [
          h.span(
            [h.Class("native-token--point-issue"), h.DataAttribute("text-skip", "true")],
            ["\u200b"],
          ),
        ]
      : [];
  const spans = pieces.flatMap((piece) => {
    const semantic = piece.covering.semantic.at(-1);
    const issue = mostSevere(piece.covering.issues);
    const highlight = piece.covering.highlights[0];
    const classes = [
      `native-token--${piece.covering.lexical[0]?.kind ?? "plain"}`,
      ...(semantic === undefined ? [] : ["native-token--semantic"]),
      ...(issue === undefined ? [] : ["native-token--issue", `native-token--${issue.severity}`]),
      ...(piece.covering.matches.length > 0 ? ["native-token--match"] : []),
      ...(highlight === undefined ? [] : ["native-token--highlight"]),
      ...(piece.covering.hovered.length > 0 ? ["fw-text-hovered"] : []),
    ];
    return [
      ...point(start + piece.from),
      h.span(
        [
          h.Class(classes.join(" ")),
          ...(semantic === undefined ? [] : [h.DataAttribute("kind", semantic.kind)]),
          ...(highlight?.kind === undefined ? [] : [h.DataAttribute("highlight", highlight.kind)]),
        ],
        [piece.text],
      ),
    ];
  });
  return [
    ...spans,
    ...point(end),
    ...(line.text.length ? [] : [h.span([h.DataAttribute("text-skip", "true")], ["\u200b"])]),
  ];
};

const quoted = (value: string): string => `"${value.replace(/["\\]/g, "\\$&")}"`;

const languageLabel = (languageId: string): string =>
  ({ json: "JSON", yaml: "YAML", typescript: "TypeScript", text: "Plain text" })[languageId] ??
  languageId;

export const view = <ParentMessage>(
  config: ViewConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { model, label, toParentMessage, meta, showToolbar = true, showInspector = true } = config;
  const { from, to } = visibleLines(model);
  const activeLine = lineAt(model.starts, model.selection.head);
  const issues = model.diagnostics.flatMap((batch) =>
    batch.diagnostics.map((issue) => ({ ...issue, source: batch.source })),
  );
  const matches = model.search.open
    ? findMatches(model.document.text, model.search.query, model.search.caseSensitive)
    : [];
  const text = model.document.text;
  const caret = model.selection.head;
  const suggestions =
    model.completion === null ? [] : Completion.visible(model.completion, text, caret);
  const visibleRow = (offset: number): number | undefined => {
    const row = lineAt(model.starts, offset);
    return row >= from && row < to ? row : undefined;
  };
  const anchorAt = (offset: number, row: number) => ({
    selector: `[data-native-editor=${quoted(model.id)}] [data-native-line="${row}"]`,
    offset: offset - model.starts[row]!,
  });
  const completionRow = model.completion === null ? undefined : visibleRow(model.completion.from);
  const showsCompletion = suggestions.length > 0 && completionRow !== undefined;
  const hoverAnswer =
    model.hover === null
      ? null
      : (config.hover?.({
          offset: model.hover.offset,
          document: model.document,
          source: model.hover.source,
        }) ?? null);
  const hoverIssues = model.hover === null ? [] : diagnosticsAt(issues, model.hover.offset);
  const hoverRange = hoverAnswer ?? mostSevere(hoverIssues);
  const hoverRow = hoverRange === undefined ? undefined : visibleRow(hoverRange.from);
  const highlights = config.highlights ?? [];
  const layers: Layers = {
    semantic: model.tokens,
    issues,
    matches: model.search.open ? matches : [],
    highlights,
    hovered: hoverRange === undefined || hoverRange.to <= hoverRange.from ? [] : [hoverRange],
  };
  const button = (label: string, message: Message, disabled = false): Html =>
    h.button(
      [
        h.Type("button"),
        h.Class("native-editor__button"),
        h.OnClick(toParentMessage(message)),
        ...(disabled ? [h.Disabled(true)] : []),
      ],
      [label],
    );
  const action = (label: string, action: Action, disabled = false) =>
    button(label, Message.Run({ action }), disabled);
  const headerMeta =
    meta === undefined
      ? `${languageLabel(model.document.languageId)}${model.options.readOnly ? " · Read only" : ""}`
      : meta;
  const goToLine = (): Html =>
    h.div(
      [h.Class("native-editor__go-to-line")],
      [
        "Line ",
        h.input([
          h.Type("number"),
          h.Min("1"),
          h.Max(String(model.lines.length)),
          h.AriaLabel(`${label} go to line`),
          h.Value(model.goToLine),
          h.OnInput((value) => toParentMessage(Message.GoToLine({ value }))),
        ]),
        action("Go", "goToLine"),
      ],
    );
  return h.section(
    [
      h.Key(model.id),
      h.Class("native-editor"),
      h.DataAttribute("native-editor", model.id),
      h.DataAttribute("mode", model.options.theme),
      h.Style({ "--native-tab-size": String(model.options.tabSize) }),
    ],
    [
      h.div(
        [h.Class("native-editor__heading")],
        [h.strong([], [label]), ...(headerMeta === null ? [] : [h.span([], [headerMeta])])],
      ),
      ...(showToolbar
        ? [
            h.div(
              [h.Class("native-editor__tools"), h.Role("group"), h.AriaLabel(`${label} tools`)],
              model.options.readOnly
                ? [button("Find", Message.OpenSearch({ open: !model.search.open })), goToLine()]
                : [
                    action("Undo", "undo", !model.past.length),
                    action("Redo", "redo", !model.future.length),
                    action("Indent", "indent"),
                    action("Outdent", "outdent"),
                    action("Toggle comment", "comment", model.document.languageId === "json"),
                    action("Duplicate", "duplicate"),
                    button("Find / replace", Message.OpenSearch({ open: !model.search.open })),
                    button("Suggest", Message.OpenCompletion({ open: model.completion === null })),
                    ...(model.document.languageId === "json"
                      ? [action("Format JSON", "format")]
                      : []),
                  ],
            ),
          ]
        : []),
      ...(model.search.open
        ? [
            h.div(
              [
                h.Key(`${model.id}-search`),
                h.Class("native-editor__search"),
                h.Role("group"),
                h.AriaLabel(`${label} search`),
              ],
              [
                h.input([
                  h.Id(`${model.id}-find`),
                  h.Type("text"),
                  h.AriaLabel(`${label} find`),
                  h.Placeholder("Find text"),
                  h.Value(model.search.query),
                  h.OnInput((query) => toParentMessage(Message.SearchQuery({ query }))),
                ]),
                ...(model.options.readOnly
                  ? []
                  : [
                      h.input([
                        h.Type("text"),
                        h.AriaLabel(`${label} replace with`),
                        h.Placeholder("Replace with"),
                        h.Value(model.search.replacement),
                        h.OnInput((replacement) =>
                          toParentMessage(Message.SearchReplacement({ replacement })),
                        ),
                      ]),
                    ]),
                h.span(
                  [h.AriaLive("polite")],
                  [`${matches.length}${matches.length === 1000 ? "+" : ""} matches`],
                ),
                button(
                  model.search.caseSensitive ? "Match case: on" : "Match case: off",
                  Message.ToggleCase(),
                ),
                action("Previous", "findPrevious"),
                action("Next", "findNext"),
                ...(model.options.readOnly
                  ? []
                  : [action("Replace", "replace"), action("Replace all", "replaceAll")]),
                button("Close search", Message.OpenSearch({ open: false })),
              ],
            ),
          ]
        : []),
      h.div(
        [
          h.Key(`${model.id}-surface`),
          h.Class(
            `native-editor__surface${model.options.lineWrapping ? " native-editor__surface--wrap" : ""}`,
          ),
        ],
        [
          h.div(
            [
              h.Class("native-editor__gutter"),
              h.AriaHidden(true),
              ...(!model.options.lineNumbers ? [h.Style({ display: "none" })] : []),
            ],
            [
              h.div(
                [
                  h.Class("native-editor__gutter-lines"),
                  h.Style({ paddingTop: `${12 + from * 22}px` }),
                ],
                model.lines.slice(from, to).map((_, index) => {
                  const row = from + index;
                  const hasIssue = issues.some((issue) => lineAt(model.starts, issue.from) === row);
                  return h.div(
                    [
                      h.DataAttribute("native-number", String(row)),
                      h.Class(
                        `${row === activeLine ? "native-editor__active-number" : ""}${hasIssue ? " native-editor__issue-number" : ""}`,
                      ),
                    ],
                    [String(row + 1)],
                  );
                }),
              ),
            ],
          ),
          h.div(
            [h.Class("native-editor__text")],
            [
              h.div(
                [h.Class("native-editor__mirror"), h.AriaHidden(true)],
                [
                  h.div([h.Style({ height: `${from * 22}px` })]),
                  ...model.lines.slice(from, to).map((line, index) => {
                    const row = from + index;
                    const lineStart = model.starts[row]!;
                    const highlight = touching(
                      highlights,
                      lineStart,
                      lineStart + line.text.length,
                    )[0];
                    return h.div(
                      [
                        h.DataAttribute("native-line", String(row)),
                        h.Class(
                          `native-editor__line${row === activeLine ? " native-editor__line--active" : ""}${highlight === undefined ? "" : " native-editor__line--highlighted"}`,
                        ),
                        ...(highlight?.kind === undefined
                          ? []
                          : [h.DataAttribute("highlight", highlight.kind)]),
                      ],
                      paintedLine(line, lineStart, layers, h),
                    );
                  }),
                ],
              ),
              h.textarea(
                [
                  h.Id(model.id),
                  h.Class("native-editor__input"),
                  h.AriaLabel(label),
                  h.Attribute(
                    "aria-describedby",
                    `${model.id}-help${hoverRow === undefined ? "" : ` ${model.id}-hover`}`,
                  ),
                  h.Attribute("spellcheck", "false"),
                  h.Attribute("autocapitalize", "off"),
                  h.Attribute("autocomplete", "off"),
                  h.Wrap(model.options.lineWrapping ? "soft" : "off"),
                  h.Readonly(model.options.readOnly),
                  { _tag: "Prop", key: "foldkitNative", value: model },
                  ...(showsCompletion
                    ? [
                        h.AriaAutocomplete("list"),
                        h.Attribute("aria-controls", `${model.id}-completions`),
                        h.Attribute(
                          "aria-activedescendant",
                          optionId(
                            `${model.id}-completions`,
                            Math.min(model.completion!.index, suggestions.length - 1),
                          ),
                        ),
                      ]
                    : []),
                  h.OnMount(Mount.mapMessage(ObserveInput(), toParentMessage)),
                ],
                [],
              ),
            ],
          ),
        ],
      ),
      ...(showsCompletion
        ? [
            CompletionPopup.view(
              {
                id: `${model.id}-completions`,
                items: suggestions,
                index: Math.min(model.completion!.index, suggestions.length - 1),
                query: Completion.query(model.completion!, text, caret),
                label: `${label} suggestions`,
                anchor: anchorAt(model.completion!.from, completionRow!),
                onChoose: (index) => toParentMessage(Message.ChooseCompletion({ index })),
              },
              h,
            ),
          ]
        : []),
      ...(hoverRange === undefined || hoverRow === undefined
        ? []
        : [
            HoverPopup.view(
              {
                id: `${model.id}-hover`,
                anchor: anchorAt(hoverRange.from, hoverRow),
                diagnostics: hoverIssues,
                content: hoverAnswer?.content ?? null,
              },
              h,
            ),
          ]),
      h.div(
        [h.Key(`${model.id}-status`), h.Class("native-editor__status")],
        [
          h.span(
            [],
            [`Ln ${activeLine + 1}, Col ${model.selection.head - model.starts[activeLine]! + 1}`],
          ),
          h.span(
            [h.Id(`${model.id}-help`), h.Class("native-editor__help")],
            [model.options.readOnly ? "Read only" : "Tab moves focus · Ctrl/Cmd + ] indents"],
          ),
          ...(!showToolbar || !model.options.readOnly ? [goToLine()] : []),
          h.span(
            [h.AriaLive("polite")],
            [model.composing ? "Composing…" : `${issues.length} problems`],
          ),
        ],
      ),
      ...(issues.length
        ? [
            h.ul(
              [h.Class("native-editor__problems"), h.AriaLabel(`${label} problems`)],
              issues.map((issue) =>
                h.li(
                  [],
                  [
                    button(
                      `${issue.severity} · ${lineAt(model.starts, issue.from) + 1}:${issue.from - model.starts[lineAt(model.starts, issue.from)]! + 1} · ${issue.message}`,
                      Message.Reveal({ selection: { anchor: issue.from, head: issue.to } }),
                    ),
                  ],
                ),
              ),
            ),
          ]
        : []),
      ...(model.error
        ? [h.p([h.Class("native-editor__error"), h.Role("alert")], [model.error])]
        : []),
      ...(showInspector
        ? [
            h.details(
              [h.Class("native-editor__inspector")],
              [
                h.summary([], ["Explore editor state"]),
                h.dl(
                  [],
                  [
                    h.dt([], ["Document"]),
                    h.dd(
                      [],
                      [
                        `${model.document.text.length.toLocaleString()} UTF-16 units · revision ${model.document.revision}`,
                      ],
                    ),
                    h.dt([], ["Selection"]),
                    h.dd([], [`anchor ${model.selection.anchor} → head ${model.selection.head}`]),
                    h.dt([], ["Renderer"]),
                    h.dd(
                      [],
                      [
                        `${to - from} of ${model.lines.length} lines · ${model.options.lineWrapping ? "wrapped layout" : "visible lines + overscan"}`,
                      ],
                    ),
                    h.dt([], ["Undo / redo"]),
                    h.dd(
                      [],
                      [
                        `${model.past.length} / ${model.future.length} groups · reversible range edits`,
                      ],
                    ),
                    h.dt([], ["Highlighting"]),
                    h.dd([], ["Incremental line lexer · cached until lexical state changes"]),
                  ],
                ),
              ],
            ),
          ]
        : []),
    ],
  );
};
