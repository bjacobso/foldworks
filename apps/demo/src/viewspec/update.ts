import { validateActionIntent } from "@foldworks/generative-ui/core";
import { Effect, Option, Result, Schema as S } from "effect";
import { Command, type Update } from "foldkit";

import { catalog, crew } from "./catalog";
import { CassetteId, cassettes } from "./cassettes";
import { replayCassette } from "./generation";
import { Message } from "./message";
import { init, type Model } from "./model";

export const GenerateMockUi = Command.define("GenerateMockUi", {
  args: { requestId: S.Int, prompt: S.String, cassetteId: CassetteId },
  messages: [Message.CompletedGeneration],
  execute: ({ requestId, prompt, cassetteId }) =>
    replayCassette(cassetteId, prompt).pipe(
      Effect.delay("450 millis"),
      Effect.map((result) =>
        Message.CompletedGeneration({ requestId, prompt, cassetteId, result }),
      ),
    ),
});

/** This reducer is the demo host, including its local fixture policy. */
export const update = (model: Model, message: Message): Update.Return<Model, Message> => {
  switch (message._tag) {
    case "Reset":
      return { model: { ...init(), requestId: model.requestId + 1 } };
    case "ToggledDocument":
      return { model: { ...model, showDocument: !model.showDocument } };
    case "ChangedPrompt":
      return { model: { ...model, prompt: message.value } };
    case "SelectedCassette":
      return {
        model: {
          ...model,
          cassetteId: message.cassetteId,
          prompt: cassettes[message.cassetteId].examplePrompt,
          generationState: "Idle",
          generationError: "",
          requestId: model.requestId + 1,
        },
      };
    case "RequestedGeneration": {
      if (model.generationState === "Loading" || model.prompt.trim() === "") return { model };
      const requestId = model.requestId + 1;
      return {
        model: { ...model, generationState: "Loading", generationError: "", requestId },
        commands: [
          GenerateMockUi({ requestId, prompt: model.prompt.trim(), cassetteId: model.cassetteId }),
        ],
      };
    }
    case "CompletedGeneration": {
      if (model.generationState !== "Loading" || message.requestId !== model.requestId)
        return { model };
      return message.result._tag === "Error"
        ? { model: { ...model, generationState: "Error", generationError: message.result.error } }
        : {
            model: {
              ...model,
              generationState: "Ready",
              generatedSpec: Option.some(message.result.spec),
              generatedPrompt: message.prompt,
              generatedCassette: message.cassetteId,
            },
          };
    }
    case "ReceivedGeneratedIntent": {
      const decoded = validateActionIntent(catalog, message.intent);
      const spec = Option.getOrUndefined(model.generatedSpec);
      const binding = spec?.elements[message.intent.elementId]?.on?.[message.intent.event];
      if (
        Result.isFailure(decoded) ||
        binding === undefined ||
        binding.action !== decoded.success.action
      )
        return {
          model: {
            ...model,
            outcome: "Invalid",
            receipt: "Host refused an invalid generated UI intent.",
          },
        };
      const intent = decoded.success;
      // These mock documents use static selection and assignment requests. The host
      // checks the current document binding as well as its own fixture policy.
      if (intent.action === "select_crew" && binding.params?.crewId === intent.params.crewId)
        return update(model, Message.ReceivedIntent({ intent: message.intent }));
      if (
        intent.action === "request_assignment" &&
        binding.params?.crewId === intent.params.crewId &&
        binding.params?.note === intent.params.note
      ) {
        const person = crew.find((entry) => entry.id === intent.params.crewId)!;
        const accepted = person.available && intent.params.note.trim().length > 0;
        return {
          model: {
            ...model,
            lastIntent: JSON.stringify(intent, null, 2),
            outcome: accepted ? "Accepted" : "Refused",
            receipt: accepted
              ? `Fixture host accepted the assignment for ${person.name}.`
              : `Fixture host refused the assignment for ${person.name}: crew member is off duty.`,
          },
        };
      }
      return {
        model: {
          ...model,
          outcome: "Invalid",
          receipt: "Host refused an unsupported or changed generated UI intent.",
        },
      };
    }
    case "ReceivedIntent": {
      const decoded = validateActionIntent(catalog, message.intent);
      if (Result.isFailure(decoded))
        return {
          model: {
            ...model,
            outcome: "Invalid",
            receipt: "Host refused an invalid action intent.",
          },
        };
      const intent = decoded.success;
      switch (intent.action) {
        case "edit_filter":
          return { model: { ...model, filter: intent.data.value } };
        case "edit_note":
          return {
            model: {
              ...model,
              note: intent.data.value,
              outcome: "Idle",
              receipt: "Draft updated. Send a request for host review.",
            },
          };
        case "select_crew":
          return {
            model: {
              ...model,
              selected: intent.params.crewId,
              note: "",
              outcome: "Idle",
              receipt: "Selection changed. Add a note for this crew member.",
            },
          };
        case "request_assignment": {
          const person = crew.find((entry) => entry.id === intent.params.crewId)!;
          // Schema validation is not authorization. The host checks the current draft and its policy.
          const accepted =
            person.available &&
            intent.params.note.trim().length > 0 &&
            intent.params.crewId === model.selected &&
            intent.params.note === model.note;
          return {
            model: {
              ...model,
              lastIntent: JSON.stringify(intent, null, 2),
              outcome: accepted ? "Accepted" : "Refused",
              receipt: accepted
                ? `Fixture host accepted the assignment for ${person.name}.`
                : `Fixture host refused the assignment for ${person.name}: ${!person.available ? "crew member is off duty" : "request does not match a complete current draft"}.`,
            },
          };
        }
      }
    }
  }
};
