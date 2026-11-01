import { Effect } from "effect";
import { indexSyntax } from "@formalang/ts/syntax";
import type { OutlineItem, SyntaxIdentity } from "@formalang/host/types";
import { FormaHost, call, required } from "./host.js";

/** Keep existing rows visible when an edit script creates a compact enclosing form. */
export const preserveEditRows = (
  source: string,
  identity: SyntaxIdentity,
  rows: ReadonlyArray<OutlineItem>,
  previousIds: ReadonlySet<string>,
) =>
  Effect.gen(function* () {
    const { host, config } = yield* FormaHost;
    const read = yield* required(host, "sourceToOutline");
    const index = indexSyntax(identity);
    const visible = new Map<string, OutlineItem>();
    const collect = (items: ReadonlyArray<OutlineItem>) => {
      for (const row of items) {
        visible.set(row.id, row);
        collect(row.children);
      }
    };
    collect(rows);
    const forced = new Set<string>();
    for (const id of previousIds) {
      if (visible.has(id) || index.node(id) === undefined) continue;
      forced.add(id);
      for (const ancestor of index.ancestors(id)) {
        if (visible.has(ancestor.id)) break;
        forced.add(ancestor.id);
      }
    }
    if (forced.size === 0) return rows;

    const build = (id: string): Effect.Effect<OutlineItem, string> =>
      Effect.gen(function* () {
        const node = index.node(id)!;
        let row = visible.get(id);
        if (row === undefined) {
          const subtree = index.subtree(id).map((child) => ({
            ...child,
            span: {
              start: child.span.start - node.span.start,
              end: child.span.end - node.span.start,
            },
            parent: child.id === id ? null : child.parent,
          }));
          const fragment = yield* call(() =>
            read({
              sourceId: config.sourceId,
              source: source.slice(node.span.start, node.span.end),
              identity: { ...identity, nodes: subtree, errors: [] },
            }),
          );
          row = fragment.items[0];
        }
        if (row === undefined)
          return yield* Effect.fail(`Cannot project edited node ${id} as a row.`);
        if (node.kind !== "List")
          return {
            ...row,
            children: yield* Effect.forEach(row.children, (child) => build(child.id)),
          };
        const elements = index.children(id);
        const children = new Set(row.children.map((child) => child.id));
        const cut = elements.findIndex((child) => forced.has(child.id) || children.has(child.id));
        if (cut < 0) return row;
        return {
          id,
          text: elements
            .slice(0, cut)
            .map((child) => source.slice(child.span.start, child.span.end))
            .join(" "),
          children: yield* Effect.forEach(elements.slice(cut), (child) => build(child.id)),
        };
      });
    return yield* Effect.forEach(rows, (row) => build(row.id));
  });
