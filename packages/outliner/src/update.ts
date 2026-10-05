import { Effect, Schema as S } from "effect";
import { Command, type Update } from "foldkit";
import { afterCommit } from "foldkit/render";
import { History } from "@foldworks/history";

import { offsetAtX } from "./caret";
import { FOCUSED_EVENT } from "./mount";
import { keepsFocus, type Action } from "./keymap";
import { Message } from "./message";
import { counterFor, domIds, type Focus, type Model, type Snapshot } from "./model";
import {
  ancestors,
  find,
  indent,
  insertItems,
  item,
  locate,
  mergeIntoPrevious,
  mergeNext,
  moveDown,
  moveItems,
  moveUp,
  outdent,
  removeItems,
  roots,
  setAllCollapsed,
  setCollapsed,
  expandToLevel,
  split,
  updateItem,
  walk,
  childrenOf,
  isWithin,
  type Items,
  type Row,
} from "./outline";
import { rowsOf, selectedIds, selectedRoots } from "./selectors";
import { parseOutline } from "./text";

type UpdateReturn = Update.Return<Model, Message>;

const HISTORY_LIMIT = 200;
const TYPING_PAUSE = 1200;

export const FocusRequest = S.Union([
  S.TaggedStruct("Text", { id: S.String, start: S.Number, end: S.Number }),
  S.TaggedStruct("TextAtX", { id: S.String, x: S.Number, line: S.Literals(["First", "Last"]) }),
  S.TaggedStruct("Row", { id: S.String }),
  S.TaggedStruct("Tree", {}),
  S.TaggedStruct("Add", {}),
]);
export type FocusRequest = typeof FocusRequest.Type;

const FocusOutliner = Command.define("FocusOutliner", {
  args: { modelId: S.String, request: FocusRequest },
  messages: [Message.CompletedFocus],
  execute: ({ modelId, request }) =>
    Effect.gen(function* () {
      yield* afterCommit;
      const ids = domIds(modelId);
      const elementId =
        request._tag === "Text" || request._tag === "TextAtX"
          ? ids.text(request.id)
          : request._tag === "Row"
            ? ids.row(request.id)
            : request._tag === "Add"
              ? ids.add
              : ids.tree;
      const element = document.getElementById(elementId);
      if (element === null) return Message.CompletedFocus();
      if (document.activeElement !== element) element.focus({ preventScroll: true });
      if (element instanceof HTMLTextAreaElement) {
        if (request._tag === "Text") {
          const length = element.value.length;
          element.setSelectionRange(Math.min(request.start, length), Math.min(request.end, length));
        } else if (request._tag === "TextAtX") {
          const offset = offsetAtX(element, request.x, request.line);
          element.setSelectionRange(offset, offset);
        }
      }
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
      element.dispatchEvent(new CustomEvent(FOCUSED_EVENT, { bubbles: true }));
      return Message.CompletedFocus();
    }),
});

const focusCommand = (model: Model, request: FocusRequest) =>
  FocusOutliner({ modelId: model.id, request });

const newId = (
  model: Model,
  items: Items = model.items,
): Readonly<{ id: string; nextId: number }> => {
  let counter = model.nextId;
  while (find(items, `${model.id}-${counter}`) !== undefined) counter += 1;
  return { id: `${model.id}-${counter}`, nextId: counter + 1 };
};

/** Records the current document for undo and replaces it. */
const commit = (
  model: Model,
  items: Items,
  options: Readonly<{ before?: Focus | null; coalescingKey?: string; announcement?: string }> = {},
): Model => ({
  ...model,
  items,
  history: History.record<Snapshot>(
    model.history,
    { items: model.items, focus: options.before === undefined ? model.focus : options.before },
    {
      limit: HISTORY_LIMIT,
      ...(options.coalescingKey === undefined ? {} : { coalescingKey: options.coalescingKey }),
    },
  ),
  revision: model.revision + 1,
  announcement: options.announcement ?? model.announcement,
});

const editText = (
  model: Model,
  focus: Focus,
  items: Items,
  extra: Partial<Model> = {},
): UpdateReturn => ({
  model: { ...model, ...extra, items, mode: "Text", selection: null, focus },
  commands: [
    focusCommand(model, { _tag: "Text", id: focus.id, start: focus.start, end: focus.end }),
  ],
});

const textFocus = (id: string, offset: number): Focus => ({ id, start: offset, end: offset });

const selectRows = (model: Model, anchorId: string, headId: string): UpdateReturn => ({
  model: { ...model, mode: "Rows", selection: { anchorId, headId } },
  commands: [focusCommand(model, { _tag: "Row", id: headId })],
});

/** After a structural change, put focus back where the user was working. */
const refocus = (model: Model): UpdateReturn => {
  if (model.mode === "Rows" && model.selection !== null) {
    return { model, commands: [focusCommand(model, { _tag: "Row", id: model.selection.headId })] };
  }
  return model.focus === null
    ? { model }
    : {
        model,
        commands: [
          focusCommand(model, {
            _tag: "Text",
            id: model.focus.id,
            start: model.focus.start,
            end: model.focus.end,
          }),
        ],
      };
};

const neighbour = (rows: ReadonlyArray<Row>, id: string, delta: -1 | 1): Row | undefined => {
  const index = rows.findIndex((row) => row.id === id);
  return index < 0 ? undefined : rows[index + delta];
};

const plural = (count: number, noun: string): string =>
  count === 1 ? `1 ${noun}` : `${count} ${noun}s`;

/** Merges current collapse state into a restored snapshot, so undo never refolds the outline. */
const keepCollapse = (restored: Items, current: Items): Items => {
  const collapsed = new Map(walk(current).map((node) => [node.id, node.collapsed]));
  const apply = (nodes: Items): Items =>
    nodes.map((node) => {
      const state = collapsed.get(node.id);
      const children = apply(node.children);
      return {
        ...node,
        collapsed: node.children.length > 0 && (state ?? node.collapsed),
        children,
      };
    });
  return apply(restored);
};

/** Applies a fold to the items below the hoisted scope. */
const foldScope = (model: Model, fold: (items: Items) => Items): Items =>
  model.scopeId === null
    ? fold(model.items)
    : updateItem(model.items, model.scopeId, (node) => ({
        ...node,
        children: fold(node.children),
      }));

/** Replaces the folding; a caret that folds out of sight moves to its nearest visible ancestor. */
const refold = (model: Model, items: Items, announcement: string): Model => {
  const next: Model = {
    ...model,
    items,
    revision: model.revision + 1,
    mode: "Text",
    selection: null,
    announcement,
  };
  if (model.focus === null) return next;
  const visible = new Set(rowsOf(next).map((row) => row.id));
  if (visible.has(model.focus.id)) return next;
  const ancestor = ancestors(items, model.focus.id)
    .toReversed()
    .find((id) => visible.has(id));
  return {
    ...next,
    focus:
      ancestor === undefined ? null : textFocus(ancestor, find(items, ancestor)?.text.length ?? 0),
  };
};

const travel = (model: Model, direction: "Undo" | "Redo", current: Focus | null): UpdateReturn => {
  const snapshot: Snapshot = { items: model.items, focus: current };
  const restored =
    direction === "Undo"
      ? History.undo(model.history, snapshot)
      : History.redo(model.history, snapshot);
  if (restored === undefined) return { model };
  const items = keepCollapse(restored.value.items, model.items);
  const focus = restored.value.focus;
  const scopeId =
    model.scopeId !== null && find(items, model.scopeId) === undefined ? null : model.scopeId;
  const next: Model = {
    ...model,
    items,
    scopeId,
    history: restored.history,
    revision: model.revision + 1,
    announcement: direction === "Undo" ? "Undone." : "Redone.",
  };
  if (focus !== null && find(items, focus.id) !== undefined) {
    // Undo may restore a row inside a collapsed parent; reveal it.
    const revealed = ancestors(items, focus.id).reduce(
      (nodes, id) => setCollapsed(nodes, id, false),
      items,
    );
    return editText(model, focus, revealed, {
      scopeId: next.scopeId,
      history: next.history,
      revision: next.revision,
      announcement: next.announcement,
    });
  }
  return { model: { ...next, mode: "Text", selection: null, focus: null } };
};

const toggleChecked = (model: Model, ids: ReadonlyArray<string>): Model => {
  const nodes = ids.map((id) => find(model.items, id)).filter((node) => node !== undefined);
  if (nodes.length === 0) return model;
  const checked = !nodes.every((node) => node.checked);
  const items = nodes.reduce(
    (current, node) => updateItem(current, node.id, (value) => ({ ...value, checked })),
    model.items,
  );
  return commit(model, items, {
    announcement: `${plural(nodes.length, "item")} marked ${checked ? "done" : "not done"}.`,
  });
};

const hoist = (model: Model, scopeId: string | null, focusId?: string): UpdateReturn => {
  if (scopeId !== null && find(model.items, scopeId) === undefined) return { model };
  const items = scopeId === null ? model.items : setCollapsed(model.items, scopeId, false);
  const next: Model = {
    ...model,
    items,
    scopeId,
    selection: null,
    mode: "Text",
    announcement:
      scopeId === null
        ? "Showing the whole outline."
        : `Hoisted ${find(items, scopeId)?.text || "untitled item"}.`,
  };
  const rows = rowsOf(next);
  const target = focusId ?? rows[0]?.id;
  if (target === undefined) {
    return { model: { ...next, focus: null }, commands: [focusCommand(next, { _tag: "Add" })] };
  }
  const length = find(items, target)?.text.length ?? 0;
  return editText(next, textFocus(target, length), items);
};

const deleteRows = (
  model: Model,
  ids: ReadonlyArray<string>,
  mode: Model["mode"],
): UpdateReturn => {
  const rows = rowsOf(model);
  const removing = roots(model.items, ids);
  if (removing.length === 0) return { model };
  const removedSet = new Set(removing);
  const hidden = (row: Row) =>
    removedSet.has(row.id) || ancestors(model.items, row.id).some((id) => removedSet.has(id));
  const firstIndex = rows.findIndex((row) => removedSet.has(row.id));
  const after = rows.slice(firstIndex + 1).find((row) => !hidden(row));
  const before = rows
    .slice(0, Math.max(0, firstIndex))
    .reverse()
    .find((row) => !hidden(row));
  const target = after ?? before;
  const items = removeItems(model.items, removing).items;
  const committed = commit(model, items, {
    announcement: `Deleted ${plural(removing.length, "item")}.`,
  });
  if (target === undefined) {
    return {
      model: { ...committed, mode: "Text", selection: null, focus: null },
      commands: [focusCommand(model, { _tag: "Add" })],
    };
  }
  return mode === "Rows"
    ? selectRows({ ...committed, focus: null }, target.id, target.id)
    : editText(
        committed,
        textFocus(target.id, after === undefined ? target.text.length : 0),
        items,
      );
};

const pressed = (
  model: Model,
  action: Action,
  id: string,
  start: number,
  end: number,
  goalX: number,
): UpdateReturn => {
  const rows = rowsOf(model);
  const node = find(model.items, id);
  if (node === undefined) return { model };
  const caret: Focus = { id, start, end };
  const inRows = model.mode === "Rows" && model.selection !== null;
  const targets = inRows ? selectedRoots(model) : [id];
  // Keep the live caret so structural edits can restore it.
  const base: Model = inRows ? model : { ...model, focus: caret, mode: "Text" };

  switch (action) {
    case "Split": {
      const location = locate(model.items, id)!;
      const siblings = childrenOf(model.items, location.parentId) ?? [];
      const isLastEmptyChild =
        node.text === "" &&
        node.children.length === 0 &&
        location.parentId !== null &&
        location.parentId !== model.scopeId &&
        location.index === siblings.length - 1;
      if (isLastEmptyChild) {
        const items = outdent(model.items, [id], model.scopeId);
        if (items !== undefined) {
          return editText(
            commit(base, items, { announcement: "Outdented." }),
            textFocus(id, 0),
            items,
          );
        }
      }
      const { id: created, nextId } = newId(model);
      const result = split(model.items, id, start, end, created);
      if (result === undefined) return { model };
      return editText(
        { ...commit(base, result.items), nextId },
        textFocus(result.focusId, result.offset),
        result.items,
      );
    }
    case "Indent":
    case "Outdent": {
      const items =
        action === "Indent"
          ? indent(model.items, targets)
          : outdent(model.items, targets, model.scopeId);
      if (items === undefined) return { model: base };
      const announcement = `${action === "Indent" ? "Indented" : "Outdented"} ${plural(targets.length, "item")}.`;
      return refocus(commit(base, items, { announcement }));
    }
    case "MoveUp":
    case "MoveDown": {
      const items =
        action === "MoveUp"
          ? moveUp(model.items, targets, model.scopeId)
          : moveDown(model.items, targets, model.scopeId);
      if (items === undefined) return { model: base };
      return refocus(
        commit(base, items, { announcement: `Moved ${action === "MoveUp" ? "up" : "down"}.` }),
      );
    }
    case "Collapse":
    case "Expand": {
      const collapsed = action === "Collapse";
      const items = targets.reduce(
        (current, target) => setCollapsed(current, target, collapsed),
        model.items,
      );
      return items === model.items
        ? { model: base }
        : refocus({
            ...base,
            items,
            revision: model.revision + 1,
            announcement: collapsed ? "Collapsed." : "Expanded.",
          });
    }
    case "ToggleChecked":
      return { model: toggleChecked(base, targets) };
    case "ZoomIn":
      return hoist(base, inRows ? (model.selection?.headId ?? id) : id);
    case "ZoomOut": {
      if (model.scopeId === null) return { model: base };
      const parent = locate(model.items, model.scopeId)?.parentId ?? null;
      return hoist(base, parent, model.scopeId);
    }
    case "Undo":
    case "Redo":
      return travel(model, action, inRows ? model.focus : caret);
    case "MergePrevious": {
      if (node.text === "" && node.children.length === 0 && rows[0]?.id === id) {
        const next = neighbour(rows, id, 1);
        return next === undefined ? { model: base } : deleteRows(base, [id], "Text");
      }
      const result = mergeIntoPrevious(model.items, id, model.scopeId);
      if (result === undefined) return { model: base };
      return editText(
        commit(base, result.items),
        textFocus(result.focusId, result.offset),
        result.items,
      );
    }
    case "MergeNext": {
      const result = mergeNext(model.items, id, model.scopeId);
      if (result === undefined) return { model: base };
      return editText(commit(base, result.items), textFocus(id, result.offset), result.items);
    }
    case "Delete":
      return deleteRows(base, targets, inRows ? "Rows" : "Text");
    case "FocusPrevious":
    case "FocusNext": {
      const target = neighbour(rows, id, action === "FocusPrevious" ? -1 : 1);
      if (target === undefined) {
        const offset = action === "FocusPrevious" ? 0 : node.text.length;
        return editText(base, textFocus(id, offset), model.items);
      }
      return {
        model: { ...base, focus: textFocus(target.id, 0) },
        commands: [
          focusCommand(model, {
            _tag: "TextAtX",
            id: target.id,
            x: goalX,
            line: action === "FocusPrevious" ? "Last" : "First",
          }),
        ],
      };
    }
    case "FocusPreviousEnd": {
      const target = neighbour(rows, id, -1);
      return target === undefined
        ? { model: base }
        : editText(base, textFocus(target.id, target.text.length), model.items);
    }
    case "FocusNextStart": {
      const target = neighbour(rows, id, 1);
      return target === undefined
        ? { model: base }
        : editText(base, textFocus(target.id, 0), model.items);
    }
    case "SelectRow":
      return selectRows(base, id, id);
    case "ExtendUp":
    case "ExtendDown": {
      const anchorId = inRows ? model.selection!.anchorId : id;
      const headId = inRows ? model.selection!.headId : id;
      const target = neighbour(rows, headId, action === "ExtendUp" ? -1 : 1);
      return selectRows(base, anchorId, target?.id ?? headId);
    }
    case "SelectPrevious":
    case "SelectNext": {
      const headId = model.selection?.headId ?? id;
      const target =
        neighbour(rows, headId, action === "SelectPrevious" ? -1 : 1) ?? find(model.items, headId);
      return target === undefined ? { model: base } : selectRows(base, target.id, target.id);
    }
    case "CollapseOrParent": {
      const headId = model.selection?.headId ?? id;
      const head = rows.find((row) => row.id === headId);
      if (head === undefined) return { model: base };
      if (head.hasChildren && !head.collapsed) {
        return {
          model: {
            ...base,
            items: setCollapsed(model.items, headId, true),
            revision: model.revision + 1,
          },
        };
      }
      return head.parentId === null || head.parentId === model.scopeId
        ? { model: base }
        : selectRows(base, head.parentId, head.parentId);
    }
    case "ExpandOrChild": {
      const headId = model.selection?.headId ?? id;
      const head = rows.find((row) => row.id === headId);
      if (head === undefined || !head.hasChildren) return { model: base };
      if (head.collapsed) {
        return {
          model: {
            ...base,
            items: setCollapsed(model.items, headId, false),
            revision: model.revision + 1,
          },
        };
      }
      const child = neighbour(rows, headId, 1);
      return child === undefined ? { model: base } : selectRows(base, child.id, child.id);
    }
    case "Edit": {
      const headId = model.selection?.headId ?? id;
      const text = find(model.items, headId)?.text ?? "";
      const focus =
        model.focus !== null && model.focus.id === headId
          ? model.focus
          : textFocus(headId, text.length);
      return editText(base, focus, model.items);
    }
    case "ClearSelection":
      return {
        model: { ...base, mode: "Text", selection: null },
        commands: [focusCommand(model, { _tag: "Tree" })],
      };
    case "ShowInfo":
      return { model: { ...base, hover: { id, offset: start, source: "Keyboard" } } };
    case "SelectAll": {
      const first = rows[0];
      const last = rows[rows.length - 1];
      return first === undefined || last === undefined
        ? { model: base }
        : selectRows(base, first.id, last.id);
    }
  }
};

const pasteText = (
  model: Model,
  id: string,
  mode: Model["mode"],
  start: number,
  end: number,
  text: string,
): UpdateReturn => {
  let counter = model.nextId;
  const generate = (): string => {
    while (find(model.items, `${model.id}-${counter}`) !== undefined) counter += 1;
    return `${model.id}-${counter++}`;
  };
  const fragment = parseOutline(text, generate);
  const [first, ...rest] = fragment;
  const location = locate(model.items, id);
  const node = find(model.items, id);
  if (first === undefined || location === undefined || node === undefined) return { model };

  if (mode === "Rows") {
    const anchor = selectedRoots(model).at(-1) ?? id;
    const anchorLocation = locate(model.items, anchor) ?? location;
    const items = insertItems(
      model.items,
      anchorLocation.parentId,
      anchorLocation.index + 1,
      fragment,
    );
    if (items === undefined) return { model };
    const pasted = commit({ ...model, nextId: counter }, items, {
      announcement: `Pasted ${plural(fragment.length, "item")}.`,
    });
    return selectRows(pasted, first.id, fragment.at(-1)!.id);
  }

  const before = node.text.slice(0, start);
  const after = node.text.slice(end);
  // The first line joins the text before the caret, like a text editor paste.
  let items = updateItem(model.items, id, (current) => ({
    ...current,
    text: before + first.text,
    checked: before === "" && after === "" ? first.checked : current.checked,
    children: [...first.children, ...current.children],
    collapsed: first.children.length > 0 ? false : current.collapsed,
  }));
  items = insertItems(items, location.parentId, location.index + 1, rest) ?? items;
  const inserted = [...walk(first.children), ...walk(rest)];
  const lastId = inserted.at(-1)?.id ?? id;
  const lastText = find(items, lastId)?.text ?? "";
  items = updateItem(items, lastId, (current) => ({ ...current, text: current.text + after }));
  const committed = commit({ ...model, nextId: counter }, items, {
    before: { id, start, end },
    announcement: `Pasted ${plural(fragment.length + walk(first.children).length, "item")}.`,
  });
  return editText(committed, textFocus(lastId, lastText.length), items);
};

const textChange = (previous: string, next: string): number => {
  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return previous.length - suffix;
};

/** Messages that leave hover information showing; anything else, such as typing, hides it. */
const keepsHover = (message: Message): boolean =>
  message._tag === "Hovered" ||
  message._tag === "DismissedHover" ||
  message._tag === "CompletedFocus" ||
  (message._tag === "Pressed" && message.action === "ShowInfo");

export const update = (model: Model, message: Message): UpdateReturn => {
  const result = updateOutline(model, message);
  return keepsHover(message) || result.model.hover === null
    ? result
    : { ...result, model: { ...result.model, hover: null } };
};

const updateOutline = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    Pressed: ({ action, id, start, end, goalX }) => {
      const result = pressed(model, action, id, start, end, goalX);
      // In-place edits leave focus alone, so a late caret restore cannot jump over new typing.
      if (keepsFocus(action)) return { model: result.model };
      // Every other key press ends with a focus command, even a no-op, so held keys replay.
      return result.commands === undefined ? refocus(result.model) : result;
    },
    EditedText: ({ id, text, start, end, time }) => {
      const node = find(model.items, id);
      if (node === undefined || node.text === text) {
        return { model: { ...model, focus: { id, start, end } } };
      }
      const offset = textChange(node.text, text);
      const items = updateItem(model.items, id, (current) => ({ ...current, text }));
      // Typing in one item undoes as one step until the writer pauses.
      const paused = time - model.typedAt > TYPING_PAUSE;
      const history = paused ? History.breakCoalescing(model.history) : model.history;
      return {
        model: {
          ...commit({ ...model, history }, items, {
            before: textFocus(id, offset),
            coalescingKey: `text:${id}`,
          }),
          typedAt: time,
          focus: { id, start, end },
          mode: "Text",
          selection: null,
        },
      };
    },
    FocusedText: ({ id, start, end }) => ({
      model: {
        ...model,
        mode: "Text",
        selection: null,
        focus: { id, start, end },
        history: model.focus?.id === id ? model.history : History.breakCoalescing(model.history),
      },
    }),
    PastedText: ({ id, mode, start, end, text }) => pasteText(model, id, mode, start, end, text),
    ToggledCollapsed: ({ id, recursive }) => {
      const node = find(model.items, id);
      if (node === undefined || node.children.length === 0) return { model };
      const items = setCollapsed(model.items, id, !node.collapsed, recursive);
      // Keep the caret visible: collapsing a row that hides it moves focus to the row.
      const hidesFocus =
        !node.collapsed &&
        model.focus !== null &&
        ancestors(model.items, model.focus.id).includes(id);
      const next: Model = {
        ...model,
        items,
        revision: model.revision + 1,
        focus: hidesFocus ? textFocus(id, node.text.length) : model.focus,
      };
      return hidesFocus ? editText(next, next.focus!, items) : { model: next };
    },
    ToggledChecked: ({ id }) => ({ model: toggleChecked(model, [id]) }),
    ClickedBullet: ({ id }) => hoist(model, id),
    SelectedRange: ({ anchorId, headId }) => {
      const rows = rowsOf(model);
      return rows.some((row) => row.id === anchorId) && rows.some((row) => row.id === headId)
        ? selectRows(model, anchorId, headId)
        : { model };
    },
    StartedDrag: ({ ids }) => {
      const dragged = roots(model.items, ids);
      if (dragged.length === 0) return { model };
      const rows = rowsOf(model);
      const selected = new Set(selectedIds(model, rows));
      const keepsSelection = dragged.every((id) => selected.has(id));
      return {
        model: {
          ...model,
          drag: { ids: dragged, target: null },
          ...(keepsSelection
            ? {}
            : {
                mode: "Rows" as const,
                selection: { anchorId: dragged[0]!, headId: dragged.at(-1)! },
              }),
        },
      };
    },
    MovedDrag: ({ target }) =>
      model.drag === null ? { model } : { model: { ...model, drag: { ...model.drag, target } } },
    Dropped: () => {
      const drag = model.drag;
      const cleared: Model = { ...model, drag: null };
      if (drag === null || drag.target === null) return { model: cleared };
      const items = moveItems(model.items, drag.ids, drag.target.placement);
      if (items === undefined) return { model: cleared };
      const moved = commit(cleared, items, {
        announcement: `Moved ${plural(drag.ids.length, "item")}.`,
      });
      return selectRows(moved, drag.ids[0]!, drag.ids.at(-1)!);
    },
    CancelledDrag: () => ({ model: { ...model, drag: null } }),
    Hovered: ({ target }) => {
      const current = model.hover;
      if (target === null) return { model: current === null ? model : { ...model, hover: null } };
      return current !== null &&
        current.source === "Pointer" &&
        current.id === target.id &&
        current.offset === target.offset
        ? { model }
        : { model: { ...model, hover: { ...target, source: "Pointer" } } };
    },
    DismissedHover: () => ({ model: model.hover === null ? model : { ...model, hover: null } }),
    Hoisted: ({ id }) => hoist(model, id),
    ClickedAdd: () => {
      const { id, nextId } = newId(model);
      const parentId = model.scopeId;
      const siblings = childrenOf(model.items, parentId) ?? [];
      const items = insertItems(model.items, parentId, siblings.length, [item(id)]);
      if (items === undefined) return { model };
      return editText({ ...commit(model, items), nextId }, textFocus(id, 0), items);
    },
    SetAllCollapsed: ({ collapsed }) => ({
      model: refold(
        model,
        foldScope(model, (items) => setAllCollapsed(items, collapsed)),
        collapsed ? "Collapsed all." : "Expanded all.",
      ),
    }),
    ExpandedToLevel: ({ level }) => ({
      model: refold(
        model,
        foldScope(model, (items) => expandToLevel(items, level)),
        `Showing ${plural(level, "level")}.`,
      ),
    }),
    ClickedUndo: () => travel(model, "Undo", model.focus),
    ClickedRedo: () => travel(model, "Redo", model.focus),
    Load: ({ items }) => ({
      model: {
        ...model,
        items,
        scopeId: null,
        mode: "Text",
        focus: null,
        selection: null,
        drag: null,
        history: History.init<Snapshot>(),
        revision: model.revision + 1,
        nextId: Math.max(model.nextId, counterFor(model.id, items)),
      },
    }),
    Replace: ({ items, announcement, coalescingKey }) => {
      if (items === model.items) return { model };
      const committed = commit(model, items, {
        announcement,
        ...(coalescingKey === undefined ? {} : { coalescingKey }),
      });
      const exists = (id: string) => find(items, id) !== undefined;
      const selection = model.selection;
      return {
        model: {
          ...committed,
          scopeId: model.scopeId !== null && exists(model.scopeId) ? model.scopeId : null,
          focus: model.focus !== null && exists(model.focus.id) ? model.focus : null,
          ...(selection !== null && !(exists(selection.anchorId) && exists(selection.headId))
            ? { mode: "Text" as const, selection: null }
            : {}),
          nextId: Math.max(model.nextId, counterFor(model.id, items)),
        },
      };
    },
    Reveal: ({ id }) => {
      const node = find(model.items, id);
      if (node === undefined) return { model };
      const items = ancestors(model.items, id).reduce(
        (nodes, ancestor) => setCollapsed(nodes, ancestor, false),
        model.items,
      );
      const scopeId =
        isWithin(items, id, model.scopeId) && id !== model.scopeId ? model.scopeId : null;
      return editText(
        {
          ...model,
          scopeId,
          revision: items === model.items ? model.revision : model.revision + 1,
        },
        textFocus(id, node.text.length),
        items,
      );
    },
    CompletedFocus: () => ({ model }),
  });
