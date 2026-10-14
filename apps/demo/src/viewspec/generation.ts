import { generate } from "@foldworks/generative-ui/ai";
import { Spec, validateSpec } from "@foldworks/generative-ui/core";
import { Effect, Result, Schema as S, Stream } from "effect";
import { AiError, LanguageModel } from "effect/ai";

import { catalog } from "./catalog";
import { cassettes, type CassetteId } from "./cassettes";

export const GenerationResult = S.Union([
  S.TaggedStruct("Ready", { spec: Spec }),
  S.TaggedStruct("Error", { error: S.String }),
]);
export type GenerationResult = typeof GenerationResult.Type;

/** Substitute only the provider response; structured generation still uses the real API. */
export const cassetteModel = (
  cassetteId: CassetteId,
  observeRequest?: (options: LanguageModel.ProviderOptions) => void,
): Effect.Effect<LanguageModel.LanguageModel> =>
  LanguageModel.make({
    generateText: (options) =>
      Effect.gen(function* () {
        observeRequest?.(options);
        const cassette = cassettes[cassetteId];
        if ("error" in cassette)
          return yield* Effect.fail(
            AiError.make({
              module: "ViewSpecMock",
              method: "generateText",
              reason: new AiError.UnknownError({ description: cassette.error }),
            }),
          );
        return [{ type: "text" as const, text: cassette.response }];
      }),
    streamText: () => Stream.empty,
  });

export const replayCassette = (
  cassetteId: CassetteId,
  prompt: string,
): Effect.Effect<GenerationResult> =>
  Effect.gen(function* () {
    const model = yield* cassetteModel(cassetteId);
    const spec = yield* generate(catalog, { prompt }).pipe(
      Effect.provideService(LanguageModel.LanguageModel, model),
    );
    const validated = validateSpec(catalog, spec);
    return Result.isSuccess(validated)
      ? { _tag: "Ready" as const, spec: validated.success }
      : {
          _tag: "Error" as const,
          error: `Mock response failed graph validation:\n${validated.failure.map((issue) => `${issue.path ?? "spec"}: ${issue.message}`).join("\n")}`,
        };
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed({
        _tag: "Error" as const,
        error:
          cassetteId === "provider-error"
            ? cassettes["provider-error"].description + " Choose another cassette and retry."
            : `Mock response failed schema/JSON decoding (${error.reason._tag}). ${error.message.slice(0, 1_000)}`,
      }),
    ),
  );
