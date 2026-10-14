import { Context, Option, Result, Schema as S } from "effect";
import { Tool } from "effect/ai";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  catalogPrompt,
  createFoldworksCatalog,
  decodeMcpAppSpec,
  foldworksRegistry,
  makeMcpRenderToolkit,
  render,
  validateSpec,
  validateActionIntent,
  type ActionIntent,
  type Spec,
} from "./index";

const catalog = createFoldworksCatalog({
  inspect_customer: {
    description: "Open a customer record for inspection.",
    params: S.Struct({ customerId: S.String }),
  },
});

describe("controlled text input", () => {
  const editableCatalog = createFoldworksCatalog({
    edit: {
      description: "Edit a local draft.",
      params: S.Struct({ field: S.Literal("note") }),
      data: S.Struct({ value: S.String }),
    },
    save: { description: "Request a save.", params: S.Struct({ note: S.String }) },
  });
  const inputSpec = (value: string): Spec => ({
    version: "1",
    root: "note",
    elements: {
      note: {
        type: "TextInput",
        props: { label: "Note", value },
        children: [],
        on: { change: { action: "edit", params: { field: "note" } } },
      },
    },
  });
  const editIntent = {
    action: "edit",
    elementId: "note",
    event: "change",
    params: { field: "note" },
    data: { value: "next" },
  };

  it("keeps bindings static and validates field props and events", () => {
    expect(Result.isSuccess(validateSpec(editableCatalog, inputSpec("before")))).toBe(true);
    for (const mutation of [
      { props: { label: "Note", value: 42 } },
      { props: { label: "Note", value: "", html: "<script>" } },
      { on: { submit: { action: "edit", params: { field: "note" } } } },
      { on: { change: { action: "edit", params: { field: "note" }, data: { value: "forged" } } } },
    ]) {
      const spec = inputSpec("");
      expect(
        Result.isFailure(
          validateSpec(editableCatalog, {
            ...spec,
            elements: { note: { ...spec.elements.note, ...mutation } },
          }),
        ),
      ).toBe(true);
    }
  });

  it("decodes a discriminated host intent and rejects undeclared or malformed event data", () => {
    const decoded = validateActionIntent(editableCatalog, editIntent);
    if (Result.isFailure(decoded)) throw new Error("Expected valid intent");
    const intent = decoded.success;
    if (intent.action !== "edit") throw new Error("Expected edit intent");
    expectTypeOf(intent.params).toEqualTypeOf<{ readonly field: "note" }>();
    expectTypeOf(intent.data).toEqualTypeOf<{ readonly value: string }>();
    expect(intent.data.value).toBe("next");
    for (const input of [
      { ...editIntent, action: "unknown" },
      { ...editIntent, params: { field: "other" } },
      { ...editIntent, data: undefined },
      { ...editIntent, data: { value: 42 } },
      { ...editIntent, data: { value: "next", execute: "script" } },
      {
        action: "save",
        elementId: "save",
        event: "press",
        params: { note: "ok" },
        data: { value: "extra" },
      },
    ])
      expect(Result.isFailure(validateActionIntent(editableCatalog, input))).toBe(true);
    expect(
      Result.isSuccess(
        validateActionIntent(editableCatalog, {
          action: "save",
          elementId: "save",
          event: "press",
          params: { note: "ok" },
        }),
      ),
    ).toBe(true);
    const oversized = validateActionIntent(
      editableCatalog,
      { ...editIntent, data: { value: "x".repeat(13) } },
      { maxStringLength: 12 },
    );
    if (Result.isSuccess(oversized)) throw new Error("Expected oversized event data to fail");
    expect(oversized.failure).toContainEqual({
      code: "limit-exceeded",
      message: "String is longer than 12 characters.",
      path: "intent.data.value",
    });
  });

  it("emits edits without overwriting static params and renders the host's updated value", () => {
    Scene.scene(
      {
        view: (model: { value: string; last: ActionIntent | null }, builder) =>
          render(
            {
              spec: inputSpec(model.value),
              registry: foldworksRegistry<ActionIntent>(),
              toMessage: (intent) => intent,
            },
            builder,
          ),
        update: (_model: { value: string; last: ActionIntent | null }, intent: ActionIntent) => {
          const result = validateActionIntent(editableCatalog, intent);
          if (Result.isFailure(result) || result.success.action !== "edit")
            throw new Error("Invalid edit");
          expect(intent).toEqual({ ...editIntent, data: { value: "next" } });
          return { model: { value: result.success.data.value, last: intent } };
        },
      },
      Scene.given({ value: "before", last: null }),
      Scene.type(Scene.role("textbox"), "next"),
      Scene.expect(Scene.role("textbox")).toHaveAttr("value", "next"),
    );
  });

  it("renders unbound fields read-only and disabled fields without an edit handler", () => {
    for (const mode of ["unbound", "disabled"] as const) {
      const spec = inputSpec("fixed");
      const node = spec.elements.note!;
      const html = render(
        {
          spec: {
            ...spec,
            elements: {
              note: {
                ...node,
                props: { ...node.props, ...(mode === "disabled" ? { disabled: true } : {}) },
                ...(mode === "unbound" ? { on: {} } : {}),
              },
            },
          },
          registry: foldworksRegistry<never>(),
          toMessage: () => {
            throw new Error("Unexpected intent");
          },
        },
        h,
      );
      const input = find(html, "input");
      expect(input.data?.props?.[mode === "unbound" ? "readOnly" : "disabled"]).toBe(true);
      expect(input.data?.on?.input).toBeUndefined();
    }
  });

  it("includes host event-data schemas in generation instructions and decodes fields over MCP", () => {
    expect(catalogPrompt(editableCatalog)).toContain('"data"');
    expect(
      Result.isSuccess(
        decodeMcpAppSpec(editableCatalog, { structuredContent: { spec: inputSpec("") } }),
      ),
    ).toBe(true);
  });
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
