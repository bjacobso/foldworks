import { Schema as S } from "effect";

export const ActionBinding = S.Struct({
  action: S.String,
  params: S.optional(S.JsonObject),
});
export type ActionBinding = typeof ActionBinding.Type;

export const Element = S.Struct({
  type: S.String,
  props: S.JsonObject,
  children: S.Array(S.String),
  on: S.optional(S.Record(S.String, ActionBinding)),
});
export type Element = typeof Element.Type;

/** Versioned, flat, keyed trees are easy to validate, patch, stream, and carry over MCP. */
export const Spec = S.Struct({
  version: S.Literal("1"),
  root: S.String,
  elements: S.Record(S.String, Element),
});
export type Spec = typeof Spec.Type;

export const ActionIntent = S.Struct({
  action: S.String,
  elementId: S.String,
  event: S.String,
  params: S.JsonObject,
});
export type ActionIntent = typeof ActionIntent.Type;

export type ValidationIssue = Readonly<{
  code:
    | "invalid-schema"
    | "limit-exceeded"
    | "missing-root"
    | "missing-child"
    | "cycle"
    | "invalid-children"
    | "unreachable-element"
    | "unsupported-event";
  message: string;
  path?: string;
}>;

export type ValidationLimits = Readonly<{
  maxElements: number;
  maxChildrenPerElement: number;
  maxDepth: number;
  maxStringLength: number;
}>;

export const defaultValidationLimits: ValidationLimits = {
  maxElements: 100,
  maxChildrenPerElement: 24,
  maxDepth: 20,
  maxStringLength: 4_000,
};
