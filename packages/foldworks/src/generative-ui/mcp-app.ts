import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import { Result } from "effect";

import type { Catalog } from "./catalog";
import type { ActionIntent, Spec, ValidationIssue } from "./model";
import { validateSpec } from "./validate";

export type McpAppResult = Readonly<{
  isError?: boolean | undefined;
  structuredContent?: unknown;
}>;

export type McpAppBridgeOptions = Readonly<{
  catalog: Catalog;
  name: string;
  version: string;
  onSpec: (spec: Spec) => void;
  onError: (message: string) => void;
  onHostContext?: (context: McpUiHostContext) => void;
  onTeardown?: () => void | Promise<void>;
}>;

const formatIssues = (issues: ReadonlyArray<ValidationIssue>): string =>
  issues
    .map((issue) => `${issue.path === undefined ? "spec" : issue.path}: ${issue.message}`)
    .join("\n");

/** Extract and validate `structuredContent.spec` from an MCP tool result. */
export const decodeMcpAppSpec = (
  catalog: Catalog,
  result: McpAppResult,
): Result.Result<Spec, string> => {
  if (result.isError === true) return Result.fail("The render_ui tool returned an error.");
  const structured = result.structuredContent;
  if (structured === null || typeof structured !== "object" || !("spec" in structured)) {
    return Result.fail("The render_ui result did not include structuredContent.spec.");
  }
  const validated = validateSpec(catalog, structured.spec);
  return Result.isSuccess(validated)
    ? Result.succeed(validated.success)
    : Result.fail(formatIssues(validated.failure));
};

const applyHostContext = (context: McpUiHostContext): void => {
  if (context.theme !== undefined) applyDocumentTheme(context.theme);
  if (context.styles?.variables !== undefined) applyHostStyleVariables(context.styles.variables);
  if (context.styles?.css?.fonts !== undefined) applyHostFonts(context.styles.css.fonts);
  const insets = context.safeAreaInsets;
  if (insets !== undefined) {
    const root = document.documentElement.style;
    root.setProperty("--mcp-safe-area-top", `${insets.top}px`);
    root.setProperty("--mcp-safe-area-right", `${insets.right}px`);
    root.setProperty("--mcp-safe-area-bottom", `${insets.bottom}px`);
    root.setProperty("--mcp-safe-area-left", `${insets.left}px`);
  }
};

/**
 * Connect a catalog renderer to an MCP Apps host. Handlers are installed before
 * the handshake so the initial one-shot tool result cannot be missed.
 */
export const connectMcpApp = async (options: McpAppBridgeOptions): Promise<App> => {
  const app = new App({ name: options.name, version: options.version }, {}, { strict: true });
  app.addEventListener("toolresult", (result) => {
    const decoded = decodeMcpAppSpec(options.catalog, result);
    if (Result.isSuccess(decoded)) options.onSpec(decoded.success);
    else options.onError(decoded.failure);
  });
  app.addEventListener("hostcontextchanged", (context) => {
    applyHostContext(context);
    options.onHostContext?.(context);
  });
  app.onteardown = async () => {
    await options.onTeardown?.();
    return {};
  };
  await app.connect();
  const context = app.getHostContext();
  if (context !== undefined) {
    applyHostContext(context);
    options.onHostContext?.(context);
  }
  return app;
};

/** Ask the host/model to handle a renderer-emitted intent; the iframe never mutates domain state. */
export const sendActionIntent = (app: App, intent: ActionIntent) =>
  app.sendMessage({
    role: "user",
    content: [
      {
        type: "text",
        text: `Handle this generative UI action intent:\n${JSON.stringify(intent)}`,
      },
    ],
  });
