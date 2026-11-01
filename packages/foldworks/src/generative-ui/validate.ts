import { Result, Schema as S, SchemaIssue } from "effect";

import type { Catalog } from "./catalog";
import {
  defaultValidationLimits,
  type Spec,
  type ValidationIssue,
  type ValidationLimits,
} from "./model";

export type ValidationResult = Result.Result<Spec, ReadonlyArray<ValidationIssue>>;

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

const schemaIssues = (catalog: Catalog, input: unknown): ValidationResult => {
  const decoded = S.decodeUnknownResult(catalog.schema, {
    errors: "all",
    onExcessProperty: "error",
  })(input);
  if (Result.isSuccess(decoded)) return Result.succeed(decoded.success);
  return Result.fail(
    formatter(decoded.failure.issue).issues.map((issue) => ({
      code: "invalid-schema" as const,
      message: issue.message,
      ...(issue.path === undefined
        ? {}
        : {
            path: issue.path
              .map((part) => (typeof part === "object" ? String(part.key) : String(part)))
              .join("."),
          }),
    })),
  );
};

const visitStrings = (
  value: unknown,
  path: string,
  maxLength: number,
  issues: ValidationIssue[],
): void => {
  if (typeof value === "string") {
    if (value.length > maxLength)
      issues.push({
        code: "limit-exceeded",
        message: `String is longer than ${maxLength} characters.`,
        path,
      });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visitStrings(entry, `${path}.${index}`, maxLength, issues));
    return;
  }
  if (value !== null && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) =>
      visitStrings(entry, `${path}.${key}`, maxLength, issues),
    );
  }
};

/** Decode agent input and enforce graph, catalog-event, and resource limits. */
export const validateSpec = (
  catalog: Catalog,
  input: unknown,
  overrides: Partial<ValidationLimits> = {},
): ValidationResult => {
  const decoded = schemaIssues(catalog, input);
  if (Result.isFailure(decoded)) return decoded;
  const spec = decoded.success;
  const limits = { ...defaultValidationLimits, ...overrides };
  const issues: ValidationIssue[] = [];
  const ids = Object.keys(spec.elements);
  if (ids.length > limits.maxElements)
    issues.push({
      code: "limit-exceeded",
      message: `A surface may contain at most ${limits.maxElements} elements.`,
      path: "elements",
    });
  if (spec.elements[spec.root] === undefined)
    issues.push({
      code: "missing-root",
      message: `Root element ${JSON.stringify(spec.root)} does not exist.`,
      path: "root",
    });

  for (const [id, element] of Object.entries(spec.elements)) {
    if (element.children.length > limits.maxChildrenPerElement)
      issues.push({
        code: "limit-exceeded",
        message: `Element may contain at most ${limits.maxChildrenPerElement} children.`,
        path: `elements.${id}.children`,
      });
    const supportedEvents = new Set(catalog.components[element.type]?.events ?? []);
    const childPolicy = catalog.components[element.type]?.children ?? "optional";
    if (childPolicy === "none" && element.children.length > 0)
      issues.push({
        code: "invalid-children",
        message: `${element.type} cannot contain children.`,
        path: `elements.${id}.children`,
      });
    if (childPolicy === "required" && element.children.length === 0)
      issues.push({
        code: "invalid-children",
        message: `${element.type} requires at least one child.`,
        path: `elements.${id}.children`,
      });
    for (const event of Object.keys(element.on ?? {})) {
      if (!supportedEvents.has(event))
        issues.push({
          code: "unsupported-event",
          message: `${element.type} does not emit ${JSON.stringify(event)}.`,
          path: `elements.${id}.on.${event}`,
        });
    }
    for (const child of element.children) {
      if (spec.elements[child] === undefined)
        issues.push({
          code: "missing-child",
          message: `Child element ${JSON.stringify(child)} does not exist.`,
          path: `elements.${id}.children`,
        });
    }
    visitStrings(element.props, `elements.${id}.props`, limits.maxStringLength, issues);
    visitStrings(element.on, `elements.${id}.on`, limits.maxStringLength, issues);
    visitStrings(id, `elements.${id}`, limits.maxStringLength, issues);
  }
  visitStrings(spec.root, "root", limits.maxStringLength, issues);

  const visited = new Set<string>();
  const active = new Set<string>();
  const walk = (id: string, depth: number): void => {
    if (active.has(id)) {
      issues.push({
        code: "cycle",
        message: `Element graph contains a cycle at ${JSON.stringify(id)}.`,
        path: `elements.${id}`,
      });
      return;
    }
    if (visited.has(id)) return;
    if (depth > limits.maxDepth) {
      issues.push({
        code: "limit-exceeded",
        message: `Element graph may be at most ${limits.maxDepth} levels deep.`,
        path: `elements.${id}`,
      });
      return;
    }
    const element = spec.elements[id];
    if (element === undefined) return;
    active.add(id);
    for (const child of element.children) walk(child, depth + 1);
    active.delete(id);
    visited.add(id);
  };
  walk(spec.root, 1);
  for (const id of ids) {
    if (!visited.has(id))
      issues.push({
        code: "unreachable-element",
        message: `Element ${JSON.stringify(id)} is not reachable from the root.`,
        path: `elements.${id}`,
      });
  }
  return issues.length === 0 ? Result.succeed(spec) : Result.fail(issues);
};
