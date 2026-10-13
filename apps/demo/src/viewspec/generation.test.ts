import { generate } from "@foldworks/generative-ui/ai";
import { Effect, Option } from "effect";
import { LanguageModel } from "effect/unstable/ai";
import { describe, expect, it } from "vitest";

import { catalog } from "./catalog";
import type { CassetteId } from "./cassettes";
import { cassetteModel, replayCassette } from "./generation";
import { Message } from "./message";
import { init, type Model } from "./model";
import { update } from "./update";

describe("ViewSpec mock generation", () => {
  it("passes the user prompt and real catalog through the generation API", async () => {
    let request: LanguageModel.ProviderOptions | undefined;
    const prompt = "Give me a crew view for my expedition.";
    const spec = await Effect.runPromise(
      Effect.gen(function* () {
        const model = yield* cassetteModel("crew-cards", (options) => {
          request = options;
        });
        return yield* generate(catalog, { prompt }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, model),
        );
      }),
    );
    expect(spec.root).toBe("mock-crew");
    expect(JSON.stringify(request?.prompt)).toContain(prompt);
    expect(JSON.stringify(request?.prompt)).toContain("User request:");
    expect(JSON.stringify(request?.prompt)).toContain("request_assignment");
    expect(request?.responseFormat.type).toBe("json");
    if (request?.responseFormat.type !== "json") throw new Error("Expected structured output");
    expect(request.responseFormat.schema).toBe(catalog.schema);
  });

  it.each(["crew-cards", "mission-brief", "off-duty"] as const)(
    "decodes and validates the %s cassette",
    async (cassette) => {
      const result = await Effect.runPromise(replayCassette(cassette, "Test prompt"));
      expect(result._tag).toBe("Ready");
    },
  );

  it.each([
    ["invalid-component", "schema/JSON decoding"],
    ["malformed-json", "schema/JSON decoding"],
    ["broken-reference", "graph validation"],
    ["provider-error", "provider failure"],
  ] as const)("rejects the %s cassette", async (cassette, error) => {
    const result = await Effect.runPromise(replayCassette(cassette, "Test prompt"));
    if (result._tag !== "Error") throw new Error("Expected failed generation");
    expect(result.error).toContain(error);
  });

  it("ignores empty submissions and duplicate in-flight generation requests", () => {
    expect(update({ ...init(), prompt: "  " }, Message.RequestedGeneration())).toEqual({
      model: { ...init(), prompt: "  " },
    });
    const started = update(init(), Message.RequestedGeneration());
    expect(started.commands).toHaveLength(1);
    expect(started.model.generationState).toBe("Loading");
    expect(update(started.model, Message.RequestedGeneration())).toEqual({ model: started.model });
  });

  const complete = async (model: Model, cassetteId: CassetteId) =>
    update(
      model,
      Message.CompletedGeneration({
        requestId: model.requestId,
        prompt: model.prompt,
        cassetteId,
        result: await Effect.runPromise(replayCassette(cassetteId, model.prompt)),
      }),
    ).model;

  it("keeps the last valid document when a subsequent response fails", async () => {
    const ready = await complete(
      update(init(), Message.RequestedGeneration()).model,
      "mission-brief",
    );
    const next = update(ready, Message.SelectedCassette({ cassetteId: "broken-reference" })).model;
    const failed = await complete(
      update(next, Message.RequestedGeneration()).model,
      "broken-reference",
    );
    expect(failed.generationState).toBe("Error");
    expect(failed.generatedSpec).toEqual(ready.generatedSpec);
    expect(failed.generatedCassette).toBe("mission-brief");
    expect(failed.generatedPrompt).toBe(ready.generatedPrompt);
    expect(failed.generationError).toContain("missing-child");
  });

  it("ignores obsolete completions after changing cassettes or resetting", async () => {
    const started = update(init(), Message.RequestedGeneration()).model;
    const old = Message.CompletedGeneration({
      requestId: started.requestId,
      cassetteId: "crew-cards",
      prompt: started.prompt,
      result: await Effect.runPromise(replayCassette("crew-cards", started.prompt)),
    });
    const selected = update(
      started,
      Message.SelectedCassette({ cassetteId: "mission-brief" }),
    ).model;
    expect(update(selected, old).model).toEqual(selected);
    const reset = update(started, Message.Reset()).model;
    const restarted = update(reset, Message.RequestedGeneration()).model;
    expect(update(restarted, old).model).toEqual(restarted);
    expect(Option.isNone(restarted.generatedSpec)).toBe(true);
  });

  it("handles generated actions through host policy and checks current bindings", async () => {
    const ready = await complete(
      update(init(), Message.RequestedGeneration()).model,
      "mission-brief",
    );
    const intent = {
      action: "request_assignment",
      elementId: "mock-request",
      event: "press",
      params: { crewId: "ford", note: "Survey the landing site" },
    };
    expect(update(ready, Message.ReceivedGeneratedIntent({ intent })).model.outcome).toBe(
      "Accepted",
    );
    expect(
      update(
        ready,
        Message.ReceivedGeneratedIntent({
          intent: { ...intent, params: { crewId: "trillian", note: "Changed request" } },
        }),
      ).model.outcome,
    ).toBe("Invalid");
    expect(update(init(), Message.ReceivedGeneratedIntent({ intent })).model.outcome).toBe(
      "Invalid",
    );
    const offDuty = await complete(update(init(), Message.RequestedGeneration()).model, "off-duty");
    expect(
      update(
        offDuty,
        Message.ReceivedGeneratedIntent({
          intent: {
            ...intent,
            elementId: "mock-marvin-request",
            params: { crewId: "marvin", note: "Review systems" },
          },
        }),
      ).model.outcome,
    ).toBe("Refused");
  });
});
