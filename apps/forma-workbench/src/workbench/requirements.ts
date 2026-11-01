import type { SyntaxIdentity } from "@formalang/ts/syntax";
import type { Definition, SymbolFact } from "./analysis.js";

/** Propagate capabilities through form children and resolved definitions, including recursive calls. */
export const requirementsFor = (
  identity: SyntaxIdentity,
  symbols: Readonly<Record<string, SymbolFact>>,
  definitions: ReadonlyArray<Definition>,
): Readonly<Record<string, ReadonlyArray<string>>> => {
  const sets = new Map(identity.nodes.map((node) => [node.id, new Set<string>()]));
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const add = (to: Set<string>, from: ReadonlySet<string>) => {
    const before = to.size;
    for (const name of from) to.add(name);
    return to.size !== before;
  };
  for (const [id, symbol] of Object.entries(symbols))
    if (symbol.kind === "capability") sets.get(id)?.add(symbol.name);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of [...identity.nodes].reverse()) {
      const own = sets.get(node.id)!;
      const fact = symbols[node.id];
      const definition = fact?.definition === undefined ? undefined : byKey.get(fact.definition);
      const inherited =
        definition?.formNodeId == null ? undefined : sets.get(definition.formNodeId);
      if (inherited !== undefined) changed = add(own, inherited) || changed;
      const parent = node.parent === null ? undefined : sets.get(node.parent);
      if (parent !== undefined) changed = add(parent, own) || changed;
    }
  }
  return Object.fromEntries(
    [...sets].filter(([, names]) => names.size > 0).map(([id, names]) => [id, [...names].sort()]),
  );
};
