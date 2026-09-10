# @foldworks/agent

A controlled, provider-neutral agent conversation runtime for Foldkit applications.

The package owns a serializable transcript and run model, normalized streaming
events, ordered event reduction, tool input/result states, permission checkpoints,
cancellation, retry, model selection, and transcript-following commands. The host
application owns provider calls, credentials, tools, persistence, and presentation.

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

`Agent.ModelSelect` is the styled Foldworks select submodel used by the reference
demo. Model options and all rendering remain application-owned so providers and
product presentation are not encoded in the serializable runtime.

The browser demo at `/agent` supplies a deterministic Effect stream and a complete
conversation surface. It performs no provider calls or tool side effects.
