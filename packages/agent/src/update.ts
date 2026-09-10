import { Effect, Option, Schema as S } from "effect";
import { Command, Update } from "foldkit";

import { ModelSelect } from "./components";
import { Message } from "./message";
import {
  init,
  isActive,
  latestUserPrompt,
  transcriptId,
  type ConversationPart,
  type Model,
  type ToolPart,
  type Turn,
} from "./model";
import type { EventEnvelope, StreamEvent } from "./protocol";

const MeasureFollowing = Command.define("MeasureAgentTranscriptFollowing", {
  args: { id: S.String, scrollTop: S.Number },
  messages: [Message.CompletedMeasureFollowing],
  execute: ({ id, scrollTop }) => Effect.sync(() => {
    const element = document.getElementById(id);
    return Message.CompletedMeasureFollowing({
      isFollowing: element === null || element.scrollHeight - element.clientHeight - scrollTop < 72,
    });
  }),
});

const ScrollLatest = Command.define("ScrollAgentTranscriptLatest", {
  args: { id: S.String },
  messages: [Message.CompletedScrollLatest],
  execute: ({ id }) => Effect.promise(() => new Promise<ReturnType<typeof Message.CompletedScrollLatest>>((resolve) => {
    requestAnimationFrame(() => {
      const element = document.getElementById(id);
      if (element !== null) element.scrollTop = element.scrollHeight;
      resolve(Message.CompletedScrollLatest());
    });
  })),
});

const mapParts = (
  model: Model,
  predicate: (part: ConversationPart) => boolean,
  transform: (part: ConversationPart) => ConversationPart,
): Model => ({
  ...model,
  transcript: model.transcript.map((turn) => turn.role !== "Assistant"
    ? turn
    : { ...turn, parts: turn.parts.map((part) => predicate(part) ? transform(part) : part) }),
});

const appendAssistantPart = (model: Model, part: ConversationPart): Model => {
  let index = -1;
  for (let turnIndex = model.transcript.length - 1; turnIndex >= 0; turnIndex -= 1) {
    if (model.transcript[turnIndex]?.role === "Assistant") {
      index = turnIndex;
      break;
    }
  }
  if (index < 0) return model;
  return {
    ...model,
    transcript: model.transcript.map((turn, turnIndex) => turnIndex === index
      ? { ...turn, parts: [...turn.parts, part] }
      : turn),
  };
};

const updateText = (
  model: Model,
  partId: string,
  transform: (part: Extract<ConversationPart, { _tag: "Text" }>) => ConversationPart,
): Model => mapParts(
  model,
  (part) => part._tag === "Text" && part.id === partId,
  (part) => transform(part as Extract<ConversationPart, { _tag: "Text" }>),
);

const updateTool = (
  model: Model,
  callId: string,
  transform: (part: ToolPart) => ConversationPart,
): Model => mapParts(
  model,
  (part) => part._tag === "Tool" && part.callId === callId,
  (part) => transform(part as ToolPart),
);

const startRun = (
  model: Model,
  prompt: string,
  appendUser: boolean,
): Update.Return<Model, Message> => {
  const value = prompt.trim();
  if (!value || isActive(model)) return { model };
  const number = model.nextRunNumber;
  const runId = `${model.id}-run-${number}`;
  const turns: ReadonlyArray<Turn> = [
    ...(appendUser ? [{
      id: `${runId}-user`,
      role: "User" as const,
      modelId: "",
      parts: [{ _tag: "Text" as const, id: `${runId}-prompt`, text: value, status: "Complete" as const }],
    }] : []),
    { id: `${runId}-assistant`, role: "Assistant", modelId: model.selectedModel, parts: [] },
  ];
  return {
    model: {
      ...model,
      transcript: [...model.transcript, ...turns],
      draft: "",
      runState: { _tag: "Streaming", runId, segment: "Initial", lastSequence: 0 },
      nextRunNumber: number + 1,
      isFollowing: true,
      announcement: "Assistant response started.",
    },
    commands: [ScrollLatest({ id: transcriptId(model) })],
  };
};

const applyEvent = (model: Model, event: StreamEvent, sequence: number): Model => {
  const streaming = model.runState._tag === "Streaming"
    ? { ...model.runState, lastSequence: sequence }
    : model.runState;
  let next: Model = { ...model, runState: streaming };
  switch (event._tag) {
    case "Started":
      return { ...next, announcement: "Assistant is streaming a response." };
    case "TextStarted":
      return appendAssistantPart(next, { _tag: "Text", id: event.partId, text: "", status: "Streaming" });
    case "TextDelta":
      return updateText(next, event.partId, (part) => ({ ...part, text: part.text + event.delta }));
    case "TextFinished":
      return updateText(next, event.partId, (part) => ({ ...part, status: "Complete" }));
    case "ToolInputStarted":
      return appendAssistantPart({ ...next, announcement: `${event.name} tool call prepared.` }, {
        _tag: "Tool",
        callId: event.callId,
        name: event.name,
        input: "",
        output: "",
        permissionReason: "",
        status: "Preparing",
      });
    case "ToolInputDelta":
      return updateTool(next, event.callId, (part) => ({ ...part, input: part.input + event.delta }));
    case "ToolCallReady":
      return { ...next, announcement: "Tool input is ready." };
    case "ToolStarted":
      return updateTool({ ...next, announcement: "Tool is running." }, event.callId, (part) => ({ ...part, status: "Running" }));
    case "ToolResult":
      return updateTool({ ...next, announcement: "Tool completed." }, event.callId, (part) => ({ ...part, status: "Completed", output: event.output }));
    case "PermissionRequested":
      next = updateTool(next, event.callId, (part) => ({
        ...part,
        permissionReason: event.reason,
        status: "WaitingApproval",
      }));
      return {
        ...next,
        runState: {
          _tag: "AwaitingPermission",
          runId: event.runId,
          callId: event.callId,
          lastSequence: sequence,
        },
        announcement: "Permission required. Review the tool request.",
      };
    case "Finished":
      return { ...next, runState: { _tag: "Idle" }, announcement: "Assistant response complete." };
    case "Failed":
      next = mapParts(
        next,
        (part) => part._tag === "Text" && part.status === "Streaming",
        (part) => part._tag === "Text" ? { ...part, status: "Failed" } : part,
      );
      next = mapParts(
        next,
        (part) => part._tag === "Tool" && ["Preparing", "Running"].includes(part.status),
        (part) => part._tag === "Tool" ? { ...part, status: "Failed" } : part,
      );
      return {
        ...next,
        runState: { _tag: "Failed", runId: event.runId, message: event.message },
        announcement: `Agent failed: ${event.message}`,
      };
  }
};

const receive = (model: Model, envelope: EventEnvelope): Update.Return<Model, Message> => {
  if (
    model.runState._tag !== "Streaming" ||
    envelope.event.runId !== model.runState.runId ||
    envelope.sequence <= model.runState.lastSequence
  ) return { model };
  const next = applyEvent(model, envelope.event, envelope.sequence);
  return {
    model: next,
    ...(model.isFollowing ? { commands: [ScrollLatest({ id: transcriptId(model) })] } : {}),
  };
};

const interrupt = (model: Model): Model => {
  let next = mapParts(
    model,
    (part) => part._tag === "Text" && part.status === "Streaming",
    (part) => part._tag === "Text" ? { ...part, status: "Interrupted" } : part,
  );
  next = mapParts(
    next,
    (part) => part._tag === "Tool" && ["Preparing", "Running", "WaitingApproval"].includes(part.status),
    (part) => part._tag === "Tool"
      ? { ...part, status: "Cancelled", output: part.output || "Cancelled before execution." }
      : part,
  );
  return { ...next, runState: { _tag: "Idle" }, announcement: "Assistant response stopped." };
};

const foldModelPicker = Update.foldChild({
  update: ModelSelect.update,
  read: (model: Model) => Option.some(model.modelPicker),
  write: (model, modelPicker) => ({ ...model, modelPicker }),
  toParentMessage: (message) => Message.GotModelPickerMessage({ message }),
  foldOutMessage: (outMessage) => (model: Model) => isActive(model)
    ? { model }
    : {
        model: {
          ...model,
          selectedModel: outMessage.value,
          announcement: `${outMessage.value} selected.`,
        },
      },
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    GotModelPickerMessage: ({ message }) => foldModelPicker(model, message),
    ChangedDraft: ({ value }) => isActive(model) ? { model } : { model: { ...model, draft: value } },
    Submitted: () => startRun(model, model.draft, true),
    SelectedSuggestion: ({ prompt }) => startRun({ ...model, draft: prompt }, prompt, true),
    ReceivedStreamEvent: ({ envelope }) => receive(model, envelope),
    ChosePermission: ({ decision }) => {
      if (model.runState._tag !== "AwaitingPermission") return { model };
      const { runId, callId, lastSequence } = model.runState;
      const allowed = decision === "Allow";
      const next = updateTool(model, callId, (part) => ({
        ...part,
        status: allowed ? "Running" : "Denied",
        output: allowed ? part.output : "Permission denied. No action was taken.",
      }));
      return {
        model: {
          ...next,
          runState: {
            _tag: "Streaming",
            runId,
            segment: allowed ? "Approved" : "Denied",
            lastSequence,
          },
          announcement: allowed ? "Permission granted once. Tool is running." : "Permission denied. No action was taken.",
        },
      };
    },
    Stopped: () => isActive(model) ? { model: interrupt(model) } : { model },
    Retried: () => model.runState._tag === "Failed"
      ? startRun({ ...model, runState: { _tag: "Idle" } }, latestUserPrompt(model), false)
      : { model },
    Reset: () => ({
      model: {
        ...init({ id: model.id, selectedModel: model.defaultModel }),
        nextRunNumber: model.nextRunNumber,
      },
    }),
    ScrolledTranscript: ({ scrollTop }) => ({
      model,
      commands: [MeasureFollowing({ id: transcriptId(model), scrollTop })],
    }),
    CompletedMeasureFollowing: ({ isFollowing }) => ({ model: { ...model, isFollowing } }),
    JumpedLatest: () => ({
      model: { ...model, isFollowing: true },
      commands: [ScrollLatest({ id: transcriptId(model) })],
    }),
    CompletedScrollLatest: () => ({ model }),
  });
