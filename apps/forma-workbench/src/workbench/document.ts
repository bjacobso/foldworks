// The outline and the source are two writings of one program. The outline
// is what the person edits; the document is the outline printed by Forma's
// outline codec, with the previous document as the base for layout, so rows
// that did not change keep their exact text. Row ids are syntax node ids.

import { Schema as S } from "effect";
import { item, walk, type Item, type Items } from "@foldworks/outliner";
import type { OutlineItem, SyntaxIdentity } from "@formalang/ts/syntax";

const OffsetSpan = S.Struct({ start: S.Number, end: S.Number });

export const SyntaxIdentitySchema = S.Struct({
  version: S.Literal(1),
  idPrefix: S.String,
  nextId: S.Number,
  nodes: S.Array(
    S.Struct({
      id: S.String,
      kind: S.Literals([
        "List",
        "Vector",
        "Map",
        "Set",
        "Symbol",
        "String",
        "Number",
        "Boolean",
        "ReaderMacro",
        "Error",
        "Comment",
      ]),
      span: OffsetSpan,
      parent: S.NullOr(S.String),
      index: S.Number,
    }),
  ),
  errors: S.Array(S.Struct({ message: S.String, span: OffsetSpan })),
});

/** The program as source text, with ids for every node. */
export const Document = S.Struct({
  /** The outliner revision this source was printed from. */
  revision: S.Number,
  source: S.String,
  identity: SyntaxIdentitySchema,
});
export type Document = typeof Document.Type;

/** Outliner items as codec rows. */
export const toRows = (items: Items): ReadonlyArray<OutlineItem> =>
  items.map((node) => ({ id: node.id, text: node.text, children: toRows(node.children) }));

/** Codec rows as outliner items, keeping the folding of rows that already existed. */
export const fromRows = (rows: ReadonlyArray<OutlineItem>, previous: Items = []): Items => {
  const known = new Map(walk(previous).map((node) => [node.id, node]));
  const build = (row: OutlineItem): Item => {
    const children = row.children.map(build);
    const prior = known.get(row.id);
    return item(row.id, row.text, children, {
      collapsed: children.length > 0 && (prior?.collapsed ?? false),
      checked: prior?.checked ?? false,
    });
  };
  return rows.map(build);
};

/** Whether two outlines have the same rows, ids, and texts, ignoring folding. */
export const sameRows = (
  left: ReadonlyArray<OutlineItem>,
  right: ReadonlyArray<OutlineItem>,
): boolean =>
  left.length === right.length &&
  left.every((row, index) => {
    const other = right[index]!;
    return row.id === other.id && row.text === other.text && sameRows(row.children, other.children);
  });

export type { SyntaxIdentity };

/** A codec row, for messages that carry an outline read by the host. */
export const OutlineRow: S.Codec<OutlineItem> = S.Struct({
  id: S.String,
  text: S.String,
  children: S.Array(S.suspend((): S.Codec<OutlineItem> => OutlineRow)),
});
