import { Effect, Option, Schema as S } from "effect";
import { Command, Dom, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { Html, HtmlBuilder } from "foldkit/html";
import * as stylex from "@stylexjs/stylex";
import * as Button from "./button";
import * as EditableText from "./editable-text";
import * as Icon from "./icon";
import { ChevronDown, ChevronRight, FileText } from "@lucide/icons";
import { sxAttrs } from "./sx";

export const Node = S.Struct({
  id: S.String, label: S.String, parentId: S.NullOr(S.String),
  branch: S.Boolean, renamable: S.Boolean, movable: S.Boolean,
});
export type Node = typeof Node.Type;
export type Move = Readonly<{ id: string; parentId: string | null; index: number }>;
export type Config = Readonly<{
  nodes: ReadonlyArray<Node>;
  canMove?: (move: Move) => boolean;
}>;
export const Model = S.Struct({
  id: S.String, expandedIds: S.Array(S.String), activeId: S.NullOr(S.String),
  selectedId: S.NullOr(S.String), editingId: S.NullOr(S.String), draft: S.String,
  originalLabel: S.String, search: S.String, searchTime: S.Number, announcement: S.String,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Selected: { id: S.String }, Toggled: { id: S.String },
  Navigated: { key: S.String, time: S.Number },
  StartedRename: {}, ChangedDraft: { value: S.String }, CommittedRename: {}, CancelledRename: {},
  Moved: { direction: S.Literals(["Up", "Down", "Indent", "Outdent"]) },
  CompletedFocus: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Selected: { id: S.String }, Renamed: { id: S.String, label: S.String },
  Moved: { id: S.String, parentId: S.NullOr(S.String), index: S.Number },
});
export type OutMessage = typeof OutMessage.Type;
type Result = Update.ReturnWithOutMessage<Model, Message, OutMessage>;

export const init = (config: Readonly<{ id: string; expandedIds?: ReadonlyArray<string>; selectedId?: string }>): Model => {
  if (!config.id) throw new Error("Tree requires a nonempty ID.");
  return {
  id: config.id, expandedIds: [...new Set(config.expandedIds ?? [])], activeId: config.selectedId ?? null,
  selectedId: config.selectedId ?? null, editingId: null, draft: "", originalLabel: "", search: "", searchTime: 0, announcement: "",
  };
};

/** Validate application-owned nodes before traversal; malformed forests never silently lose records. */
const indexNodes = (nodes: ReadonlyArray<Node>) => {
  const byId = new Map<string, Node>();
  const children = new Map<string | null, Node[]>();
  for (const node of nodes) {
    if (!node.id || byId.has(node.id)) throw new Error("Tree node IDs must be nonempty and unique.");
    byId.set(node.id, node);
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node); children.set(node.parentId, siblings);
  }
  for (const node of nodes) {
    const seen = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId !== null) {
      if (seen.has(parentId)) throw new Error("Tree nodes cannot form a cycle.");
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent?.branch) throw new Error("Tree parents must be existing branch nodes.");
      parentId = parent.parentId;
    }
  }
  return { byId, children };
};
export const visibleNodes = (model: Model, nodes: ReadonlyArray<Node>): ReadonlyArray<Node> => {
  const { children } = indexNodes(nodes);
  const expanded = new Set(model.expandedIds);
  const result: Node[] = [];
  const visit = (parentId: string | null) => {
    for (const node of children.get(parentId) ?? []) {
      result.push(node);
      if (expanded.has(node.id)) visit(node.id);
    }
  };
  visit(null); return result;
};
/** Reconcile removals and collapsed ancestors without changing the host's nodes. */
export const reconcile = (model: Model, nodes: ReadonlyArray<Node>): Model => {
  const { byId } = indexNodes(nodes);
  const visible = visibleNodes(model, nodes);
  const visibleIds = new Set(visible.map(node => node.id));
  let activeId = model.activeId;
  while (activeId && !visibleIds.has(activeId)) activeId = byId.get(activeId)?.parentId ?? null;
  activeId ??= visible.find(node => node.id === model.selectedId)?.id ?? visible[0]?.id ?? null;
  const editingId = model.editingId && visibleIds.has(model.editingId) ? model.editingId : null;
  return { ...model, activeId, editingId,
    selectedId: model.selectedId && byId.has(model.selectedId) ? model.selectedId : null,
    expandedIds: model.expandedIds.filter(id => byId.get(id)?.branch),
  };
};
const domId = (tree: string, node: string) => `${encodeURIComponent(tree)}-node-${encodeURIComponent(node)}`;
const Focus = Command.define("FocusTreeExplorer", {
  args: { id: S.String, item: S.NullOr(S.String), editing: S.Boolean }, messages: [Message.CompletedFocus],
  execute: ({ id, item, editing }) => Dom.focus(`#${CSS.escape(editing ? `${id}-rename` : id)}`).pipe(
    Effect.andThen(Effect.sync(() => { if (editing) (document.getElementById(`${id}-rename`) as HTMLInputElement | null)?.select(); })),
    Effect.andThen(item ? Dom.scrollIntoViewIfNotVisible(`#${CSS.escape(domId(id, item))}`, { block: "nearest", when: "Commit" }) : Effect.void),
    Effect.ignore, Effect.as(Message.CompletedFocus()),
  ),
});
const focus = (model: Model): Result => ({ model, commands: [Focus({ id: model.id, item: model.activeId, editing: model.editingId !== null })] });

export const moveTarget = (model: Model, direction: Extract<Message, { _tag: "Moved" }>["direction"], config: Config): Move | undefined => {
  const { byId, children } = indexNodes(config.nodes);
  const node = byId.get(model.activeId ?? "");
  if (!node?.movable) return;
  const siblings = children.get(node.parentId) ?? [];
  const index = siblings.findIndex(item => item.id === node.id);
  let move: Move | undefined;
  if (direction === "Up" && index > 0) move = { id: node.id, parentId: node.parentId, index: index - 1 };
  if (direction === "Down" && index < siblings.length - 1) move = { id: node.id, parentId: node.parentId, index: index + 1 };
  if (direction === "Indent") {
    const previous = siblings[index - 1];
    if (previous?.branch) move = { id: node.id, parentId: previous.id, index: (children.get(previous.id) ?? []).length };
  }
  if (direction === "Outdent" && node.parentId !== null) {
    const parent = byId.get(node.parentId)!;
    move = { id: node.id, parentId: parent.parentId, index: (children.get(parent.parentId) ?? []).findIndex(item => item.id === parent.id) + 1 };
  }
  return move && config.canMove?.(move) !== false ? move : undefined;
};

/** Index is the destination sibling index AFTER removing the moved node. Children keep their IDs. */
export const moveNodes = <N extends Node>(nodes: ReadonlyArray<N>, move: Move): ReadonlyArray<N> => {
  const { byId } = indexNodes(nodes);
  const node = byId.get(move.id);
  if (!node?.movable || !Number.isInteger(move.index) || move.index < 0) return nodes;
  let parentId = move.parentId;
  if (parentId !== null && !byId.get(parentId)?.branch) return nodes;
  while (parentId !== null) { if (parentId === move.id) return nodes; parentId = byId.get(parentId)!.parentId; }
  const remaining = nodes.filter(item => item.id !== move.id);
  const siblings = remaining.filter(item => item.parentId === move.parentId);
  if (move.index > siblings.length) return nodes;
  const before = siblings[move.index];
  const insertion = before ? remaining.findIndex(item => item.id === before.id) : remaining.length;
  return [...remaining.slice(0, insertion), { ...nodes.find(item => item.id === move.id)!, parentId: move.parentId }, ...remaining.slice(insertion)];
};

export const update = (previous: Model, message: Message, config: Config): Result => {
  const model = reconcile(previous, config.nodes);
  const nodes = visibleNodes(model, config.nodes);
  const active = nodes.find(node => node.id === model.activeId);
  return Message.match<Result>(message, {
    CompletedFocus: () => ({ model }),
    Selected: ({ id }) => nodes.some(node => node.id === id)
      ? { ...focus({ ...model, activeId: id, selectedId: id, editingId: null, search: "" }), outMessage: OutMessage.Selected({ id }) } : { model },
    Toggled: ({ id }) => {
      if (!nodes.find(node => node.id === id)?.branch) return { model };
      const expandedIds = model.expandedIds.includes(id) ? model.expandedIds.filter(value => value !== id) : [...model.expandedIds, id];
      return focus(reconcile({ ...model, activeId: id, expandedIds, editingId: null, search: "" }, config.nodes));
    },
    StartedRename: () => active?.renamable ? focus({ ...model, editingId: active.id, draft: active.label, originalLabel: active.label }) : { model },
    ChangedDraft: ({ value }) => ({ model: model.editingId ? { ...model, draft: value } : model }),
    CancelledRename: () => focus({ ...model, editingId: null, draft: "" }),
    CommittedRename: () => {
      const node = config.nodes.find(node => node.id === model.editingId);
      if (!node?.renamable) return focus({ ...model, editingId: null });
      if (node.label !== model.originalLabel) return focus({ ...model, editingId: null, announcement: "Name changed elsewhere. Rename cancelled." });
      const label = model.draft.trim();
      if (!label) return focus({ ...model, announcement: "Enter a name." });
      const result = focus({ ...model, editingId: null, announcement: `Rename requested: ${label}.` });
      return label === node.label ? result : { ...result, outMessage: OutMessage.Renamed({ id: node.id, label }) };
    },
    Moved: ({ direction }) => {
      const target = moveTarget(model, direction, config);
      if (!target || model.editingId) return { model };
      return { ...focus({ ...model, expandedIds: target.parentId ? [...new Set([...model.expandedIds, target.parentId])] : model.expandedIds,
        announcement: `Move requested: ${active?.label ?? "item"}.` }), outMessage: OutMessage.Moved(target) };
    },
    Navigated: ({ key, time }) => {
      if (!active || model.editingId) return { model };
      let id = active.id;
      const index = nodes.indexOf(active);
      if (key === "ArrowDown") id = nodes[Math.min(index + 1, nodes.length - 1)]!.id;
      else if (key === "ArrowUp") id = nodes[Math.max(0, index - 1)]!.id;
      else if (key === "Home") id = nodes[0]!.id;
      else if (key === "End") id = nodes[nodes.length - 1]!.id;
      else if (key === "ArrowRight") {
        if (active.branch && !model.expandedIds.includes(id)) return update(model, Message.Toggled({ id }), config);
        id = nodes.find(node => node.parentId === active.id)?.id ?? id;
      } else if (key === "ArrowLeft") {
        if (active.branch && model.expandedIds.includes(id)) return update(model, Message.Toggled({ id }), config);
        id = active.parentId ?? id;
      } else if (key === "Enter" || key === " ") return update(model, Message.Selected({ id }), config);
      else if (key === "F2") return update(model, Message.StartedRename(), config);
      else if (key.length === 1) {
        const character = key.toLocaleLowerCase();
        const search = time - model.searchTime < 700 ? model.search + character : character;
        const repeated = [...search].every(value => value === character);
        const candidates = [...nodes.slice(index + (repeated ? 1 : 0)), ...nodes.slice(0, index + (repeated ? 1 : 0))];
        id = candidates.find(node => node.label.toLocaleLowerCase().startsWith(repeated ? character : search))?.id ?? id;
        return focus({ ...model, activeId: id, search, searchTime: time });
      }
      return focus({ ...model, activeId: id, search: "" });
    },
  });
};

const styles = stylex.create({
  root: { minWidth: 0 },
  tree: { outline: { default: "none", ":focus-visible": "2px solid var(--foldworks-ui-focus)" }, outlineOffset: "-2px", padding: "4px", minWidth: 0 },
  row: { alignItems: "center", display: "flex", gap: "7px", minHeight: "34px", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: "var(--foldworks-ui-foreground)", fontSize: "12px", backgroundColor: { default: "transparent", ":hover": "var(--foldworks-ui-surface-hover)" } },
  selected: { backgroundColor: "var(--foldworks-ui-selection)", color: "var(--foldworks-ui-selection-foreground)" },
  active: { outline: "1px solid var(--foldworks-ui-border-strong)", outlineOffset: "-1px" },
  label: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 },
  toggle: { display: "inline-flex", width: "18px", justifyContent: "center", flexShrink: 0, cursor: "pointer" },
  actions: { display: "flex", flexWrap: "wrap", gap: "4px", padding: "8px 4px", borderTop: "1px solid var(--foldworks-ui-border)" },
  input: { width: "100%", minWidth: 0, font: "inherit", color: "var(--foldworks-ui-foreground)", backgroundColor: "var(--foldworks-ui-surface)", border: "1px solid var(--foldworks-ui-focus)", borderRadius: "4px", padding: "4px" },
  status: { fontSize: "11px", color: "var(--foldworks-ui-foreground-muted)", padding: "4px 8px" },
});

export const view = <ParentMessage>(config: Config & Readonly<{
  model: Model; label: string; toParentMessage: (message: Message) => ParentMessage;
}>, h: HtmlBuilder<ParentMessage>): Html => {
  const { toParentMessage } = config;
  const model = reconcile(config.model, config.nodes);
  const { children } = indexNodes(config.nodes);
  const render = (parentId: string | null, level: number): ReadonlyArray<Html> => (children.get(parentId) ?? []).map((node, index, siblings) => {
    const editing = model.editingId === node.id;
    return h.keyed("div")(node.id, [h.Id(domId(model.id, node.id)), h.Role("treeitem"), h.AriaLabel(node.label),
      h.AriaSelected(model.selectedId === node.id), h.AriaLevel(level), h.AriaPosinset(index + 1), h.AriaSetsize(siblings.length),
      ...(node.branch ? [h.AriaExpanded(model.expandedIds.includes(node.id))] : []),
    ], [
      h.div([...sxAttrs(h, styles.row, model.selectedId === node.id && styles.selected, model.activeId === node.id && styles.active),
        h.Style({ paddingInlineStart: `${8 + (level - 1) * 16}px` })], [
        h.span([...sxAttrs(h, styles.toggle), h.AriaHidden(true),
          ...(node.branch ? [h.OnClick(toParentMessage(Message.Toggled({ id: node.id })))] : [])], [
            Icon.view({ icon: node.branch ? (model.expandedIds.includes(node.id) ? ChevronDown : ChevronRight) : FileText, size: 14 }, h),
          ]),
        ...(editing ? [EditableText.control({ id: `${model.id}-rename`, label: `Rename ${node.label}`, value: model.draft,
          onChange: value => toParentMessage(Message.ChangedDraft({ value })),
          onCommit: toParentMessage(Message.CommittedRename()), onCancel: toParentMessage(Message.CancelledRename()),
        }, h)] : [h.span([...sxAttrs(h, styles.label), h.Title(node.label),
          h.OnClick(toParentMessage(Message.Selected({ id: node.id })))], [node.label])]),
      ]),
      ...(node.branch && model.expandedIds.includes(node.id) ? [h.div([h.Role("group")], render(node.id, level + 1))] : []),
    ]);
  });
  const active = config.nodes.find(node => node.id === model.activeId);
  return h.div(sxAttrs(h, styles.root), [
    h.div([...sxAttrs(h, styles.tree), h.Id(model.id), h.Role("tree"), h.AriaLabel(config.label), h.Tabindex(0),
      ...(model.activeId ? [h.AriaActiveDescendant(domId(model.id, model.activeId))] : []),
      h.OnKeyDownPreventDefault((key, modifiers) => {
        if (model.editingId || modifiers.ctrlKey || modifiers.metaKey) return Option.none();
        if (modifiers.altKey) {
          const directions: Readonly<Record<string, "Up" | "Down" | "Indent" | "Outdent">> = { ArrowUp: "Up", ArrowDown: "Down", ArrowRight: "Indent", ArrowLeft: "Outdent" };
          const direction = directions[key];
          return direction ? Option.some(toParentMessage(Message.Moved({ direction }))) : Option.none();
        }
        return ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " ", "F2"].includes(key) || key.length === 1
          ? Option.some(toParentMessage(Message.Navigated({ key, time: Date.now() }))) : Option.none();
      }),
    ], config.nodes.length ? render(null, 1) : [h.p(sxAttrs(h, styles.status), ["No items."])]),
    h.div([...sxAttrs(h, styles.actions), h.Role("group"), h.AriaLabel(`${config.label} actions`)], model.editingId ? [
      Button.view({ label: "Save name", size: "xs", onClick: toParentMessage(Message.CommittedRename()) }, h),
      Button.view({ label: "Cancel rename", size: "xs", variant: "ghost", onClick: toParentMessage(Message.CancelledRename()) }, h),
    ] : [
      Button.view({ label: "Rename", size: "xs", variant: "ghost", isDisabled: !active?.renamable, onClick: toParentMessage(Message.StartedRename()) }, h),
      ...(["Up", "Down", "Indent", "Outdent"] as const).map(direction => Button.view({
        label: direction === "Up" || direction === "Down" ? `Move ${direction.toLowerCase()}` : direction,
        size: "xs", variant: "ghost", isDisabled: !moveTarget(model, direction, config), onClick: toParentMessage(Message.Moved({ direction })),
      }, h)),
    ]),
    h.div([...sxAttrs(h, styles.status), h.AriaLive("polite"), h.Role("status")], [model.announcement]),
  ]);
};
