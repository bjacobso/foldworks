import { item, type Item, type Items } from "./outline";

const BULLET = /^(?:[-*+•◦▪‣]|\d+[.)])\s+/;
const CHECKBOX = /^\[([ xX])\]\s+/;

/** Leading whitespace measured in columns, with tabs at four columns. */
const indentation = (line: string): number => {
  let columns = 0;
  for (const character of line) {
    if (character === " ") columns += 1;
    else if (character === "\t") columns += 4 - (columns % 4);
    else break;
  }
  return columns;
};

/**
 * Parses indented text into an outline fragment. Tabs, any consistent space
 * indentation, Markdown bullets, numbered lists, and `[ ]`/`[x]` task markers
 * are understood. Blank lines are skipped.
 */
export const parseOutline = (text: string, nextId: () => string): Items => {
  type Draft = { text: string; checked: boolean; children: Draft[] };
  const top: Draft[] = [];
  const stack: Array<Readonly<{ columns: number; children: Draft[] }>> = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (raw.trim() === "") continue;
    const columns = indentation(raw);
    let content = raw.trim().replace(BULLET, "");
    const task = CHECKBOX.exec(content);
    if (task !== null) content = content.slice(task[0].length);
    while (stack.length > 0 && stack[stack.length - 1]!.columns >= columns) stack.pop();
    const draft: Draft = { text: content, checked: task?.[1]?.toLowerCase() === "x", children: [] };
    (stack[stack.length - 1]?.children ?? top).push(draft);
    // Children of this line nest one level deeper, however far they are indented.
    stack.push({ columns, children: draft.children });
  }
  const build = (drafts: ReadonlyArray<Draft>): Items =>
    drafts.map((draft) =>
      item(nextId(), draft.text, build(draft.children), { checked: draft.checked }),
    );
  return build(top);
};

export type SerializeOptions = Readonly<{
  /** `"markdown"` writes `- ` bullets and task boxes; `"tabs"` writes tab-indented lines. */
  format?: "markdown" | "tabs";
}>;

/** Writes an outline as indented text, including collapsed descendants. */
export const serializeOutline = (items: Items, options: SerializeOptions = {}): string => {
  const markdown = (options.format ?? "markdown") === "markdown";
  const lines: string[] = [];
  const visit = (nodes: Items, depth: number) =>
    nodes.forEach((node: Item) => {
      const pad = markdown ? "  ".repeat(depth) : "\t".repeat(depth);
      const marker = markdown ? `- ${node.checked ? "[x] " : ""}` : node.checked ? "[x] " : "";
      const [first = "", ...rest] = node.text.split("\n");
      lines.push(`${pad}${marker}${first}`);
      for (const line of rest) lines.push(`${pad}${markdown ? "  " : ""}${line}`);
      visit(node.children, depth + 1);
    });
  visit(items, 0);
  return lines.join("\n");
};
