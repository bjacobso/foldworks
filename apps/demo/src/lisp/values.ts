// The inspector shows a row's value as a tree. Children load when a branch is
// expanded, a page at a time, the way values held in another process would;
// here the host keeps only how many children it has loaded at each path and
// reads them from the live value, so they are never stale.

import type { ValueTree } from "@foldworks/ui";

import { show, type FlowNode, type Value } from "./evaluate";
import { typeOf } from "./hover";

export const PAGE = 20;

type ValueNode = ValueTree.ValueNode;

/** The parts of a value, as key and value pairs. */
const partsOf = (value: Value | FlowNode): ReadonlyArray<readonly [string, Value | FlowNode]> => {
  if (value === null || typeof value !== "object") return [];
  if ("kind" in value) {
    switch (value.kind) {
      case "Step":
        return [];
      case "Branch":
        return [[value.label, value.child]];
      default:
        return value.children.map((child, index) => [String(index), child]);
    }
  }
  switch (value._tag) {
    case "List":
    case "Vector":
      return value.items.map((item, index) => [String(index), item]);
    case "Map":
      return value.entries.map(([key, entry]) => [show(key, 40), entry]);
    case "Step":
      return [
        ["system", value.system],
        [
          "reads",
          { _tag: "Vector", items: value.reads.map((name) => ({ _tag: "Keyword", name })) },
        ],
        [
          "writes",
          { _tag: "Vector", items: value.writes.map((name) => ({ _tag: "Keyword", name })) },
        ],
      ];
    case "Flow":
      return [["flow", value.node]];
    default:
      return [];
  }
};

const describe = (value: Value | FlowNode): Readonly<{ preview: string; kind: string }> => {
  if (value !== null && typeof value === "object" && "kind" in value) {
    return value.kind === "Step"
      ? { preview: value.step.name, kind: "step" }
      : value.kind === "Branch"
        ? { preview: `branch ${JSON.stringify(value.label)}`, kind: "flow" }
        : { preview: `${value.kind.toLowerCase()} of ${value.children.length}`, kind: "flow" };
  }
  return { preview: show(value, 80), kind: typeOf(value).split(" ")[0]! };
};

/**
 * The nodes for a value. A branch has children once they were requested, up
 * to the number loaded at its path, and offers the rest as more.
 */
export const valueNodes = (
  value: Value,
  loaded: Readonly<Record<string, number>>,
  rootId = "value",
): ReadonlyArray<ValueNode> => {
  const build = (current: Value | FlowNode, id: string, key: string | undefined): ValueNode => {
    const parts = partsOf(current);
    const count = loaded[id];
    const children =
      count === undefined
        ? undefined
        : parts
            .slice(0, count)
            .map(([part, entry]) => build(entry, `${id}/${encodeURIComponent(part)}`, part));
    return {
      id,
      ...(key === undefined ? {} : { key }),
      ...describe(current),
      ...(parts.length === 0 ? {} : { expandable: true }),
      ...(children === undefined ? {} : { children }),
      ...(children !== undefined && parts.length > children.length
        ? { more: parts.length - children.length }
        : {}),
    };
  };
  return [build(value, rootId, undefined)];
};

/** Whether a value has parts worth a tree. */
export const isStructured = (value: Value): boolean => partsOf(value).length > 0;
