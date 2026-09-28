import {
  operatorsForAttribute,
  type AttributeDefinition,
  type Combinator,
  type QueryGroup,
  type QueryNode,
  type QueryRule,
} from "./query";

export const DEFAULT_SUMMARY_PREFIX = "Applies when";

export type SummarySegment = Readonly<{
  kind: "Text" | "Attribute" | "Value";
  text: string;
}>;

export const combinatorLabel = (combinator: Combinator): string =>
  combinator === "All" ? "AND" : "OR";

export const combinatorDescription = (combinator: Combinator): string =>
  combinator === "All"
    ? "All of the following must be true"
    : "At least one of the following must be true";

export const displayValue = (rule: QueryRule, attribute: AttributeDefinition): string => {
  if (attribute.kind === "Boolean") return rule.value === "true" ? "true" : "false";
  if (attribute.kind === "Select") {
    return attribute.options?.find((option) => option.value === rule.value)?.label ?? rule.value;
  }
  return rule.value;
};

const quotedValue = (rule: QueryRule, attribute: AttributeDefinition | undefined): string => {
  if (attribute === undefined) return `"${rule.value}"`;
  const value = displayValue(rule, attribute);
  return attribute.kind === "Number" || attribute.kind === "Boolean" ? value : `"${value}"`;
};

const text = (value: string): SummarySegment => ({ kind: "Text", text: value });

const ruleSegments = (
  rule: QueryRule,
  attributes: ReadonlyArray<AttributeDefinition>,
): ReadonlyArray<SummarySegment> => {
  const attribute = attributes.find((candidate) => candidate.id === rule.attributeId);
  const operator =
    attribute === undefined
      ? undefined
      : operatorsForAttribute(attribute).find((candidate) => candidate.id === rule.operatorId);
  return [
    { kind: "Attribute", text: attribute?.label ?? rule.attributeId },
    text(` ${operator?.label ?? rule.operatorId}`),
    ...(operator?.requiresValue === false
      ? []
      : [text(" "), { kind: "Value", text: quotedValue(rule, attribute) } as const]),
  ];
};

const nodeSegments = (
  node: QueryNode,
  attributes: ReadonlyArray<AttributeDefinition>,
  isNested: boolean,
): ReadonlyArray<SummarySegment> => {
  if (node._tag === "Rule") return ruleSegments(node, attributes);
  const children = node.children
    .map((child) => nodeSegments(child, attributes, true))
    .filter((segments) => segments.length > 0);
  const conjunction = node.combinator === "All" ? " and " : " or ";
  const joined = children.flatMap((segments, index) =>
    index === 0 ? segments : [text(conjunction), ...segments],
  );
  return isNested && children.length > 1 ? [text("("), ...joined, text(")")] : joined;
};

/** Describes a query as sentence segments so views can emphasize attributes and values. */
export const summarizeQuery = (
  query: QueryGroup,
  attributes: ReadonlyArray<AttributeDefinition>,
): ReadonlyArray<SummarySegment> => nodeSegments(query, attributes, false);

/** Describes a query as one plain sentence, or `undefined` when it has no conditions. */
export const summaryText = (
  query: QueryGroup,
  attributes: ReadonlyArray<AttributeDefinition>,
  prefix: string = DEFAULT_SUMMARY_PREFIX,
): string | undefined => {
  const segments = summarizeQuery(query, attributes);
  return segments.length === 0
    ? undefined
    : `${prefix} ${segments.map((segment) => segment.text).join("")}.`;
};
