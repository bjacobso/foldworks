import { Effect, Option, Schema as S } from "effect";
import { Command, Dom, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { Html, HtmlBuilder } from "foldkit/html";
import * as stylex from "@stylexjs/stylex";
import { ChevronDown, ChevronRight } from "@lucide/icons";

import * as Icon from "./icon";
import { sxAttrs } from "./sx";
import { colors, radii, space, typography } from "./tokens.stylex.js";

/**
 * One value in a nested structure. The host supplies nodes and decides what
 * a preview says; children can arrive later, so values may live elsewhere,
 * such as behind a handle in another process. Ids are unique in the tree.
 */
export type ValueNode = Readonly<{
  /** Stable across loads, such as a path or a handle. */
  id: string;
  /** The property name or index this value is under. Omitted for a root. */
  key?: string;
  /** One line describing the value, such as `"Ada"`, `42`, or `map of 3`. */
  preview: string;
  /** Exposed as `data-kind`, such as `string`, `number`, `list`, or `map`, for colors. */
  kind?: string;
  /** Children loaded so far. */
  children?: ReadonlyArray<ValueNode>;
  /** Has children that are not loaded; expanding it sends `RequestedChildren`. */
  expandable?: boolean;
  /** Children beyond those loaded, offered as “Show N more”. */
  more?: number;
}>;

export const Model = S.Struct({
  id: S.String,
  expandedIds: S.Array(S.String),
  activeId: S.NullOr(S.String),
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  Toggled: { id: S.String },
  Activated: { id: S.String },
  Navigated: { key: S.String },
  ClickedMore: { id: S.String },
  CompletedFocus: {},
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  /** A node without loaded children was expanded. Supply its `children`. */
  RequestedChildren: { id: S.String },
  /** “Show N more” was chosen. Supply more `children` and a smaller `more`. */
  RequestedMore: { id: S.String, loaded: S.Number },
});
export type OutMessage = typeof OutMessage.Type;

export type Config = Readonly<{ nodes: ReadonlyArray<ValueNode> }>;
type Result = Update.ReturnWithOutMessage<Model, Message, OutMessage>;

export const init = (
  config: Readonly<{ id: string; expandedIds?: ReadonlyArray<string> }>,
): Model => {
  if (!config.id) throw new Error("ValueTree requires a nonempty ID.");
  return { id: config.id, expandedIds: [...new Set(config.expandedIds ?? [])], activeId: null };
};

const opens = (node: ValueNode) =>
  (node.children?.length ?? 0) > 0 || node.expandable === true || (node.more ?? 0) > 0;

export type Row =
  | Readonly<{
      _tag: "Value";
      node: ValueNode;
      level: number;
      parentId: string | null;
      position: number;
      size: number;
    }>
  | Readonly<{ _tag: "Loading" | "Empty"; id: string; level: number; parentId: string }>
  | Readonly<{
      _tag: "More";
      id: string;
      level: number;
      parentId: string;
      count: number;
      loaded: number;
    }>;

const rowId = (row: Row) => (row._tag === "Value" ? row.node.id : row.id);

/** The rows on screen, in order, with a loading or empty row under expanded nodes that have none. */
export const visibleRows = (model: Model, nodes: ReadonlyArray<ValueNode>): ReadonlyArray<Row> => {
  const expanded = new Set(model.expandedIds);
  const rows: Row[] = [];
  const visit = (level: ReadonlyArray<ValueNode>, depth: number, parentId: string | null) =>
    level.forEach((node, position) => {
      rows.push({ _tag: "Value", node, level: depth, parentId, position, size: level.length });
      if (!expanded.has(node.id) || !opens(node)) return;
      const children = node.children ?? [];
      if (children.length === 0 && (node.more ?? 0) === 0) {
        rows.push({
          _tag: node.expandable === true && node.children === undefined ? "Loading" : "Empty",
          id: `${node.id}::status`,
          level: depth + 1,
          parentId: node.id,
        });
      }
      visit(children, depth + 1, node.id);
      if ((node.more ?? 0) > 0)
        rows.push({
          _tag: "More",
          id: `${node.id}::more`,
          level: depth + 1,
          parentId: node.id,
          count: node.more!,
          loaded: children.length,
        });
    });
  visit(nodes, 1, null);
  return rows;
};

const domId = (tree: string, node: string) =>
  `${encodeURIComponent(tree)}-value-${encodeURIComponent(node)}`;

const Focus = Command.define("FocusValueTree", {
  args: { id: S.String, item: S.NullOr(S.String) },
  messages: [Message.CompletedFocus],
  execute: ({ id, item }) =>
    Dom.focus(`#${CSS.escape(id)}`).pipe(
      Effect.andThen(
        item
          ? Dom.scrollIntoViewIfNotVisible(`#${CSS.escape(domId(id, item))}`, {
              block: "nearest",
              when: "Commit",
            })
          : Effect.void,
      ),
      Effect.ignore,
      Effect.as(Message.CompletedFocus()),
    ),
});
const focus = (model: Model): Result => ({
  model,
  commands: [Focus({ id: model.id, item: model.activeId })],
});

const find = (nodes: ReadonlyArray<ValueNode>, id: string): ValueNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = find(node.children ?? [], id);
    if (found !== undefined) return found;
  }
  return undefined;
};

/** Expands or collapses a node; expanding one without loaded children asks the host for them. */
const toggle = (model: Model, id: string, config: Config): Result => {
  const node = find(config.nodes, id);
  if (node === undefined || !opens(node)) return { model: { ...model, activeId: id } };
  const open = model.expandedIds.includes(id);
  const next = {
    ...model,
    activeId: id,
    expandedIds: open
      ? model.expandedIds.filter((value) => value !== id)
      : [...model.expandedIds, id],
  };
  return !open && node.expandable === true && node.children === undefined
    ? { model: next, outMessage: OutMessage.RequestedChildren({ id }) }
    : { model: next };
};

export const update = (model: Model, message: Message, config: Config): Result =>
  Message.match<Result>(message, {
    CompletedFocus: () => ({ model }),
    Toggled: ({ id }) => toggle(model, id, config),
    Activated: ({ id }) => ({ model: { ...model, activeId: id } }),
    ClickedMore: ({ id }) => {
      const node = find(config.nodes, id);
      return node === undefined
        ? { model }
        : {
            model,
            outMessage: OutMessage.RequestedMore({ id, loaded: node.children?.length ?? 0 }),
          };
    },
    Navigated: ({ key }) => {
      const rows = visibleRows(model, config.nodes);
      if (rows.length === 0) return { model };
      const index = Math.max(
        0,
        rows.findIndex((row) => rowId(row) === model.activeId),
      );
      const row = rows[index]!;
      const go = (target: Row | undefined) =>
        focus({ ...model, activeId: target === undefined ? rowId(row) : rowId(target) });
      switch (key) {
        case "ArrowDown":
          return go(rows[Math.min(index + 1, rows.length - 1)]);
        case "ArrowUp":
          return go(rows[Math.max(0, index - 1)]);
        case "Home":
          return go(rows[0]);
        case "End":
          return go(rows.at(-1));
        case "ArrowRight":
          if (row._tag !== "Value" || !opens(row.node)) return { model };
          return model.expandedIds.includes(row.node.id)
            ? go(rows[index + 1])
            : (() => {
                const opened = toggle(model, row.node.id, config);
                return { ...opened, commands: focus(opened.model).commands ?? [] };
              })();
        case "ArrowLeft":
          if (row._tag === "Value" && model.expandedIds.includes(row.node.id))
            return toggle(model, row.node.id, config);
          return row.parentId === null
            ? { model }
            : go(rows.find((candidate) => rowId(candidate) === row.parentId));
        case "Enter":
        case " ":
          if (row._tag === "More")
            return update(model, Message.ClickedMore({ id: row.parentId }), config);
          return row._tag === "Value" ? toggle(model, row.node.id, config) : { model };
        default:
          return { model };
      }
    },
  });

const styles = stylex.create({
  tree: {
    minWidth: 0,
    padding: space.xs,
    outline: { default: "none", ":focus-visible": `2px solid ${colors.focus}` },
    outlineOffset: "-2px",
    borderRadius: radii.md,
    fontFamily: typography.fontMono,
    fontSize: typography.sizeSm,
    lineHeight: "22px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: space.xs,
    minWidth: 0,
    minHeight: "22px",
    paddingInlineEnd: space.xs,
    borderRadius: radii.sm,
    cursor: "default",
    backgroundColor: { default: "transparent", ":hover": colors.surfaceHover },
  },
  active: { outline: `1px solid ${colors.borderStrong}`, outlineOffset: "-1px" },
  toggle: {
    display: "inline-flex",
    flex: "none",
    width: "16px",
    justifyContent: "center",
    color: colors.foregroundMuted,
  },
  key: { flex: "none", color: colors.foregroundMuted },
  preview: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  string: { color: colors.success },
  number: { color: colors.warning },
  keyword: { color: colors.info },
  status: { color: colors.foregroundMuted, fontStyle: "italic" },
  more: {
    color: colors.primary,
    cursor: "pointer",
    textDecoration: { default: "none", ":hover": "underline" },
  },
  empty: {
    margin: 0,
    padding: space.sm,
    color: colors.foregroundMuted,
    fontFamily: typography.fontFamily,
  },
});

const kindStyle = (kind: string | undefined) =>
  kind === "string"
    ? styles.string
    : kind === "number" || kind === "boolean" || kind === "nil" || kind === "null"
      ? styles.number
      : kind === "keyword"
        ? styles.keyword
        : null;

export type ViewConfig<ParentMessage> = Config &
  Readonly<{
    model: Model;
    /** Accessible name for the tree. */
    label: string;
    toParentMessage: (message: Message) => ParentMessage;
    /** Shown when there are no nodes. */
    emptyText?: string;
  }>;

/**
 * Nested values as a tree: keys, previews, and kinds, with arrow-key
 * navigation. Expanding a node the host has not loaded sends
 * `RequestedChildren` and shows “Loading…” until its children arrive.
 */
export const view = <ParentMessage>(
  config: ViewConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { model, toParentMessage } = config;
  const rows = visibleRows(model, config.nodes);
  const activeId = rows.some((row) => rowId(row) === model.activeId)
    ? model.activeId
    : rows[0] === undefined
      ? null
      : rowId(rows[0]);
  const indent = (level: number) => h.Style({ paddingInlineStart: `${4 + (level - 1) * 16}px` });
  const item = (row: Row): Html => {
    const id = rowId(row);
    const common = [
      h.Id(domId(model.id, id)),
      h.Role("treeitem"),
      h.AriaLevel(row.level),
      ...sxAttrs(h, styles.row, id === activeId && styles.active),
      indent(row.level),
    ];
    switch (row._tag) {
      case "Value": {
        const { node } = row;
        const expandable = opens(node);
        const expanded = expandable && model.expandedIds.includes(node.id);
        const label = `${node.key === undefined ? "" : `${node.key}: `}${node.preview}`;
        return h.div(
          [
            ...common,
            h.AriaLabel(label),
            h.AriaPosinset(row.position + 1),
            h.AriaSetsize(row.size),
            ...(expandable ? [h.AriaExpanded(expanded)] : []),
            h.DataAttribute("value-node", node.id),
            ...(node.kind === undefined ? [] : [h.DataAttribute("kind", node.kind)]),
            h.OnClick(
              toParentMessage(
                expandable ? Message.Toggled({ id: node.id }) : Message.Activated({ id: node.id }),
              ),
            ),
          ],
          [
            h.span(
              [...sxAttrs(h, styles.toggle), h.AriaHidden(true)],
              expandable
                ? [Icon.view({ icon: expanded ? ChevronDown : ChevronRight, size: 12 }, h)]
                : [],
            ),
            ...(node.key === undefined ? [] : [h.span(sxAttrs(h, styles.key), [`${node.key}:`])]),
            h.span(
              [...sxAttrs(h, styles.preview, kindStyle(node.kind)), h.Title(node.preview)],
              [node.preview],
            ),
          ],
        );
      }
      case "More":
        return h.div(
          [
            ...common,
            h.AriaLabel(`Show ${row.count} more`),
            h.DataAttribute("value-more", row.parentId),
            // The row is the control, so the tree's items hold nothing interactive.
            h.OnClick(toParentMessage(Message.ClickedMore({ id: row.parentId }))),
          ],
          [
            h.span([...sxAttrs(h, styles.toggle), h.AriaHidden(true)], []),
            h.span(sxAttrs(h, styles.more), [`Show ${row.count} more`]),
          ],
        );
      case "Loading":
      case "Empty":
        return h.div(
          [
            ...common,
            h.AriaLabel(row._tag === "Loading" ? "Loading" : "Empty"),
            ...(row._tag === "Loading" ? [h.AriaBusy(true)] : []),
            h.OnClick(toParentMessage(Message.Activated({ id }))),
          ],
          [
            h.span([...sxAttrs(h, styles.toggle), h.AriaHidden(true)], []),
            h.span(sxAttrs(h, styles.status), [row._tag === "Loading" ? "Loading…" : "empty"]),
          ],
        );
    }
  };
  return rows.length === 0
    ? h.p(sxAttrs(h, styles.empty), [config.emptyText ?? "No value."])
    : h.div(
        [
          ...sxAttrs(h, styles.tree),
          h.Id(model.id),
          h.Role("tree"),
          h.AriaLabel(config.label),
          h.Tabindex(0),
          ...(activeId === null ? [] : [h.AriaActiveDescendant(domId(model.id, activeId))]),
          h.OnKeyDownPreventDefault((key, modifiers) =>
            modifiers.ctrlKey ||
            modifiers.metaKey ||
            modifiers.altKey ||
            ![
              "ArrowUp",
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End",
              "Enter",
              " ",
            ].includes(key)
              ? Option.none()
              : Option.some(toParentMessage(Message.Navigated({ key }))),
          ),
        ],
        rows.map(item),
      );
};

export type FromValueOptions = Readonly<{
  /** Children shown per collection before “more”. Defaults to 100. */
  limit?: number;
  /** Levels built before a node is left unexpandable. Defaults to 8. */
  depth?: number;
}>;

/**
 * Nodes for a plain value: objects, arrays, Maps, Sets, and primitives, with
 * ids that are paths from `rootId`. For values a host has locally; a host with
 * values elsewhere builds nodes itself and loads children on request.
 */
export const fromValue = (
  value: unknown,
  rootId = "$",
  options: FromValueOptions = {},
): ValueNode => {
  const limit = options.limit ?? 100;
  const maxDepth = options.depth ?? 8;
  const seen = new Set<unknown>();
  const build = (
    current: unknown,
    id: string,
    key: string | undefined,
    depth: number,
  ): ValueNode => {
    const keyed = key === undefined ? {} : { key };
    if (current === null || current === undefined)
      return { id, ...keyed, preview: String(current), kind: "null" };
    if (typeof current === "string")
      return { id, ...keyed, preview: JSON.stringify(current), kind: "string" };
    if (typeof current === "number" || typeof current === "bigint")
      return { id, ...keyed, preview: String(current), kind: "number" };
    if (typeof current === "boolean")
      return { id, ...keyed, preview: String(current), kind: "boolean" };
    if (typeof current === "function")
      return { id, ...keyed, preview: `ƒ ${current.name || "anonymous"}`, kind: "function" };
    if (typeof current !== "object") return { id, ...keyed, preview: String(current) };
    if (seen.has(current)) return { id, ...keyed, preview: "(circular)", kind: "circular" };
    const entries: ReadonlyArray<readonly [string, unknown]> = Array.isArray(current)
      ? current.map((entry, index) => [String(index), entry])
      : current instanceof Map
        ? [...current].map(([entryKey, entry]) => [String(entryKey), entry])
        : current instanceof Set
          ? [...current].map((entry, index) => [String(index), entry])
          : Object.entries(current);
    const kind = Array.isArray(current)
      ? "list"
      : current instanceof Map
        ? "map"
        : current instanceof Set
          ? "set"
          : "record";
    const preview = `${kind === "record" ? "{…}" : kind} · ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
    if (depth >= maxDepth) return { id, ...keyed, preview, kind };
    seen.add(current);
    const children = entries
      .slice(0, limit)
      .map(([entryKey, entry]) =>
        build(entry, `${id}/${encodeURIComponent(entryKey)}`, entryKey, depth + 1),
      );
    seen.delete(current);
    return {
      id,
      ...keyed,
      preview,
      kind,
      children,
      ...(entries.length > limit ? { more: entries.length - limit } : {}),
    };
  };
  return build(value, rootId, undefined, 0);
};
