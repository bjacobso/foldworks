// Where each outline row's text sits in the program's source.
//
// A row's text is the leading elements of its list, written without the
// list's parentheses (see docs/language-services.md, "Outline codec rules").
// Reading the text on its own gives the same nodes, in the same order, as
// the row's elements in the source, so the two are paired node by node.
// Every fact the language services report for a source node or span can
// then be shown at its place in the row, and an offset in the row can ask
// about the source node under it.

import {
  identifySyntax,
  indexSyntax,
  type OutlineItem,
  type SyntaxIdentity,
  type SyntaxIndex,
  type SyntaxNode,
} from "@formalang/ts/syntax";

/** A node of the source shown in a row, with its range in the row's text. */
export interface RowNode {
  readonly nodeId: string;
  readonly kind: SyntaxNode["kind"];
  readonly from: number;
  readonly to: number;
  /** The node's span in the source. */
  readonly start: number;
  readonly end: number;
}

export interface RowLayout {
  readonly id: string;
  /** The row's text this layout describes. Facts apply only while the row still reads this way. */
  readonly text: string;
  readonly parentId: string | null;
  /** The span of the row's whole form in the source, children included. */
  readonly start: number;
  readonly end: number;
  /** The source nodes written in the row's text, in document order. */
  readonly nodes: readonly RowNode[];
}

export type RowLayouts = ReadonlyMap<string, RowLayout>;

const PREFIX_MARKER = /^(~@|`|'|~)(?:\s+|$)/;

const isComment = (text: string): boolean => text.trimStart().startsWith(";");

/** The elements of a list or of the list a reader macro quotes. */
const elementsOf = (index: SyntaxIndex, node: SyntaxNode): readonly SyntaxNode[] => {
  if (node.kind === "List") return index.children(node.id);
  if (node.kind === "ReaderMacro") {
    const [inner] = index.children(node.id);
    return inner?.kind === "List" ? index.children(inner.id) : [];
  }
  return [];
};

/** Pairs the nodes of a row's text with source nodes, while their shapes agree. */
const pair = (
  local: SyntaxIndex,
  localRoots: readonly SyntaxNode[],
  source: SyntaxIndex,
  sourceRoots: readonly SyntaxNode[],
  shift: number,
): RowNode[] => {
  const nodes: RowNode[] = [];
  localRoots.forEach((root, position) => {
    const counterpart = sourceRoots[position];
    if (counterpart === undefined) return;
    const mine = local.subtree(root.id);
    const theirs = source.subtree(counterpart.id);
    if (mine.length !== theirs.length || mine.some((node, at) => node.kind !== theirs[at]!.kind)) {
      return;
    }
    mine.forEach((node, at) => {
      const other = theirs[at]!;
      nodes.push({
        nodeId: other.id,
        kind: other.kind,
        from: node.span.start + shift,
        to: node.span.end + shift,
        start: other.span.start,
        end: other.span.end,
      });
    });
  });
  return nodes;
};

const layoutOf = (
  item: OutlineItem,
  parentId: string | null,
  source: SyntaxIndex,
): RowLayout | undefined => {
  const node = source.node(item.id);
  if (node === undefined) return undefined;
  const base = {
    id: item.id,
    text: item.text,
    parentId,
    start: node.span.start,
    end: node.span.end,
  };
  const text = item.text;
  if (isComment(text)) {
    const offset = text.length - text.trimStart().length;
    return {
      ...base,
      nodes: [
        {
          nodeId: node.id,
          kind: node.kind,
          from: offset,
          to: offset + text.trim().length,
          start: node.span.start,
          end: node.span.end,
        },
      ],
    };
  }
  const marker = item.children.length > 0 ? PREFIX_MARKER.exec(text) : null;
  const shift = marker?.[0].length ?? 0;
  const header = text.slice(shift);
  const local = indexSyntax(identifySyntax(header));
  const roots = local.children(null);
  const code = roots.filter((root) => root.kind !== "Comment");
  if (item.children.length > 0 || code.length >= 2) {
    // The text holds the list's leading elements.
    const elements = elementsOf(source, node);
    return { ...base, nodes: pair(local, roots, source, elements, shift) };
  }
  // A single element is the row's node itself.
  const [only] = code;
  return { ...base, nodes: only === undefined ? [] : pair(local, [only], source, [node], shift) };
};

/** Where every row's text sits in a source read or printed with these row ids. */
export const rowLayouts = (items: readonly OutlineItem[], identity: SyntaxIdentity): RowLayouts => {
  const source = indexSyntax(identity);
  const layouts = new Map<string, RowLayout>();
  const visit = (rows: readonly OutlineItem[], parentId: string | null) => {
    for (const item of rows) {
      const layout = layoutOf(item, parentId, source);
      if (layout !== undefined) layouts.set(item.id, layout);
      visit(item.children, item.id);
    }
  };
  visit(items, null);
  return layouts;
};

/** The innermost node of a row's text that contains an offset. Lenient also accepts its end. */
export const nodeAt = (layout: RowLayout, offset: number, lenient = false): RowNode | undefined => {
  let found: RowNode | undefined;
  for (const node of layout.nodes) {
    const inside = node.from <= offset && (offset < node.to || (lenient && offset === node.to));
    if (inside && (found === undefined || node.to - node.from <= found.to - found.from))
      found = node;
  }
  return found;
};

/** The innermost row whose form contains a source span. */
export const rowContaining = (
  layouts: RowLayouts,
  start: number,
  end: number,
): RowLayout | undefined => {
  let found: RowLayout | undefined;
  for (const layout of layouts.values()) {
    const contains = layout.start <= start && end <= Math.max(layout.end, start + 1);
    if (contains && (found === undefined || layout.end - layout.start <= found.end - found.start)) {
      found = layout;
    }
  }
  return found;
};

/**
 * A source span as a range of a row's text. A span inside one of the row's
 * nodes keeps its place in that node; a span the row's text does not show,
 * such as the whole form of a row with children, covers the whole text.
 */
export const rangeInRow = (
  layout: RowLayout,
  start: number,
  end: number,
): { readonly from: number; readonly to: number } => {
  const whole = { from: 0, to: layout.text.length };
  let host: RowNode | undefined;
  for (const node of layout.nodes) {
    if (node.start <= start && end <= node.end) {
      if (host === undefined || node.end - node.start <= host.end - host.start) host = node;
    }
  }
  if (host === undefined) {
    // A span across several of the row's elements runs from the first to the last.
    const covered = layout.nodes.filter((node) => start <= node.start && node.end <= end);
    if (covered.length === 0) return whole;
    return {
      from: Math.min(...covered.map((node) => node.from)),
      to: Math.max(...covered.map((node) => node.to)),
    };
  }
  if (host.start === start && host.end === end) return { from: host.from, to: host.to };
  // Inside a token, the text is the same, so offsets carry over; elsewhere, clamp to the node.
  const leaf =
    host.kind !== "List" && host.kind !== "Vector" && host.kind !== "Map" && host.kind !== "Set";
  const from = leaf ? host.from + (start - host.start) : host.from;
  const to = leaf ? host.from + (end - host.start) : host.to;
  return { from: Math.max(host.from, from), to: Math.min(host.to, Math.max(to, from)) };
};
