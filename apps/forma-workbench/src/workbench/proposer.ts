import { Effect, Schema as S } from "effect";
import { LanguageModel } from "effect/ai";
import type { NodeDescription } from "@formalang/host/types";
import type { Analysis } from "./analysis.js";
import { Script, refactoring } from "./edits.js";

export const Answer = S.Union([
  S.Struct({ kind: S.Literal("reply"), text: S.String }),
  S.Struct({ kind: S.Literal("edit"), title: S.String, script: Script }),
]);
export type Answer = typeof Answer.Type;
export interface ProposalContext {
  readonly prompt: string;
  readonly selectedIds: ReadonlyArray<string>;
  readonly focusId: string | null;
  readonly nodes: ReadonlyArray<NodeDescription>;
  readonly analysis: Analysis;
}
/** Providers return id-addressed scripts. All providers use the same validation and review path. */
export interface Proposer {
  readonly name: string;
  readonly propose: (context: ProposalContext) => Effect.Effect<Answer, string>;
}

export const localProposer: Proposer = {
  name: "Local proposer",
  propose: (context) =>
    Effect.sync(() => {
      const targets =
        context.selectedIds.length > 0
          ? context.selectedIds
          : context.focusId === null
            ? []
            : [context.focusId];
      if (targets.length === 0)
        return {
          kind: "reply",
          text: "Select or focus a form, then ask me to wrap, unwrap, raise, splice, rename, or extract it.",
        };
      const prompt = context.prompt.trim();
      const wrapped = /\bwrap\b.*\bin\s+([^\s]+)\s*$/i.exec(prompt);
      if (wrapped !== null)
        return {
          kind: "edit",
          title: `Wrap selection in ${wrapped[1]}`,
          script: refactoring("wrap", targets, wrapped[1]!),
        };
      const renamed = /\brename\b.*\bto\s+([^\s]+)\s*$/i.exec(prompt);
      if (renamed !== null) {
        const definition = context.analysis.definitions.find(
          (definition) => definition.formNodeId === targets[0] && definition.scope === "global",
        );
        return {
          kind: "edit",
          title: `Rename to ${renamed[1]}`,
          script: refactoring("rename", [definition?.nodeId ?? targets[0]!], renamed[1]!),
        };
      }
      const extracted = /\bextract\b.*\bas\s+([^\s]+)\s*$/i.exec(prompt);
      if (extracted !== null)
        return {
          kind: "edit",
          title: `Extract as ${extracted[1]}`,
          script: refactoring("extract", targets, extracted[1]!),
        };
      for (const action of ["unwrap", "raise", "splice"] as const) {
        if (new RegExp(`\\b${action}\\b`, "i").test(prompt))
          return { kind: "edit", title: action, script: refactoring(action, targets, "") };
      }
      return {
        kind: "reply",
        text: "I understand “wrap selection in do”, “rename to name”, “extract as name”, “unwrap”, “raise”, and “splice”.",
      };
    }),
};

/** Capture an explicitly supplied Effect LanguageModel. No provider or network is enabled by default. */
export const modelProposer = (name = "Configured model") =>
  Effect.gen(function* () {
    const model = yield* LanguageModel.LanguageModel;
    return {
      name,
      propose: (context: ProposalContext) =>
        LanguageModel.generateObject({
          objectName: "forma_structural_proposal",
          schema: Answer,
          prompt: [
            "You propose structural Forma edits. Return an edit script using only ids in this document, or a reply. Never return line-range patches. The person reviews every edit before it can be applied. Capability execution requires separate permission.",
            JSON.stringify({
              prompt: context.prompt,
              selectedIds: context.selectedIds,
              focusId: context.focusId,
              nodes: context.nodes,
              document: context.analysis.document,
              types: context.analysis.types,
              values: context.analysis.values,
              diagnostics: context.analysis.diagnostics,
              requirements: context.analysis.requirements,
              slots: context.analysis.slots,
            }),
          ].join("\n\n"),
        }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, model),
          Effect.map((response) => response.value),
          Effect.mapError((error) => String(error)),
        ),
    } satisfies Proposer;
  });
