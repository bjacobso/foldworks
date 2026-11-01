// Checks over the workflow prelude's elaborated declarations. A step reads
// and writes data keys, and a workflow orders steps with `sequence` and
// `parallel`. A step that may run before the step that writes what it reads
// is a warning on the step's reference in the workflow.

import type { Diagnostic } from "@formalang/host/types";
import { declarationDiagnostic, type ElaboratedDeclaration } from "@formalang/ts/descriptor";
import {
  identifySyntax,
  indexSyntax,
  type SyntaxIndex,
  type SyntaxNode,
} from "@formalang/ts/syntax";
import type { DeclarationCheck } from "../workbench/index";

type Flow =
  | { readonly kind: "step"; readonly step: string }
  | { readonly kind: "sequence" | "parallel"; readonly items: ReadonlyArray<Flow> };

interface Step {
  readonly kind: "Step";
  readonly name: string;
  readonly reads: ReadonlyArray<string>;
  readonly writes: ReadonlyArray<string>;
}

interface Workflow {
  readonly kind: "Workflow";
  readonly name: string;
  readonly flow: Flow;
}

const payloadOf = <T extends { readonly kind: string }>(
  declaration: ElaboratedDeclaration,
  kind: T["kind"],
): T | undefined => {
  const payload = declaration.payload as { readonly kind?: unknown } | null;
  return payload !== null && typeof payload === "object" && payload.kind === kind
    ? (payload as T)
    : undefined;
};

/** References in typed `use` forms, in the same order as the projected flow. */
const stepReferences = (syntax: SyntaxIndex, source: string, form: SyntaxNode): SyntaxNode[] => {
  const references: SyntaxNode[] = [];
  const visit = (node: SyntaxNode) => {
    const children = syntax.children(node.id);
    const [head, reference] = children;
    if (
      node.kind === "List" &&
      head !== undefined &&
      reference !== undefined &&
      source.slice(head.span.start, head.span.end) === "use"
    )
      references.push(reference);
    children.forEach(visit);
  };
  visit(form);
  return references;
};

/** Warns when a step may read a key before the step that writes it has run. */
export const dataflow: DeclarationCheck = (declarations, source) => {
  const steps = new Map(
    declarations.flatMap((declaration) => {
      const step = payloadOf<Step>(declaration, "Step");
      return step === undefined ? [] : [[step.name, step] as const];
    }),
  );
  const syntax = indexSyntax(identifySyntax(source));
  const diagnostics: Diagnostic[] = [];
  for (const declaration of declarations) {
    const workflow = payloadOf<Workflow>(declaration, "Workflow");
    if (workflow === undefined) continue;
    const form = syntax.withSpan(declaration.span.startOffset, declaration.span.endOffset);
    const references = form === undefined ? [] : stepReferences(syntax, source, form);
    // Each occurrence of a step, in order, with the steps certain to have finished before it.
    const occurrences: Array<{ step: string; done: ReadonlySet<string> }> = [];
    const walk = (flow: Flow, done: ReadonlySet<string>): ReadonlySet<string> => {
      if (flow.kind === "step") {
        occurrences.push({ step: flow.step, done });
        return new Set([...done, flow.step]);
      }
      if (flow.kind === "sequence")
        return flow.items.reduce((after, item) => walk(item, after), done);
      return new Set(flow.items.flatMap((item) => [...walk(item, done)]));
    };
    walk(workflow.flow, new Set());
    const present = new Set(occurrences.map((occurrence) => occurrence.step));
    occurrences.forEach(({ step, done }, position) => {
      for (const key of steps.get(step)?.reads ?? []) {
        const writers = [...steps.values()].filter(
          (candidate) => candidate.name !== step && candidate.writes.includes(key),
        );
        if (writers.length === 0 || writers.some((writer) => done.has(writer.name))) continue;
        const names = writers.map((writer) => writer.name).join(" or ");
        const message = writers.some((writer) => present.has(writer.name))
          ? `${step} may read :${key} before ${names} writes it`
          : `${step} reads :${key}, but ${names}, which writes it, is not in ${workflow.name}`;
        const diagnostic = declarationDiagnostic(
          declaration,
          "workflow/read-before-write",
          message,
          "warning",
        );
        const reference = references[position];
        diagnostics.push(
          reference === undefined
            ? diagnostic
            : {
                ...diagnostic,
                span: {
                  sourceId: declaration.span.sourceId,
                  startOffset: reference.span.start,
                  endOffset: reference.span.end,
                },
              },
        );
      }
    });
  }
  return diagnostics;
};
