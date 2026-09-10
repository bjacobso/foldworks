import {
  block,
  caret,
  collapsed,
  find,
  leaves,
  mapBlocks,
  normalizeRuns,
  orderedRange,
  plainText,
  sliceRuns,
  text,
  updateBlock,
  type Block,
  type Document,
  type Mark,
  type Registry,
  type Selection,
} from "./document";

export type Edit = Readonly<{ document: Document; selection: Selection }>;
export type Allocate = () => string;
export const allocator = (document: Document, prefix: string): Allocate => {
  let counter = 0;
  return () => {
    let id: string;
    do {
      id = `${prefix}-${++counter}`;
    } while (find(document, id));
    return id;
  };
};
const prune = (
  nodes: ReadonlyArray<Block>,
  registry: Registry,
): ReadonlyArray<Block> =>
  mapBlocks(nodes, (node) => {
    return registry.get(node.type)?.kind === "container" &&
      !node.children.length
      ? []
      : [node];
  });
export const ensureDocument = (
  document: Document,
  registry: Registry,
  allocate: Allocate,
): Document => {
  const blocks = prune(document.blocks, registry);
  const hasCaret = leaves({ version: 1, blocks }).some(
    (node) => registry.get(node.type)?.kind === "text",
  );
  return {
    version: 1,
    blocks: hasCaret ? blocks : [...blocks, block(allocate())],
  };
};
export const replaceRange = (
  document: Document,
  selection: Selection,
  value: string,
  marks: ReadonlyArray<Mark>,
  registry: Registry,
  allocate: Allocate,
): Edit => {
  const [start, end] = orderedRange(document, selection);
  const nodes = leaves(document);
  const first = nodes.findIndex((node) => node.id === start.id);
  const last = nodes.findIndex((node) => node.id === end.id);
  const startNode = nodes[first];
  const endNode = nodes[last];
  if (
    !startNode ||
    !endNode ||
    registry.get(startNode.type)?.kind !== "text" ||
    registry.get(endNode.type)?.kind !== "text"
  )
    return { document, selection };
  const remove = new Set(
    nodes.slice(first + 1, last + 1).map((node) => node.id),
  );
  const content = normalizeRuns([
    ...sliceRuns(startNode.content, 0, start.offset),
    text(value, marks),
    ...sliceRuns(endNode.content, end.offset),
  ]);
  const next = ensureDocument(
    {
      version: 1,
      blocks: mapBlocks(document.blocks, (node) =>
        remove.has(node.id)
          ? []
          : [node.id === start.id ? { ...node, content } : node],
      ),
    },
    registry,
    allocate,
  );
  return {
    document: next,
    selection: caret(start.id, start.offset + value.length),
  };
};
export const split = (
  document: Document,
  selection: Selection,
  registry: Registry,
  allocate: Allocate,
): Edit => {
  const removed = collapsed(selection)
    ? { document, selection }
    : replaceRange(document, selection, "", [], registry, allocate);
  const point = removed.selection.anchor;
  const node = find(removed.document, point.id);
  if (!node || registry.get(node.type)?.kind !== "text") return removed;
  if (node.type === "codeBlock")
    return replaceRange(
      removed.document,
      removed.selection,
      "\n",
      [],
      registry,
      allocate,
    );
  const id = allocate();
  const next = block(id, "paragraph", sliceRuns(node.content, point.offset));
  const before = { ...node, content: sliceRuns(node.content, 0, point.offset) };
  // A list item's first paragraph splits the item, retaining its nested content.
  let handled = false;
  const listSplit = (nodes: ReadonlyArray<Block>): ReadonlyArray<Block> =>
    nodes.flatMap((parent) => {
      if (["bulletList", "orderedList", "taskList"].includes(parent.type)) {
        const index = parent.children.findIndex(
          (item) => item.children[0]?.id === node.id,
        );
        const item = parent.children[index];
        if (item) {
          handled = true;
          if (!plainText(node) && item.children.length === 1) {
            const left = parent.children.slice(0, index);
            const right = parent.children.slice(index + 1);
            return [
              ...(left.length ? [{ ...parent, children: left }] : []),
              block(id),
              ...(right.length
                ? [{ ...parent, id: allocate(), children: right }]
                : []),
            ];
          }
          return [
            {
              ...parent,
              children: [
                ...parent.children.slice(0, index),
                { ...item, children: [before] },
                block(
                  allocate(),
                  "listItem",
                  [],
                  { ...item.attrs, checked: "false" },
                  [next, ...item.children.slice(1)],
                ),
                ...parent.children.slice(index + 1),
              ],
            },
          ];
        }
      }
      return [{ ...parent, children: listSplit(parent.children) }];
    });
  let blocks = listSplit(removed.document.blocks);
  if (!handled)
    blocks = mapBlocks(blocks, (candidate) =>
      candidate.id === node.id ? [before, next] : [candidate],
    );
  return { document: { version: 1, blocks }, selection: caret(id) };
};
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export const deleteText = (
  document: Document,
  selection: Selection,
  backward: boolean,
  registry: Registry,
  allocate: Allocate,
): Edit => {
  if (!collapsed(selection))
    return replaceRange(document, selection, "", [], registry, allocate);
  const point = selection.anchor;
  const nodes = leaves(document);
  const index = nodes.findIndex((node) => node.id === point.id);
  const node = nodes[index];
  if (!node || registry.get(node.type)?.kind !== "text")
    return { document, selection };
  const value = plainText(node);
  const boundaries = [...segmenter.segment(value)]
    .map((segment) => segment.index)
    .concat(value.length);
  const offset = backward
    ? boundaries.filter((n) => n < point.offset).at(-1)
    : boundaries.find((n) => n > point.offset);
  if (offset !== undefined)
    return replaceRange(
      document,
      { anchor: point, focus: { ...point, offset } },
      "",
      [],
      registry,
      allocate,
    );
  const adjacent = nodes[index + (backward ? -1 : 1)];
  if (adjacent && registry.get(adjacent.type)?.kind === "atom")
    return {
      document: ensureDocument(
        {
          version: 1,
          blocks: mapBlocks(document.blocks, (node) =>
            node.id === adjacent.id ? [] : [node],
          ),
        },
        registry,
        allocate,
      ),
      selection,
    };
  if (!adjacent || registry.get(adjacent.type)?.kind !== "text")
    return { document, selection };
  return replaceRange(
    document,
    {
      anchor: point,
      focus: {
        id: adjacent.id,
        offset: backward ? plainText(adjacent).length : 0,
      },
    },
    "",
    [],
    registry,
    allocate,
  );
};
export const toggleMark = (
  document: Document,
  selection: Selection,
  mark: Mark,
): Document => {
  const [start, end] = orderedRange(document, selection);
  const nodes = leaves(document);
  const selected = nodes.slice(
    nodes.findIndex((n) => n.id === start.id),
    nodes.findIndex((n) => n.id === end.id) + 1,
  );
  const ranges = selected.map((node) => ({
    node,
    from: node.id === start.id ? start.offset : 0,
    to: node.id === end.id ? end.offset : plainText(node).length,
  }));
  const runs = ranges.flatMap(({ node, from, to }) =>
    sliceRuns(node.content, from, to),
  );
  const remove =
    runs.length > 0 &&
    runs.every((run) =>
      run.marks.some((m) => m.type === mark.type && m.value === mark.value),
    );
  let result = document;
  for (const { node, from, to } of ranges) {
    if (node.type === "codeBlock") continue;
    result = updateBlock(result, node.id, (n) => ({
      ...n,
      content: normalizeRuns([
        ...sliceRuns(n.content, 0, from),
        ...sliceRuns(n.content, from, to).map((run) => ({
          ...run,
          marks: [
            ...run.marks.filter((m) => m.type !== mark.type),
            ...(remove ? [] : [mark]),
          ],
        })),
        ...sliceRuns(n.content, to),
      ]),
    }));
  }
  return result;
};
export const topBlock = (document: Document, id: string): Block | undefined =>
  document.blocks.find(
    (node) => node.id === id || find({ version: 1, blocks: node.children }, id),
  );
export const moveBlock = (
  document: Document,
  id: string,
  target: string,
  before: boolean,
): Document => {
  const source = document.blocks.find((node) => node.id === id);
  if (
    !source ||
    id === target ||
    !document.blocks.some((node) => node.id === target)
  )
    return document;
  const blocks = document.blocks.filter((node) => node.id !== id);
  const index =
    blocks.findIndex((node) => node.id === target) + (before ? 0 : 1);
  return {
    version: 1,
    blocks: [...blocks.slice(0, index), source, ...blocks.slice(index)],
  };
};
export const createBlock = (
  type: string,
  registry: Registry,
  allocate: Allocate,
): Block => {
  const definition = registry.get(type);
  if (!definition) throw new Error(`Unknown block ${type}`);
  if (["bulletList", "orderedList", "taskList"].includes(type))
    return block(allocate(), type, [], {}, [
      block(allocate(), "listItem", [], { checked: "false" }, [
        block(allocate()),
      ]),
    ]);
  return block(
    allocate(),
    type,
    [],
    definition.defaults ?? {},
    definition.kind === "container" ? [block(allocate())] : [],
  );
};
/** Indent/outdent the list item containing the caret, retaining nested lists. */
export const indentList = (
  document: Document,
  selection: Selection,
  outdent: boolean,
  allocate: Allocate,
): Edit => {
  const lists = new Set(["bulletList", "orderedList", "taskList"]);
  const contains = (node: Block): boolean =>
    node.id === selection.anchor.id ||
    Boolean(find({ version: 1, blocks: node.children }, selection.anchor.id));
  let changed = false;
  const visit = (nodes: ReadonlyArray<Block>): ReadonlyArray<Block> =>
    nodes.flatMap((list) => {
      if (!lists.has(list.type))
        return [{ ...list, children: visit(list.children) }];
      // Outdent from a nested list into the containing list immediately after its parent item.
      if (outdent) {
        for (const [parentIndex, parent] of list.children.entries())
          for (const [nestedIndex, nested] of parent.children.entries()) {
            if (!lists.has(nested.type)) continue;
            const itemIndex = nested.children.findIndex((item) =>
              contains(item),
            );
            const item = nested.children[itemIndex];
            if (!item) continue;
            const deeper = item.children.some(
              (child) => lists.has(child.type) && contains(child),
            );
            if (deeper) continue;
            const before = nested.children.slice(0, itemIndex);
            const after = nested.children.slice(itemIndex + 1);
            const parentChildren = [
              ...parent.children.slice(0, nestedIndex),
              ...(before.length ? [{ ...nested, children: before }] : []),
              ...parent.children.slice(nestedIndex + 1),
            ];
            const lifted = {
              ...item,
              children: [
                ...item.children,
                ...(after.length
                  ? [{ ...nested, id: allocate(), children: after }]
                  : []),
              ],
            };
            changed = true;
            return [
              {
                ...list,
                children: [
                  ...list.children.slice(0, parentIndex),
                  { ...parent, children: parentChildren },
                  lifted,
                  ...list.children.slice(parentIndex + 1),
                ],
              },
            ];
          }
      }
      const itemIndex = list.children.findIndex((item) =>
        item.children.some((child) => child.id === selection.anchor.id),
      );
      const item = list.children[itemIndex];
      if (item && !changed) {
        if (outdent) {
          changed = true;
          return [
            ...(itemIndex
              ? [{ ...list, children: list.children.slice(0, itemIndex) }]
              : []),
            ...item.children,
            ...(itemIndex + 1 < list.children.length
              ? [
                  {
                    ...list,
                    id: allocate(),
                    children: list.children.slice(itemIndex + 1),
                  },
                ]
              : []),
          ];
        }
        const previous = list.children[itemIndex - 1];
        if (previous) {
          const nested = previous.children.at(-1);
          const children =
            nested?.type === list.type
              ? [
                  ...previous.children.slice(0, -1),
                  { ...nested, children: [...nested.children, item] },
                ]
              : [
                  ...previous.children,
                  block(allocate(), list.type, [], list.attrs, [item]),
                ];
          changed = true;
          return [
            {
              ...list,
              children: [
                ...list.children.slice(0, itemIndex - 1),
                { ...previous, children },
                ...list.children.slice(itemIndex + 1),
              ],
            },
          ];
        }
      }
      return [{ ...list, children: visit(list.children) }];
    });
  return {
    document: { version: 1, blocks: visit(document.blocks) },
    selection,
  };
};
export const convert = (
  document: Document,
  selection: Selection,
  type: string,
  registry: Registry,
  allocate: Allocate,
): Edit => {
  const node = find(document, selection.anchor.id);
  const definition = registry.get(type);
  if (!node || !definition) return { document, selection };
  if (definition.kind === "text")
    return {
      document: updateBlock(document, node.id, (n) => ({
        ...n,
        type,
        attrs: definition.defaults ?? {},
        content: type === "codeBlock" ? [text(plainText(n))] : n.content,
        children: [],
      })),
      selection,
    };
  const replacement = createBlock(type, registry, allocate);
  if (definition.kind === "container") {
    const nodes = leaves({ version: 1, blocks: [replacement] });
    const first = nodes[0]!;
    const filled = updateBlock(
      { version: 1, blocks: [replacement] },
      first.id,
      (n) => ({ ...n, content: node.content }),
    ).blocks[0]!;
    return {
      document: {
        version: 1,
        blocks: mapBlocks(document.blocks, (n) =>
          n.id === node.id ? [filled] : [n],
        ),
      },
      selection: caret(first.id, selection.anchor.offset),
    };
  }
  // Atom insertion is non-destructive; converting text to an atom would lose text.
  const top = topBlock(document, node.id)!;
  const index = document.blocks.indexOf(top) + 1;
  const paragraph = block(allocate());
  return {
    document: {
      version: 1,
      blocks: [
        ...document.blocks.slice(0, index),
        replacement,
        paragraph,
        ...document.blocks.slice(index),
      ],
    },
    selection: caret(paragraph.id),
  };
};
