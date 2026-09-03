import type {
  AttributeDefinition,
  Configuration,
  QueryGroup,
  QueryNode,
  QueryRule,
} from "./query";
import { operatorsForAttribute } from "./query";

export type ValidationCode =
  | "CustomValue"
  | "DuplicateId"
  | "EmptyGroup"
  | "InvalidBoolean"
  | "InvalidDate"
  | "InvalidNumber"
  | "InvalidOption"
  | "MaxDepthExceeded"
  | "MissingValue"
  | "UnknownAttribute"
  | "UnknownOperator";

export type ValidationIssue = Readonly<{
  code: ValidationCode;
  nodeId: string;
  path: ReadonlyArray<string>;
  message: string;
}>;

export type ValidationResult = Readonly<{
  isValid: boolean;
  issues: ReadonlyArray<ValidationIssue>;
}>;

const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
};

const valueIssue = (
  rule: QueryRule,
  attribute: AttributeDefinition,
  path: ReadonlyArray<string>,
  configuration: Configuration,
): ValidationIssue | undefined => {
  const operator = operatorsForAttribute(attribute).find((candidate) =>
    candidate.id === rule.operatorId
  );
  if (operator === undefined) {
    return {
      code: "UnknownOperator",
      nodeId: rule.id,
      path,
      message: `“${rule.operatorId}” is not available for ${attribute.label}.`,
    };
  }
  if (operator.requiresValue === false) return undefined;
  if (rule.value.trim() === "") {
    return {
      code: "MissingValue",
      nodeId: rule.id,
      path,
      message: `${attribute.label} needs a value.`,
    };
  }
  if (attribute.kind === "Number" && !Number.isFinite(Number(rule.value))) {
    return {
      code: "InvalidNumber",
      nodeId: rule.id,
      path,
      message: `${attribute.label} must be a number.`,
    };
  }
  if (attribute.kind === "Boolean" && rule.value !== "true" && rule.value !== "false") {
    return {
      code: "InvalidBoolean",
      nodeId: rule.id,
      path,
      message: `${attribute.label} must be true or false.`,
    };
  }
  if (attribute.kind === "Date" && !isIsoDate(rule.value)) {
    return {
      code: "InvalidDate",
      nodeId: rule.id,
      path,
      message: `${attribute.label} must be a valid date.`,
    };
  }
  if (
    attribute.kind === "Select" &&
    !attribute.options?.some((option) => option.value === rule.value)
  ) {
    return {
      code: "InvalidOption",
      nodeId: rule.id,
      path,
      message: `Choose an available ${attribute.label.toLowerCase()} option.`,
    };
  }
  const customMessage = configuration.validateValue?.(attribute, rule.value);
  return customMessage === undefined
    ? undefined
    : { code: "CustomValue", nodeId: rule.id, path, message: customMessage };
};

export const validate = (
  query: QueryGroup,
  configuration: Configuration,
): ValidationResult => {
  const attributes = new Map(configuration.attributes.map((attribute) => [attribute.id, attribute]));
  const ids = new Set<string>();
  const issues: ValidationIssue[] = [];
  const maxDepth = configuration.maxDepth ?? 4;

  const addId = (node: QueryNode, path: ReadonlyArray<string>) => {
    if (ids.has(node.id)) {
      issues.push({
        code: "DuplicateId",
        nodeId: node.id,
        path,
        message: `The query contains more than one item with id “${node.id}”.`,
      });
    }
    ids.add(node.id);
  };

  const visit = (node: QueryNode, depth: number, path: ReadonlyArray<string>) => {
    const nodePath = [...path, node.id];
    addId(node, nodePath);
    if (node._tag === "Group") {
      if (depth > maxDepth) {
        issues.push({
          code: "MaxDepthExceeded",
          nodeId: node.id,
          path: nodePath,
          message: `Groups can be nested at most ${maxDepth} levels.`,
        });
      }
      if (node.children.length === 0 && configuration.allowEmpty !== true) {
        issues.push({
          code: "EmptyGroup",
          nodeId: node.id,
          path: nodePath,
          message: "Add at least one condition to this group.",
        });
      }
      for (const child of node.children) visit(child, depth + 1, nodePath);
      return;
    }
    const attribute = attributes.get(node.attributeId);
    if (attribute === undefined) {
      issues.push({
        code: "UnknownAttribute",
        nodeId: node.id,
        path: nodePath,
        message: `“${node.attributeId}” is not a configured attribute.`,
      });
      return;
    }
    const issue = valueIssue(node, attribute, nodePath, configuration);
    if (issue !== undefined) issues.push(issue);
  };

  visit(query, 0, []);
  return { isValid: issues.length === 0, issues };
};

export const issuesForNode = (
  validation: ValidationResult,
  nodeId: string,
): ReadonlyArray<ValidationIssue> =>
  validation.issues.filter((issue) => issue.nodeId === nodeId);
