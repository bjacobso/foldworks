import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import {
  HoverPopup,
  diagnosticsAt,
  mostSevere,
  segments,
  type Diagnostic,
  type Hover,
  type HoverSource,
} from "@foldworks/text-intelligence";

import { Message } from "./message";
import { domIds, type Model } from "./model";
import { INDENT, MODEL_PROPERTY, Surface } from "./mount";
import { ancestors, find, type Row } from "./outline";
import { rowsOf, selectedIds } from "./selectors";

export type ViewInputs = Readonly<{
  /** Accessible name for the tree. Defaults to "Outline". */
  label?: string;
  /** Shows a checkbox before each item. Items can be marked done either way. */
  showCheckboxes?: boolean;
  /** Shows the breadcrumb trail and title while an item is hoisted. Defaults to true. */
  showBreadcrumbs?: boolean;
  /** Label for the button shown when the outline is empty. */
  emptyLabel?: string;
  /** Spell-checks item text. Defaults to true; turn it off for code. */
  spellcheck?: boolean;
  /** Per-item styling, keyed by item id. */
  decorations?: Readonly<Record<string, RowDecoration>>;
  /** Trailing content for a row, such as a value or a status. Built in the host's boundary. */
  rowAccessory?: (row: Row) => Html | null;
  /**
   * Information about the text under the pointer, or at the caret after
   * Ctrl+Shift+Space. Return the range it describes and content built in the
   * host's boundary, or `null` for nothing. Row diagnostics at the offset are
   * shown with it.
   */
  hover?: (request: HoverRequest) => Hover | null;
}>;

/** What a hover asks about: a character of an item's text. */
export type HoverRequest = Readonly<{
  id: string;
  offset: number;
  text: string;
  source: HoverSource;
}>;

/** A run of an item's text, painted with `data-kind` so a stylesheet can color it. */
export type TextSpan = Readonly<{ text: string; kind?: string }>;

export type RowDecoration = Readonly<{
  /**
   * Styled runs that spell the item's text exactly. They are painted beneath
   * the editable text, which keeps native caret, selection, and input. Spans
   * that no longer match the text, for example mid-keystroke, are ignored.
   */
  spans?: ReadonlyArray<TextSpan>;
  /** Exposed as `data-tone` on the row, for marking errors, changes, and the like. */
  tone?: string;
  /** Text shown in place of the bullet. The bullet still drags and hoists. */
  marker?: string;
  /** Styled runs painted after the text, outside the editable value. Shown with `spans`. */
  suffix?: ReadonlyArray<TextSpan>;
  /** Problems with ranges of the text, underlined and shown on hover. */
  diagnostics?: ReadonlyArray<Diagnostic>;
}>;

/** The hover being shown: its row, the range it describes, and what to say. */
type ShownHover = Readonly<{
  id: string;
  from: number;
  to: number;
  diagnostics: ReadonlyArray<Diagnostic>;
  content: Html | null;
}>;

const quoted = (value: string): string => `"${value.replace(/["\\]/g, "\\$&")}"`;

/** Finds an item's painted text, for anchoring popups to it. */
export const mirrorSelector = (modelId: string, id: string): string =>
  `[data-outliner=${quoted(modelId)}] [data-outline-mirror=${quoted(id)}]`;

const validDiagnostics = (
  text: string,
  diagnostics: ReadonlyArray<Diagnostic> | undefined,
): ReadonlyArray<Diagnostic> =>
  (diagnostics ?? []).filter(
    (diagnostic) =>
      diagnostic.from >= 0 && diagnostic.from <= diagnostic.to && diagnostic.to <= text.length,
  );

const shownHover = (model: Model, inputs: ViewInputs): ShownHover | undefined => {
  const target = model.hover;
  if (target === null) return undefined;
  const node = find(model.items, target.id);
  if (node === undefined || target.offset > node.text.length) return undefined;
  const answer = inputs.hover?.({ ...target, text: node.text }) ?? null;
  const diagnostics = diagnosticsAt(
    validDiagnostics(node.text, inputs.decorations?.[target.id]?.diagnostics),
    target.offset,
  );
  const worst = mostSevere(diagnostics);
  const range = answer ?? worst;
  if (range === undefined) return undefined;
  const from = Math.max(0, Math.min(range.from, node.text.length));
  const to = Math.max(from, Math.min(range.to, node.text.length));
  return { id: target.id, from, to, diagnostics, content: answer?.content ?? null };
};

const untitled = (text: string): string => text.split("\n")[0]?.trim() || "Untitled";

const triangle = (h: HtmlBuilder<Message>): Html =>
  h.svg(
    [h.Class("fw-outliner__triangle"), h.Attribute("viewBox", "0 0 10 10"), h.AriaHidden(true)],
    [h.path([h.Attribute("d", "M3 1.5 L8 5 L3 8.5 Z")], [])],
  );

/** An item's text as styled pieces: token kinds, problem underlines, and the hovered range. */
const paint = (
  text: string,
  spans: ReadonlyArray<TextSpan> | undefined,
  diagnostics: ReadonlyArray<Diagnostic>,
  hovered: ShownHover | undefined,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  let at = 0;
  const tokens = (spans ?? []).map((span) => {
    const token = { from: at, to: at + span.text.length, kind: span.kind };
    at = token.to;
    return token;
  });
  return segments(text, {
    tokens,
    diagnostics,
    hovered: hovered === undefined ? [] : [hovered],
  }).map((piece) => {
    const kind = piece.covering.tokens[0]?.kind;
    const problem = mostSevere(piece.covering.diagnostics);
    const classes = [
      "fw-outliner__span",
      ...(problem === undefined ? [] : ["fw-text-diagnostic"]),
      ...(piece.covering.hovered.length > 0 ? ["fw-text-hovered"] : []),
    ];
    return h.span(
      [
        h.Class(classes.join(" ")),
        ...(kind === undefined ? [] : [h.DataAttribute("kind", kind)]),
        ...(problem === undefined ? [] : [h.DataAttribute("severity", problem.severity)]),
      ],
      [piece.text],
    );
  });
};

const rowView = (
  model: Model,
  row: Row,
  selected: ReadonlySet<string>,
  dragged: ReadonlySet<string>,
  isFirst: boolean,
  inputs: ViewInputs,
  hover: ShownHover | undefined,
  h: HtmlBuilder<Message>,
): Html => {
  const ids = domIds(model.id);
  const isSelected = selected.has(row.id);
  const target = model.drag?.target;
  const indicator =
    target === null || target === undefined
      ? undefined
      : target.afterRowId === row.id
        ? "After"
        : target.afterRowId === null && isFirst
          ? "Before"
          : undefined;
  const label = untitled(row.text);
  const decoration = inputs.decorations?.[row.id];
  const spans =
    decoration?.spans !== undefined &&
    decoration.spans.map((span) => span.text).join("") === row.text
      ? decoration.spans
      : undefined;
  const diagnostics = validDiagnostics(row.text, decoration?.diagnostics);
  const hovered = hover?.id === row.id && hover.to > hover.from ? hover : undefined;
  const painted = spans !== undefined || diagnostics.length > 0 || hovered !== undefined;
  const accessory = inputs.rowAccessory?.(row) ?? null;
  return h.keyed("div")(
    row.id,
    [
      h.Id(ids.row(row.id)),
      h.Class("fw-outliner__row"),
      h.Role("treeitem"),
      h.Tabindex(-1),
      h.AriaLevel(row.depth + 1),
      h.AriaSetsize(row.setSize),
      h.AriaPosinset(row.index + 1),
      h.AriaSelected(isSelected),
      h.AriaLabel(label),
      ...(row.hasChildren ? [h.AriaExpanded(!row.collapsed)] : []),
      h.DataAttribute("outline-row", row.id),
      h.DataAttribute("selected", String(isSelected)),
      h.DataAttribute("checked", String(row.checked)),
      h.DataAttribute("dragging", String(dragged.has(row.id))),
      ...(decoration?.tone === undefined ? [] : [h.DataAttribute("tone", decoration.tone)]),
      h.Style({ "--fw-outliner-depth": String(row.depth) }),
    ],
    [
      h.button(
        [
          h.Class("fw-outliner__toggle"),
          h.Type("button"),
          h.Tabindex(-1),
          h.AriaLabel(`${row.collapsed ? "Expand" : "Collapse"} ${label}`),
          h.Title(
            `${row.collapsed ? "Expand" : "Collapse"} · Option- or Alt-click for every level`,
          ),
          h.DataAttribute("outline-toggle", row.id),
          h.DataAttribute("outline-control", "true"),
          h.DataAttribute(
            "state",
            !row.hasChildren ? "leaf" : row.collapsed ? "collapsed" : "expanded",
          ),
          h.Disabled(!row.hasChildren),
        ],
        [triangle(h)],
      ),
      h.span(
        [
          h.Class("fw-outliner__handle"),
          h.AriaHidden(true),
          h.Title("Drag to move · click to hoist"),
          h.DataAttribute("outline-handle", "true"),
          h.DataAttribute("folded", String(row.hasChildren && row.collapsed)),
        ],
        [
          decoration?.marker === undefined
            ? h.span([h.Class("fw-outliner__dot")], [])
            : h.span([h.Class("fw-outliner__marker")], [decoration.marker]),
        ],
      ),
      ...(inputs.showCheckboxes === true
        ? [
            h.button(
              [
                h.Class("fw-outliner__check"),
                h.Type("button"),
                h.Role("checkbox"),
                h.Tabindex(-1),
                h.AriaChecked(row.checked),
                h.AriaLabel(`Done: ${label}`),
                h.DataAttribute("outline-control", "true"),
                h.OnClick(Message.ToggledChecked({ id: row.id })),
              ],
              row.checked
                ? [
                    h.svg(
                      [h.Attribute("viewBox", "0 0 10 10"), h.AriaHidden(true)],
                      [h.path([h.Attribute("d", "M2 5.2 4.1 7.3 8 2.8")], [])],
                    ),
                  ]
                : [],
            ),
          ]
        : []),
      h.div(
        [h.Class("fw-outliner__cell"), h.DataAttribute("decorated", String(painted))],
        [
          h.textarea(
            [
              h.Id(ids.text(row.id)),
              h.Class("fw-outliner__text"),
              h.Rows(1),
              h.Value(row.text),
              h.AriaLabel(`Item text, level ${row.depth + 1}`),
              h.Spellcheck(inputs.spellcheck ?? true),
              h.DataAttribute("outline-text", "true"),
              ...(hover?.id === row.id ? [h.AriaDescribedBy(domIds(model.id).hover)] : []),
            ],
            [],
          ),
          h.div(
            [
              h.Class("fw-outliner__mirror"),
              h.AriaHidden(true),
              h.DataAttribute("outline-mirror", row.id),
            ],
            [
              ...(painted ? paint(row.text, spans, diagnostics, hovered, h) : [row.text]),
              ...(spans === undefined ? [] : (decoration?.suffix ?? [])).map((span) =>
                h.span(
                  [
                    h.Class("fw-outliner__span fw-outliner__suffix"),
                    h.DataAttribute("text-skip", "true"),
                    ...(span.kind === undefined ? [] : [h.DataAttribute("kind", span.kind)]),
                  ],
                  [span.text],
                ),
              ),
              h.span([h.DataAttribute("text-skip", "true")], ["\u200b"]),
            ],
          ),
        ],
      ),
      ...(accessory === null ? [] : [h.div([h.Class("fw-outliner__accessory")], [accessory])]),
      ...(indicator === undefined
        ? []
        : [
            h.div(
              [
                h.Class("fw-outliner__drop"),
                h.DataAttribute("position", indicator),
                h.AriaHidden(true),
                h.Style({ "--fw-outliner-drop-depth": String(target?.depth ?? 0) }),
              ],
              [],
            ),
          ]),
    ],
  );
};

const breadcrumbs = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  if (model.scopeId === null) return [];
  const scope = find(model.items, model.scopeId);
  if (scope === undefined) return [];
  const trail = ancestors(model.items, model.scopeId);
  const crumb = (id: string | null, text: string) =>
    h.li(
      [],
      [
        h.button(
          [h.Class("fw-outliner__crumb"), h.Type("button"), h.OnClick(Message.Hoisted({ id }))],
          [text],
        ),
      ],
    );
  return [
    h.nav(
      [h.Class("fw-outliner__crumbs"), h.AriaLabel("Hoisted item path")],
      [
        h.ol(
          [],
          [
            crumb(null, "Outline"),
            ...trail.map((id) => crumb(id, untitled(find(model.items, id)?.text ?? ""))),
          ],
        ),
      ],
    ),
    h.h2([h.Class("fw-outliner__title")], [untitled(scope.text)]),
  ];
};

export const view = defineView<Model, Message, ViewInputs>((model, inputs, h) => {
  const ids = domIds(model.id);
  const rows = rowsOf(model);
  const hover = rows.some((row) => row.id === model.hover?.id)
    ? shownHover(model, inputs)
    : undefined;
  const selected = new Set(model.mode === "Rows" ? selectedIds(model, rows) : []);
  // Rows inside a dragged item travel with it, so they dim with it too.
  const dragged = new Set(model.drag?.ids ?? []);
  for (const row of rows) {
    if (row.parentId !== null && dragged.has(row.parentId)) dragged.add(row.id);
  }
  return h.div(
    [
      h.Class("fw-outliner"),
      h.DataAttribute("outliner", model.id),
      h.DataAttribute("mode", model.mode),
      h.DataAttribute("dragging", String(model.drag !== null)),
      h.Style({ "--fw-outliner-indent": `${INDENT}px` }),
      { _tag: "Prop", key: MODEL_PROPERTY, value: model },
      h.OnMount(Surface()),
    ],
    [
      ...(inputs.showBreadcrumbs === false ? [] : breadcrumbs(model, h)),
      h.div(
        [
          h.Id(ids.tree),
          h.Class("fw-outliner__tree"),
          h.Role("tree"),
          h.AriaLabel(inputs.label ?? "Outline"),
          h.Attribute("aria-multiselectable", "true"),
          h.Tabindex(-1),
        ],
        rows.map((row, index) =>
          rowView(model, row, selected, dragged, index === 0, inputs, hover, h),
        ),
      ),
      ...(rows.length === 0
        ? [
            h.button(
              [
                h.Id(ids.add),
                h.Class("fw-outliner__add"),
                h.Type("button"),
                h.OnClick(Message.ClickedAdd()),
              ],
              [inputs.emptyLabel ?? (model.scopeId === null ? "Start an outline" : "Add an item")],
            ),
          ]
        : []),
      ...(hover === undefined
        ? []
        : [
            HoverPopup.view(
              {
                id: ids.hover,
                anchor: { selector: mirrorSelector(model.id, hover.id), offset: hover.from },
                diagnostics: hover.diagnostics,
                content: hover.content,
              },
              h,
            ),
          ]),
      h.div([h.Class("fw-outliner__live"), h.AriaLive("polite")], [model.announcement]),
    ],
  );
});
