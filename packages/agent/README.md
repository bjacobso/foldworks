# @foldworks/agent

A provider-neutral agent conversation runtime and set of Foldkit UI components.

The package owns a serializable transcript and run model, normalized streaming
events, ordered event reduction, tool input/result states, permission checkpoints,
cancellation, retry, model selection, and transcript-following commands. The host
application owns provider calls, credentials, tools, and persistence.

```sh
pnpm add @foldworks/agent
```

```ts
import { Agent } from "@foldworks/agent";

const agent = Agent.init({
  id: "support-agent",
  selectedModel: "fast-model",
});

const withPrompt = Agent.update(
  agent,
  Agent.Message.ChangedDraft({ value: "Summarize this account" }),
).model;
const running = Agent.update(withPrompt, Agent.Message.Submitted()).model;

const next = Agent.update(
  running,
  Agent.Message.ReceivedStreamEvent({
    envelope: {
      sequence: 1,
      event: {
        _tag: "TextStarted",
        runId: "support-agent-run-1",
        partId: "answer",
      },
    },
  }),
);
```

## Agent chat UI

`Agent.Chat` assembles the runtime into a complete conversation surface. It
includes model selection, run status, the transcript, streamed text, tool calls,
permission decisions, failure recovery, transcript following, and the composer.

```ts
Agent.Chat.view({
  model,
  models: [
    {
      id: "fast-model",
      label: "Fast model",
      provider: "Example provider",
      description: "Fast answers for everyday work",
    },
  ],
  toParentMessage: (message) => Message.GotAgentMessage({ message }),
  empty: {
    title: "What can I help with?",
    suggestion: {
      label: "Summarize this account",
      prompt: "Summarize this account",
    },
  },
}, h)
```

For product-specific rendering, pass `renderText` for completed assistant text
or customize permission details with `permission.renderDetails`. The package
does not require a Markdown parser or make assumptions about tool input.

Every part is also exported for custom layouts: `Agent.SessionBar`,
`Agent.Transcript`, `Agent.ConversationTurn`, `Agent.TextResponse`,
`Agent.ToolCall`, `Agent.PermissionRequest`, `Agent.EmptyState`, and
`Agent.Composer`. Each component accepts a typed config and a Foldkit
`HtmlBuilder`; state-changing components either accept `toParentMessage` or a
focused callback.

Add `Agent.Model` to the parent model schema and `Agent.Message` to its message
union. Fold updates through `Update.foldChild` as usual. A host subscription can
watch `model.runState`: `Streaming` provides the run ID, continuation segment,
and last accepted sequence, while `Agent.latestUserPrompt(model)` supplies the
prompt. Map provider-specific stream parts into `Agent.StreamEvent` envelopes and
dispatch `ReceivedStreamEvent`.

Sequence numbers must increase across the complete run. Duplicate, stale, and
wrong-run events are ignored. A `PermissionRequested` event pauses the run until
the host or view dispatches `ChosePermission`; the resulting `Approved` or
`Denied` segment lets a subscription continue the transport. `Stopped` marks
unfinished transcript parts as interrupted or cancelled. `Retried` starts a new
run with the latest user prompt and a new stable run ID.

`Agent.ModelSelect` remains available for fully custom session headers. Model
options and presentation configuration stay outside the serializable runtime.

The browser demo at `/agent` uses `Agent.Chat` with a Markdown renderer and a
deterministic Effect stream. It performs no provider calls or tool side effects.
