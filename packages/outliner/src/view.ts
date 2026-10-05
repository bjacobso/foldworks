import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import {
  Completion,
  CompletionPopup,
  HoverPopup,
  diagnosticsAt,
  optionId,
  mostSevere,
  segments,
  type CompletionItem,
  type Diagnostic,
  type Hover,
  type HoverSource,
} from "@foldworks/text-intelligence";

import { Message } from "./message";
import { domIds, type Model } from "./model";
import { INDENT, MODEL_PROPERTY, POLICY_PROPERTY, Surface } from "./mount";
import type { Policy } from "./policy";
import { ancestors, find, walk, type Item, type Row } from "./outline";
import { rowsOf, selectedIds } from "./selectors";

export type ViewInputs = Policy &
  Readonly<{
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
    /**
     * Ghost children for a parent, or for the top level when `parentId` is the
     * hoisted item or `null`. They are not part of the document; choosing or
     * typing into one creates a real item.
     */
    placeholders?: (parentId: string | null) => ReadonlyArray<Placeholder>;
    /**
     * A view of a folded item's children, such as a diagram or a summary, shown
     * under its row instead of nothing. Unfolding the item edits the children
     * as rows again. Built in the host's boundary.
     */
    foldedView?: (row: Row) => FoldedView | null;
  }>;

/** A host's view of a folded item's children. `label` names its group for assistive technology. */
export type FoldedView = Readonly<{ label: string; content: Html }>;

/** A ghost child that is not part of the document, such as “add step”. */
export type Placeholder = Readonly<{
  /** Identifies the placeholder among its parent's, and comes back in `FilledPlaceholder`. */
  key: string;
  /** Shown in place of text, after a “+”. */
  label: string;
  /** The text a new item starts with. Defaults to empty. */
  text?: string;
  /** Where the caret lands in `text`. Defaults to its end. */
  caret?: number;
  /** Position among the parent's children. Defaults to after the last one. */
  index?: number;
}>;

type Entry =
  | Readonly<{ _tag: "Row"; row: Row; first: boolean }>
  | Readonly<{
      _tag: "Placeholder";
      parentId: string | null;
      depth: number;
      index: number;
      placeholder: Placeholder;
    }>;

/** Visible rows in order, with each parent's placeholders among or after its children. */
const entriesOf = (
  scopeId: string | null,
  rows: ReadonlyArray<Row>,
  placeholders: ViewInputs["placeholders"],
): ReadonlyArray<Entry> => {
  const first = rows[0]?.id;
  if (placeholders === undefined) {
    return rows.map((row) => ({ _tag: "Row", row, first: row.id === first }));
  }
  const children = new Map<string | null, Row[]>();
  for (const row of rows) children.set(row.parentId, [...(children.get(row.parentId) ?? []), row]);
  const result: Entry[] = [];
  const emit = (parentId: string | null, depth: number) => {
    const kids = children.get(parentId) ?? [];
    const ghosts = placeholders(parentId).map((placeholder) => ({
      placeholder,
      index: Math.max(0, Math.min(placeholder.index ?? kids.length, kids.length)),
    }));
    const place = (index: number) => {
      for (const ghost of ghosts) {
        if (ghost.index === index) result.push({ _tag: "Placeholder", parentId, depth, ...ghost });
      }
    };
    kids.forEach((row, index) => {
      place(index);
      result.push({ _tag: "Row", row, first: row.id === first });
      if (!(row.hasChildren && row.collapsed)) emit(row.id, depth + 1);
    });
    place(kids.length);
  };
  emit(scopeId, 0);
  return result;
};

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
  // Nothing to say is no popup, even for a range the host claimed.
  if (range === undefined || (answer?.content === null && diagnostics.length === 0)) {
    return undefined;
  }
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

/** Suggestions being shown: the open list narrowed by what was typed. */
type ShownCompletion = Readonly<{
  id: string;
  from: number;
  items: ReadonlyArray<CompletionItem>;
  index: number;
  query: string;
}>;

const shownCompletion = (model: Model): ShownCompletion | undefined => {
  const list = model.completion;
  const node = list === null ? undefined : find(model.items, list.id);
  if (list === null || node === undefined) return undefined;
  const caret = model.focus?.id === list.id ? model.focus.end : list.to;
  const items = Completion.visible(list, node.text, caret);
  return items.length === 0
    ? undefined
    : {
        id: list.id,
        from: list.from,
        items,
        index: Math.min(list.index, items.length - 1),
        query: Completion.query(list, node.text, caret),
      };
};

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
  suggestions: ShownCompletion | undefined,
  readOnly: boolean,
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
  const folded = row.hasChildren && row.collapsed ? (inputs.foldedView?.(row) ?? null) : null;
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
      ...(readOnly ? [h.DataAttribute("readonly", "true")] : []),
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
                h.Disabled(readOnly),
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
              h.Readonly(readOnly),
              h.DataAttribute("outline-text", "true"),
              ...(hover?.id === row.id ? [h.AriaDescribedBy(ids.hover)] : []),
              ...(suggestions?.id === row.id
                ? [
                    h.AriaAutocomplete("list"),
                    h.AriaControls(ids.completion),
                    h.AriaActiveDescendant(optionId(ids.completion, suggestions.index)),
                  ]
                : []),
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
                h.DataAttribute("refused", String(target?.refused === true)),
                h.AriaHidden(true),
                h.Style({ "--fw-outliner-drop-depth": String(target?.depth ?? 0) }),
              ],
              [],
            ),
          ]),
      ...(folded === null
        ? []
        : [
            h.div(
              [
                h.Class("fw-outliner__view"),
                h.Role("group"),
                h.AriaLabel(folded.label),
                h.Tabindex(-1),
                h.DataAttribute("outline-view", row.id),
              ],
              [folded.content],
            ),
          ]),
    ],
  );
};

const placeholderView = (
  entry: Extract<Entry, { _tag: "Placeholder" }>,
  inputs: ViewInputs,
  h: HtmlBuilder<Message>,
): Html => {
  const { parentId, depth, index, placeholder } = entry;
  const text = placeholder.text ?? "";
  const caret = Math.max(0, Math.min(placeholder.caret ?? text.length, text.length));
  const name = `Add ${placeholder.label}`;
  return h.keyed("div")(
    `placeholder:${parentId ?? ""}:${placeholder.key}`,
    [
      h.Class("fw-outliner__row fw-outliner__placeholder"),
      h.Role("treeitem"),
      h.Tabindex(-1),
      h.AriaLevel(depth + 1),
      h.AriaLabel(name),
      h.DataAttribute("outline-placeholder", placeholder.key),
      ...(parentId === null ? [] : [h.DataAttribute("parent", parentId)]),
      h.DataAttribute("index", String(index)),
      h.DataAttribute("text", text),
      h.DataAttribute("caret", String(caret)),
      h.Style({ "--fw-outliner-depth": String(depth) }),
    ],
    [
      h.span(
        [h.Class("fw-outliner__toggle"), h.DataAttribute("state", "leaf"), h.AriaHidden(true)],
        [],
      ),
      h.button(
        [
          h.Class("fw-outliner__handle fw-outliner__plus"),
          h.Type("button"),
          h.Tabindex(-1),
          h.AriaLabel(name),
          h.Title(name),
          h.DataAttribute("outline-control", "true"),
          h.OnClick(
            Message.FilledPlaceholder({
              parentId,
              index,
              key: placeholder.key,
              text,
              offset: caret,
            }),
          ),
        ],
        ["+"],
      ),
      h.div(
        [h.Class("fw-outliner__cell")],
        [
          h.textarea(
            [
              h.Class("fw-outliner__text"),
              h.Rows(1),
              h.Value(""),
              h.Placeholder(placeholder.label),
              h.AriaLabel(name),
              h.Spellcheck(inputs.spellcheck ?? true),
              h.DataAttribute("placeholder-text", "true"),
            ],
            [],
          ),
        ],
      ),
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
  const suggestions = rows.some((row) => row.id === model.completion?.id)
    ? shownCompletion(model)
    : undefined;
  const selected = new Set(model.mode === "Rows" ? selectedIds(model, rows) : []);
  const isReadOnly = inputs.isReadOnly;
  const locked = new Set<string>(
    isReadOnly === undefined
      ? []
      : walk(model.items)
          .filter((node: Item) => isReadOnly(node))
          .map((node) => node.id),
  );
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
      {
        _tag: "Prop",
        key: POLICY_PROPERTY,
        value: { canMove: inputs.canMove, isReadOnly: inputs.isReadOnly },
      },
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
        entriesOf(model.scopeId, rows, inputs.placeholders).map((entry) =>
          entry._tag === "Placeholder"
            ? placeholderView(entry, inputs, h)
            : rowView(
                model,
                entry.row,
                selected,
                dragged,
                entry.first,
                inputs,
                hover,
                suggestions,
                locked.has(entry.row.id),
                h,
              ),
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
      ...(suggestions === undefined
        ? []
        : [
            CompletionPopup.view(
              {
                id: ids.completion,
                items: suggestions.items,
                index: suggestions.index,
                query: suggestions.query,
                anchor: {
                  selector: mirrorSelector(model.id, suggestions.id),
                  offset: suggestions.from,
                },
                onChoose: (index) => Message.AcceptedCompletion({ index }),
              },
              h,
            ),
          ]),
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
