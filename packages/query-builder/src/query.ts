import { Schema as S } from "effect";

export const Combinator = S.Literals(["All", "Any"]);
export type Combinator = typeof Combinator.Type;

export const AttributeKind = S.Literals(["Text", "Number", "Boolean", "Date", "Select"]);
export type AttributeKind = typeof AttributeKind.Type;

export type QueryRule = Readonly<{
  _tag: "Rule";
  id: string;
  attributeId: string;
  operatorId: string;
  value: string;
}>;

export type QueryGroup = Readonly<{
  _tag: "Group";
  id: string;
  combinator: Combinator;
  children: ReadonlyArray<QueryNode>;
}>;

export type QueryNode = QueryRule | QueryGroup;

export const QueryRule: S.Codec<QueryRule> = S.Struct({
  _tag: S.Literals(["Rule"]),
  id: S.String,
  attributeId: S.String,
  operatorId: S.String,
  value: S.String,
});

export const QueryGroup: S.Codec<QueryGroup> = S.Struct({
  _tag: S.Literals(["Group"]),
  id: S.String,
  combinator: Combinator,
  children: S.Array(S.suspend((): S.Codec<QueryNode> => QueryNode)),
});

export const QueryNode: S.Codec<QueryNode> = S.Union([QueryRule, QueryGroup]);

export type OperatorDefinition = Readonly<{
  id: string;
  label: string;
  requiresValue?: boolean;
}>;

export type AttributeOption = Readonly<{
  value: string;
  label: string;
}>;

export type AttributeDefinition = Readonly<{
  id: string;
  label: string;
  kind: AttributeKind;
  operators?: ReadonlyArray<OperatorDefinition>;
  options?: ReadonlyArray<AttributeOption>;
  placeholder?: string;
}>;

export type Configuration = Readonly<{
  attributes: ReadonlyArray<AttributeDefinition>;
  maxDepth?: number;
  allowEmpty?: boolean;
  validateValue?: (
    attribute: AttributeDefinition,
    value: string,
  ) => string | undefined;
}>;

export const defineAttributes = <const Attributes extends ReadonlyArray<AttributeDefinition>>(
  attributes: Attributes,
): Attributes => attributes;

const textOperators: ReadonlyArray<OperatorDefinition> = [
  { id: "equals", label: "is" },
  { id: "not_equals", label: "is not" },
  { id: "contains", label: "contains" },
  { id: "not_contains", label: "does not contain" },
  { id: "starts_with", label: "starts with" },
  { id: "is_empty", label: "is empty", requiresValue: false },
  { id: "is_not_empty", label: "is not empty", requiresValue: false },
];

const numberOperators: ReadonlyArray<OperatorDefinition> = [
  { id: "equals", label: "=" },
  { id: "not_equals", label: "≠" },
  { id: "greater_than", label: ">" },
  { id: "greater_than_or_equal", label: "≥" },
  { id: "less_than", label: "<" },
  { id: "less_than_or_equal", label: "≤" },
  { id: "is_empty", label: "is empty", requiresValue: false },
];

const booleanOperators: ReadonlyArray<OperatorDefinition> = [
  { id: "is", label: "is" },
];

const dateOperators: ReadonlyArray<OperatorDefinition> = [
  { id: "on", label: "is on" },
  { id: "not_on", label: "is not on" },
  { id: "before", label: "is before" },
  { id: "after", label: "is after" },
  { id: "is_empty", label: "is empty", requiresValue: false },
];

const selectOperators: ReadonlyArray<OperatorDefinition> = [
  { id: "is", label: "is" },
  { id: "is_not", label: "is not" },
  { id: "is_empty", label: "is empty", requiresValue: false },
  { id: "is_not_empty", label: "is not empty", requiresValue: false },
];

export const operatorsForKind = (kind: AttributeKind): ReadonlyArray<OperatorDefinition> => {
  switch (kind) {
    case "Text": return textOperators;
    case "Number": return numberOperators;
    case "Boolean": return booleanOperators;
    case "Date": return dateOperators;
    case "Select": return selectOperators;
  }
};

export const operatorsForAttribute = (
  attribute: AttributeDefinition,
): ReadonlyArray<OperatorDefinition> => attribute.operators ?? operatorsForKind(attribute.kind);

export const defaultValueForAttribute = (attribute: AttributeDefinition): string => {
  if (attribute.kind === "Boolean") return "true";
  if (attribute.kind === "Select") return attribute.options?.[0]?.value ?? "";
  return "";
};

export const createEmptyQuery = (id = "query-root"): QueryGroup => ({
  _tag: "Group",
  id,
  combinator: "All",
  children: [],
});

export const findNode = (group: QueryGroup, id: string): QueryNode | undefined => {
  if (group.id === id) return group;
  for (const child of group.children) {
    if (child.id === id) return child;
    if (child._tag === "Group") {
      const found = findNode(child, id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
};

export const mapNode = (
  group: QueryGroup,
  id: string,
  transform: (node: QueryNode) => QueryNode,
): QueryGroup => {
  if (group.id === id) {
    const transformed = transform(group);
    return transformed._tag === "Group" ? transformed : group;
  }
  return {
    ...group,
    children: group.children.map((child) => {
      if (child.id === id) return transform(child);
      return child._tag === "Group" ? mapNode(child, id, transform) : child;
    }),
  };
};

export const appendNode = (
  query: QueryGroup,
  groupId: string,
  node: QueryNode,
): QueryGroup | undefined => {
  if (findNode(query, node.id) !== undefined) return undefined;
  const group = findNode(query, groupId);
  if (group?._tag !== "Group") return undefined;
  return mapNode(query, groupId, (candidate) => candidate._tag === "Group"
    ? { ...candidate, children: [...candidate.children, node] }
    : candidate);
};

export const removeNode = (query: QueryGroup, nodeId: string): QueryGroup | undefined => {
  if (query.id === nodeId || findNode(query, nodeId) === undefined) return undefined;
  const visit = (group: QueryGroup): QueryGroup => ({
    ...group,
    children: group.children
      .filter((child) => child.id !== nodeId)
      .map((child) => child._tag === "Group" ? visit(child) : child),
  });
  return visit(query);
};
