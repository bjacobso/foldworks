import { Effect } from "effect";
import { LanguageModel } from "effect/unstable/ai";

import type { Catalog } from "./catalog";
import { catalogPrompt } from "./catalog";

export type GenerateOptions = Readonly<{
  prompt: string;
  instructions?: ReadonlyArray<string>;
}>;

/** Generate a schema-decoded UI through whichever Effect LanguageModel layer the host provides. */
export const generate = (catalog: Catalog, options: GenerateOptions) =>
  LanguageModel.generateObject({
    objectName: "foldworks_ui",
    schema: catalog.schema,
    prompt: [
      catalogPrompt(catalog),
      ...(options.instructions ?? []),
      "User request:",
      options.prompt,
    ].join("\n\n"),
  }).pipe(Effect.map((response) => response.value));
