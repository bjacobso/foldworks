import { Schema as S } from "effect";

export const Mark = S.Struct({
  type: S.Literals(["bold", "italic", "strike", "code", "link"]),
  value: S.String,
});
export type Mark = typeof Mark.Type;
export const Run = S.Struct({ text: S.String, marks: S.Array(Mark) });
export type Run = typeof Run.Type;
export interface Block {
  readonly id: string;
  readonly type: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly content: ReadonlyArray<Run>;
  readonly children: ReadonlyArray<Block>;
}
export const Block: S.Codec<Block> = S.suspend(() =>
  S.Struct({
    id: S.String,
    type: S.String,
    attrs: S.Record(S.String, S.String),
    content: S.Array(Run),
    children: S.Array(Block),
  }),
);
export const Document = S.Struct({
  version: S.Literal(1),
  blocks: S.Array(Block),
});
export type Document = typeof Document.Type;
export const Point = S.Struct({ id: S.String, offset: S.Number });
export type Point = typeof Point.Type;
export const Selection = S.Struct({ anchor: Point, focus: Point });
export type Selection = typeof Selection.Type;

export const text = (value: string, marks: ReadonlyArray<Mark> = []): Run => ({
  text: value,
  marks,
});
export const block = (
  id: string,
  type = "paragraph",
  content: ReadonlyArray<Run> = [],
  attrs: Readonly<Record<string, string>> = {},
  children: ReadonlyArray<Block> = [],
): Block => ({ id, type, content, attrs, children });
export const plainText = (node: Block): string =>
  node.content.map((run) => run.text).join("");
export const caret = (id: string, offset = 0): Selection => ({
  anchor: { id, offset },
  focus: { id, offset },
});
export const samePoint = (a: Point, b: Point): boolean =>
  a.id === b.id && a.offset === b.offset;
export const collapsed = (selection: Selection): boolean =>
  samePoint(selection.anchor, selection.focus);
export const walk = (nodes: ReadonlyArray<Block>): ReadonlyArray<Block> =>
  nodes.flatMap((node) => [node, ...walk(node.children)]);
export const leaves = (document: Document): ReadonlyArray<Block> =>
  walk(document.blocks).filter((node) => node.children.length === 0);
export const find = (document: Document, id: string): Block | undefined =>
  walk(document.blocks).find((node) => node.id === id);
export const mapBlocks = (
  nodes: ReadonlyArray<Block>,
  f: (node: Block) => ReadonlyArray<Block>,
): ReadonlyArray<Block> => {
  const mapped = nodes.flatMap((node) => {
    const children = mapBlocks(node.children, f);
    return f(children === node.children ? node : { ...node, children });
  });
  return mapped.length === nodes.length &&
    mapped.every((node, index) => node === nodes[index])
    ? nodes
    : mapped;
};
export const updateBlock = (
  document: Document,
  id: string,
  f: (node: Block) => Block,
): Document => ({
  ...document,
  blocks: mapBlocks(document.blocks, (node) => [
    node.id === id ? f(node) : node,
  ]),
});
export const marksEqual = (
  a: ReadonlyArray<Mark>,
  b: ReadonlyArray<Mark>,
): boolean => JSON.stringify(a) === JSON.stringify(b);
export const normalizeRuns = (runs: ReadonlyArray<Run>): ReadonlyArray<Run> => {
  const result: Run[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const marks = [
      ...new Map(run.marks.map((mark) => [mark.type, mark])).values(),
    ].sort((a, b) => a.type.localeCompare(b.type));
    const previous = result.at(-1);
    if (previous && marksEqual(previous.marks, marks))
      result[result.length - 1] = {
        ...previous,
        text: previous.text + run.text,
      };
    else result.push({ text: run.text, marks });
  }
  return result;
};
export const sliceRuns = (
  runs: ReadonlyArray<Run>,
  from: number,
  to = Infinity,
): ReadonlyArray<Run> => {
  let position = 0;
  return normalizeRuns(
    runs.flatMap((run) => {
      const start = position;
      position += run.text.length;
      const value = run.text.slice(
        Math.max(0, from - start),
        Math.max(0, Math.min(run.text.length, to - start)),
      );
      return value ? [{ ...run, text: value }] : [];
    }),
  );
};
export const orderedRange = (
  document: Document,
  selection: Selection,
): readonly [Point, Point] => {
  const nodes = leaves(document);
  const a = nodes.findIndex((node) => node.id === selection.anchor.id);
  const b = nodes.findIndex((node) => node.id === selection.focus.id);
  return a < b || (a === b && selection.anchor.offset <= selection.focus.offset)
    ? [selection.anchor, selection.focus]
    : [selection.focus, selection.anchor];
};
export const clampSelection = (
  document: Document,
  selection: Selection,
): Selection => {
  const nodes = leaves(document);
  const fallback = nodes[0]!;
  const clamp = (point: Point): Point => {
    const node = nodes.find((node) => node.id === point.id) ?? fallback;
    return {
      id: node.id,
      offset: Math.max(
        0,
        Math.min(plainText(node).length, Math.floor(point.offset)),
      ),
    };
  };
  return { anchor: clamp(selection.anchor), focus: clamp(selection.focus) };
};
export const safeUrl = (value: string): boolean =>
  /^(https?:\/\/|mailto:|\/[^/]|#)/i.test(value) &&
  !/[\u0000-\u0020]/.test(value);

export type BlockDefinition = Readonly<{
  name: string;
  label: string;
  kind: "text" | "container" | "atom";
  defaults?: Readonly<Record<string, string>>;
  validate?: (attrs: Readonly<Record<string, string>>) => boolean;
  /** Foldkit chrome is rendered outside the editor-managed editable content slot. */
  view?: (
    node: Block,
    h: import("foldkit/html").HtmlBuilder<import("./model").Message>,
  ) => import("foldkit/html").Html;
  portable?: (node: Block) => string;
}>;
export type Registry = ReadonlyMap<string, BlockDefinition>;
export const builtinBlocks: ReadonlyArray<BlockDefinition> = [
  { name: "paragraph", label: "Text", kind: "text" },
  {
    name: "heading",
    label: "Heading",
    kind: "text",
    defaults: { level: "2" },
    validate: (attrs) => /^[1-6]$/.test(attrs.level ?? ""),
  },
  { name: "codeBlock", label: "Code", kind: "text" },
  { name: "blockquote", label: "Quote", kind: "container" },
  { name: "bulletList", label: "Bullet list", kind: "container" },
  { name: "orderedList", label: "Numbered list", kind: "container" },
  { name: "taskList", label: "Task list", kind: "container" },
  { name: "listItem", label: "List item", kind: "container" },
  {
    name: "callout",
    label: "Callout",
    kind: "container",
    defaults: { tone: "info" },
    validate: (attrs) =>
      ["info", "warning", "success"].includes(attrs.tone ?? ""),
    view: (node, h) =>
      h.select(
        [
          h.AriaLabel("Callout tone"),
          h.Value(node.attrs.tone ?? "info"),
          h.OnChange((value) => ({
            _tag: "Attributes",
            id: node.id,
            key: "tone",
            value,
          })),
        ],
        ["info", "warning", "success"].map((value) =>
          h.option(
            [h.Value(value)],
            [value[0]!.toUpperCase() + value.slice(1)],
          ),
        ),
      ),
  },
  { name: "rule", label: "Divider", kind: "atom" },
];
export const createRegistry = (
  custom: ReadonlyArray<BlockDefinition> = [],
): Registry => {
  const registry = new Map<string, BlockDefinition>();
  for (const definition of [...builtinBlocks, ...custom]) {
    if (
      registry.has(definition.name) ||
      !/^[a-zA-Z][a-zA-Z0-9]*$/.test(definition.name)
    )
      throw new Error(`Invalid or duplicate block: ${definition.name}`);
    registry.set(definition.name, definition);
  }
  return registry;
};
export const validateDocument = (
  document: Document,
  registry: Registry,
): string | undefined => {
  let count = 0;
  const ids = new Set<string>();
  if (document.version !== 1 || !document.blocks.length)
    return "A document must contain at least one block.";
  const visit = (
    nodes: ReadonlyArray<Block>,
    parent: string,
    depth: number,
  ): string | undefined => {
    if (depth > 20) return "Document nesting exceeds 20 levels.";
    for (const node of nodes) {
      if (
        ++count > 10000 ||
        node.content.reduce((n, run) => n + run.text.length, 0) > 1000000
      )
        return "Document exceeds editor limits.";
      if (!node.id || ids.has(node.id))
        return "Block IDs must be unique and nonempty.";
      ids.add(node.id);
      const definition = registry.get(node.type);
      if (!definition)
        return `Unsupported block: ${node.type}. Original content retained.`;
      if (definition.validate && !definition.validate(node.attrs))
        return `Invalid attributes for ${node.type}.`;
      if (
        definition.kind === "container"
          ? node.content.length > 0 || !node.children.length
          : node.children.length > 0
      )
        return `Invalid content in ${node.type}.`;
      if (definition.kind === "atom" && node.content.length)
        return "Atoms cannot contain editable text.";
      if (
        node.type === "codeBlock" &&
        node.content.some((run) => run.marks.length > 0)
      )
        return "Code blocks contain plain text without inline marks.";
      if (
        ["bulletList", "orderedList", "taskList"].includes(node.type) &&
        node.children.some((child) => child.type !== "listItem")
      )
        return "Lists must contain list items.";
      if (
        node.type === "listItem" &&
        !["bulletList", "orderedList", "taskList"].includes(parent)
      )
        return "List items must belong to a list.";
      for (const run of node.content)
        for (const mark of run.marks) {
          if (mark.type === "link" && !safeUrl(mark.value))
            return "Unsupported link protocol.";
        }
      const error = visit(node.children, node.type, depth + 1);
      if (error) return error;
    }
  };
  return visit(document.blocks, "doc", 0);
};
