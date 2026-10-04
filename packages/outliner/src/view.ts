import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

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
}>;

const untitled = (text: string): string => text.split("\n")[0]?.trim() || "Untitled";

const triangle = (h: HtmlBuilder<Message>): Html =>
  h.svg(
    [h.Class("fw-outliner__triangle"), h.Attribute("viewBox", "0 0 10 10"), h.AriaHidden(true)],
    [h.path([h.Attribute("d", "M3 1.5 L8 5 L3 8.5 Z")], [])],
  );

const rowView = (
  model: Model,
  row: Row,
  selected: ReadonlySet<string>,
  dragged: ReadonlySet<string>,
  isFirst: boolean,
  inputs: ViewInputs,
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
        [h.span([h.Class("fw-outliner__dot")], [])],
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
        [h.Class("fw-outliner__cell")],
        [
          h.textarea(
            [
              h.Id(ids.text(row.id)),
              h.Class("fw-outliner__text"),
              h.Rows(1),
              h.Value(row.text),
              h.AriaLabel(`Item text, level ${row.depth + 1}`),
              h.Spellcheck(true),
              h.DataAttribute("outline-text", "true"),
            ],
            [],
          ),
          h.div([h.Class("fw-outliner__mirror"), h.AriaHidden(true)], [`${row.text}\u200b`]),
        ],
      ),
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
        rows.map((row, index) => rowView(model, row, selected, dragged, index === 0, inputs, h)),
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
      h.div([h.Class("fw-outliner__live"), h.AriaLive("polite")], [model.announcement]),
    ],
  );
});
