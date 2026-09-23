import { Context, Option, Result, Schema as S } from "effect";
import { Tool } from "effect/unstable/ai";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import {
  catalogPrompt,
  createFoldworksCatalog,
  decodeMcpAppSpec,
  foldworksRegistry,
  makeMcpRenderToolkit,
  render,
  validateSpec,
} from "./index";

const catalog = createFoldworksCatalog({
  inspect_customer: {
    description: "Open a customer record for inspection.",
    params: S.Struct({ customerId: S.String }),
  },
});

const spec = {
  version: "1" as const,
  root: "card",
  elements: {
    card: { type: "Card", props: { title: "Account" }, children: ["stack"] },
    stack: { type: "Stack", props: { gap: "sm" }, children: ["status", "button"] },
    status: { type: "Badge", props: { label: "Active", tone: "success" }, children: [] },
    button: {
      type: "Button",
      props: { label: "Inspect" },
      children: [],
      on: { press: { action: "inspect_customer", params: { customerId: "cus_123" } } },
    },
  },
};

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

describe("generative UI", () => {
  it("decodes a catalog-constrained component graph", () => {
    const result = validateSpec(catalog, spec);
    expect(Result.isSuccess(result)).toBe(true);
  });

  it("rejects unknown components and actions at the schema boundary", () => {
    const badComponent = structuredClone(spec);
    badComponent.elements.status.type = "Script";
    expect(Result.isFailure(validateSpec(catalog, badComponent))).toBe(true);

    const badAction = structuredClone(spec);
    badAction.elements.button.on!.press!.action = "delete_everything";
    expect(Result.isFailure(validateSpec(catalog, badAction))).toBe(true);
  });

  it("rejects missing references, cycles, and unsupported events", () => {
    const invalid = structuredClone(spec);
    invalid.elements.stack.children = ["card", "missing"];
    (
      invalid.elements.button as {
        on: Record<string, { action: string; params: { customerId: string } }>;
      }
    ).on = {
      change: invalid.elements.button.on!.press!,
    };
    const result = validateSpec(catalog, invalid);
    if (Result.isSuccess(result)) throw new Error("Expected validation failure");
    expect(result.failure.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["cycle", "missing-child", "unsupported-event"]),
    );
  });

  it("renders registered Foldworks components", () => {
    const html = render(
      {
        spec,
        registry: foldworksRegistry<never>(),
        toMessage: () => undefined as never,
      },
      h,
    );
    expect(find(html, "section")).toBeDefined();
    expect(find(html, "button")).toBeDefined();
  });

  it("derives generation instructions from the same schemas", () => {
    const prompt = catalogPrompt(catalog);
    expect(prompt).toContain("inspect_customer");
    expect(prompt).toContain("customerId");
    expect(prompt).toContain("Button");
  });

  it("creates an Effect MCP tool linked to an MCP Apps resource", () => {
    const app = makeMcpRenderToolkit(catalog, {
      resourceUri: "ui://customers/foldworks.html",
    });
    expect(app.tool.name).toBe("render_ui");
    expect(Context.getUnsafe(app.tool.annotations, Tool.Meta)).toEqual({
      ui: { resourceUri: "ui://customers/foldworks.html" },
    });
    expect(Tool.getJsonSchema(app.tool)).toMatchObject({ type: "object" });
    expect(Tool.getJsonSchemaFromSchema(app.tool.successSchema)).toMatchObject({ type: "object" });
  });

  it("decodes the iframe spec from MCP structured content", () => {
    const result = decodeMcpAppSpec(catalog, { structuredContent: { spec } });
    expect(Result.isSuccess(result)).toBe(true);
    expect(
      Result.isFailure(decodeMcpAppSpec(catalog, { structuredContent: { value: spec } })),
    ).toBe(true);
  });

  it("turns declared events into inert host-owned action intents", () => {
    let intent: unknown;
    render(
      {
        spec: {
          version: "1",
          root: "button",
          elements: { button: spec.elements.button },
        },
        registry: {
          Button: (context, builder) => {
            context.emit("press");
            return builder.button([], ["Inspect"]);
          },
        },
        toMessage: (next) => {
          intent = next;
          return undefined as never;
        },
      },
      h,
    );
    expect(intent).toEqual({
      action: "inspect_customer",
      elementId: "button",
      event: "press",
      params: { customerId: "cus_123" },
    });
  });
});
