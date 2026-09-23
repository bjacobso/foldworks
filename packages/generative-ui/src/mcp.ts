import { Effect, Schema as S } from "effect";
import { McpServer, Tool, Toolkit } from "effect/unstable/ai";

import type { Catalog } from "./catalog";

export type McpRenderOptions = Readonly<{
  resourceUri: `ui://${string}`;
  title?: string;
  description?: string;
}>;

export const mcpAppMimeType = "text/html;profile=mcp-app";

export type McpAppResourceOptions = Readonly<{
  resourceUri: `ui://${string}`;
  html: string;
  name?: string;
  description?: string;
}>;

/** Register a self-contained MCP App iframe bundle as an Effect MCP resource. */
export const makeMcpAppResource = (options: McpAppResourceOptions) =>
  McpServer.resource({
    uri: options.resourceUri,
    name: options.name ?? "Generative UI",
    description: options.description ?? "Interactive generative UI renderer.",
    mimeType: mcpAppMimeType,
    content: Effect.succeed(options.html),
  });

/**
 * Build the MCP half of an MCP App: a render tool with typed structuredContent
 * linked to a separately bundled `text/html;profile=mcp-app` resource.
 */
export const makeMcpRenderToolkit = (catalog: Catalog, options: McpRenderOptions) => {
  const Result = S.Struct({ spec: catalog.schema });
  const renderUi = Tool.make("render_ui", {
    description:
      options.description ??
      "Render a validated interactive interface from the available component catalog.",
    parameters: Result,
    success: Result,
  })
    .annotate(Tool.Title, options.title ?? "Render interface")
    .annotate(Tool.Meta, { ui: { resourceUri: options.resourceUri } });
  const toolkit = Toolkit.make(renderUi);
  const handlers = toolkit.toLayer({
    render_ui: ({ spec }) => Effect.succeed({ spec }),
  });
  return { tool: renderUi, toolkit, handlers } as const;
};
