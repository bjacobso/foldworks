# @foldworks/generative-ui

Schema-first generative UI contracts and a safe Foldkit renderer. Agents produce
data, not code: an Effect Schema validates a flat component graph, and a
registry maps the allowed component names onto real Foldworks views.

This is an intentionally small first slice. It includes layout, content,
status, tables, and buttons. It does not yet include agent-defined HTML/CSS,
remote scripts, arbitrary URLs, mutable form state, repeat expressions, or
streaming patches.

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

The next useful step is patch streaming. It should follow after the
complete-spec path has agent-generation evals, accessibility checks, and
resource-budget telemetry.
