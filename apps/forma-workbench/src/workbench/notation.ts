// Notation is a dial. In Outline notation rows have bullets. In Brackets
// notation a list row's bullet becomes `(` and its `)` is painted after the
// last row the list contains, so the outline reads as Forma source. The
// brackets are painted, not typed, so they can never be unbalanced.

import { ancestors, walk, type Item, type Items, type RowDecoration } from "@foldworks/outliner";
import { identifySyntax } from "@formalang/ts/syntax";

export type Notation = "Outline" | "Brackets";

const isComment = (text: string): boolean => text.trimStart().startsWith(";");

const elementCount = (text: string): number =>
  identifySyntax(text).nodes.filter((node) => node.parent === null && node.kind !== "Comment")
    .length;

/** Whether a row prints as a list: it has children or more than one element. */
const isListRow = (node: Item): boolean =>
  !isComment(node.text) && (node.children.length > 0 || elementCount(node.text) >= 2);

/** The visible row on which a list closes: its last descendant, stopping at a fold. */
const closingRow = (node: Item): Item =>
  node.collapsed || node.children.length === 0 ? node : closingRow(node.children.at(-1)!);

export type BracketOptions = Readonly<{
  /** The hoisted item, whose own brackets are off screen. */
  scopeId: string | null;
  /** The row with the caret, whose closing bracket is highlighted. */
  focusId: string | null;
}>;

/** Markers and closing brackets for every row in Brackets notation. */
export const brackets = (
  items: Items,
  options: BracketOptions,
): ReadonlyMap<string, Pick<RowDecoration, "marker" | "suffix">> => {
  const offscreen = new Set(
    options.scopeId === null ? [] : [options.scopeId, ...ancestors(items, options.scopeId)],
  );
  const closers = new Map<string, string[]>();
  const markers = new Map<string, string>();
  const visit = (nodes: Items, commented: boolean) => {
    for (const node of nodes) {
      const quiet = commented || isComment(node.text);
      const list = !quiet && isListRow(node);
      markers.set(node.id, list ? "(" : "");
      if (list && !offscreen.has(node.id)) {
        const at = closingRow(node).id;
        // Outer lists are visited first and close last.
        closers.set(at, [node.id, ...(closers.get(at) ?? [])]);
      }
      visit(node.children, quiet);
    }
  };
  visit(items, false);
  const result = new Map<string, Pick<RowDecoration, "marker" | "suffix">>();
  for (const node of walk(items)) {
    const owners = closers.get(node.id) ?? [];
    const folded = node.collapsed && node.children.length > 0 && owners.includes(node.id);
    result.set(node.id, {
      marker: markers.get(node.id) ?? "",
      suffix: [
        ...(folded ? [{ text: " …", kind: "fold" }] : []),
        ...owners.map((owner) => ({
          text: ")",
          kind: owner === options.focusId ? "paren-match" : "paren",
        })),
      ],
    });
  }
  return result;
};
