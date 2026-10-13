# @foldworks/generative-ui

Schema-first generative UI contracts and a safe Foldkit renderer. Agents produce
data, not code: an Effect Schema validates a flat component graph, and a
registry maps the allowed component names onto real Foldworks views.

This is an intentionally small first slice. It includes layout, content,
status, tables, buttons, and controlled text fields. It does not yet include
agent-defined HTML/CSS, remote scripts, arbitrary URLs, document-declared state,
repeat expressions, or streaming patches.

Use `@foldworks/generative-ui/core`, `/ai`, and `/mcp` in server code. The
`/foldworks` entry point includes browser UI components, and `/mcp-app` contains
the iframe-side MCP Apps bridge.

```sh
pnpm add @foldworks/generative-ui
```

## Define the application boundary

Actions belong to the host application. Declaring an action makes its name and
parameter schema available to generation and validation; it does not execute
anything.

```ts
import { createFoldworksCatalog, foldworksRegistry } from "@foldworks/generative-ui/foldworks";
import { render, validateSpec } from "@foldworks/generative-ui/core";
import { Result, Schema } from "effect";

const catalog = createFoldworksCatalog({
  inspect_customer: {
    description: "Open a customer record.",
    params: Schema.Struct({ customerId: Schema.String }),
  },
});

const decoded = validateSpec(catalog, unknownAgentOutput);
if (Result.isSuccess(decoded)) {
  return render(
    {
      spec: decoded.success,
      registry: foldworksRegistry(),
      toMessage: (intent) => Message.ReceivedUiAction({ intent }),
    },
    h,
  );
}
```

Validation is strict and checks catalog membership, component props, action
params, supported events, references, reachability, cycles, depth, node count,
fan-out, and string sizes.

## Controlled fields and typed intents

`TextInput` takes `label` and `value`, with optional `description`, `placeholder`,
and `disabled` props. Its `change` event fires on every edit with
`data: { value: string }`. The document's static `params` stay separate from
user event data. Declare the receiving action's `data` schema in the catalog:

```ts
import { validateActionIntent } from "@foldworks/generative-ui/core";

const catalog = createFoldworksCatalog({
  edit_note: {
    description: "Edit the local note draft.",
    params: Schema.Struct({}),
    data: Schema.Struct({ value: Schema.String }),
  },
});

// An element in a normal version-1 document:
const field = {
  type: "TextInput",
  props: { label: "Note", value: "Current draft" },
  children: [],
  on: { change: { action: "edit_note", params: {} } },
};

// In the host's Foldkit reducer:
const decoded = validateActionIntent(catalog, receivedIntent);
if (Result.isSuccess(decoded)) {
  const intent = decoded.success;
  // action, params, and data are inferred from this catalog.
  return { model: { ...model, note: intent.data.value } };
}
```

The host stores the new value and supplies it in the next document. Use a pure
presentation adapter to compose fixture or application data into concrete
props and static action params, then call `validateSpec` before rendering.
`toMessage` constructs a Foldkit message; domain work belongs in the host's
update/command handling. The renderer has no expression evaluator, state store,
network access, or action executor. An unbound text field is read-only; a
disabled field has no edit handler.

`catalog.intentSchema` and the exported `IntentFor<typeof catalog.actions>`
derive a discriminated action union from the same schemas. Actions declaring
`data` require it in received intents; actions without a data schema reject it.
`validateActionIntent` rejects excess properties and applies the default
4,000-character string limit, adjustable with `{ maxStringLength }`.
Bindings cannot supply event data. `validateSpec` validates static params and
event names; it does not prove that an action's data schema accepts a
component's emitted payload. Decode received intents to check that boundary.

Intent decoding validates shape, not authorization, element identity, event
origin, freshness, or whether a control was enabled. Hosts must check their own
policy and current domain state before executing requests. Keep all schemas
JSON-compatible when carrying documents and intents through transports.

Existing version-1 documents and button intents retain their shape. Adding a
text field requires a renderer/catalog that supports it. The MCP Apps bridge
can carry fields in complete specs and includes event data when sending an
intent; it does not maintain drafts or apply host responses automatically.

The demo's `/viewspec` route exercises search, selection, local drafts, empty
results, and host acceptance/refusal using hardcoded crew fixtures. It also
accepts prompts through `generate` with a mock Effect `LanguageModel` service.
Select a fixed response cassette to try valid layouts, generated host actions,
schema/graph failures, malformed JSON, and a provider error. These are local
mock responses; no live model interprets the prompt. Inspect the generated and
fixture documents and the last submitted intent in the playground. See the
[ViewSpec feature and ownership map](../../docs/viewspec.md) for the legacy
reference, adoption choices, and remaining gaps.

## Generate with Effect AI

`generate` uses the provider-neutral `LanguageModel` service from
`effect/unstable/ai`. The same Effect Schema sent to the model decodes its
structured output.

```ts
import { generate } from "@foldworks/generative-ui/ai";

const program = generate(catalog, {
  prompt: "Show the account status and an inspect action for cus_123",
});

// Supply any Effect LanguageModel layer at the application boundary.
```

## Carry it through MCP Apps

`makeMcpRenderToolkit` creates an Effect AI tool whose input and output are the
catalog-specific spec. It annotates the tool with the standard MCP Apps
`ui.resourceUri`, so Effect's MCP server exposes the UI as structured content.

```ts
import { makeMcpAppResource, makeMcpRenderToolkit } from "@foldworks/generative-ui/mcp";

const app = makeMcpRenderToolkit(catalog, {
  resourceUri: "ui://customers/foldworks.html",
});

const iframe = makeMcpAppResource({
  resourceUri: "ui://customers/foldworks.html",
  html: bundledHtml,
});
```

Register `app.toolkit` with Effect's `McpServer` and provide `app.handlers`.
Add `iframe` to the same Effect MCP server layer. `connectMcpApp` handles the
iframe handshake, host theme and safe-area context, and strict decoding of
`structuredContent.spec`. `sendActionIntent` returns renderer interactions to
the host as user messages; the iframe never executes domain actions itself.

The demo builds `apps/demo/dist/mcp-app.html` as a self-contained iframe bundle
with its JavaScript and CSS inlined. Its Foldkit runtime communicates with the
MCP bridge through Schema-typed ports.

Keeping the HTML resource separate is deliberate: the JSON protocol remains
useful inside the existing agent chat, over MCP, or over another transport.

## Why this shape

- Effect Schema is the single trust boundary for generation, storage, MCP tool
  input/output, and runtime decoding.
- The flat keyed graph is easy to stream or patch later without changing the
  component contract.
- Renderers are allowlists. Unknown components never become DOM.
- Actions are inert intents until the host maps them into its own update or
  permission flow.
- MCP is a transport and embedding boundary, not the UI domain model.

Further work includes additional controlled fields, bounded document-local
state and composition, and patch streaming. Streaming should follow after the
complete-spec path has agent-generation evals, accessibility checks, and
resource-budget telemetry.
