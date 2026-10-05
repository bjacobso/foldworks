import { Option } from "effect";
import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { Message, fromValue, init, update, view, visibleRows, type ValueNode } from "./value-tree";

const payload: ValueNode = {
  id: "$",
  preview: "{…} · 2 entries",
  kind: "record",
  children: [
    { id: "$/name", key: "name", preview: '"Ada"', kind: "string" },
    {
      id: "$/orders",
      key: "orders",
      preview: "list · 120 entries",
      kind: "list",
      expandable: true,
    },
  ],
};

const labels = (model: ReturnType<typeof init>, nodes: ReadonlyArray<ValueNode>) =>
  visibleRows(model, nodes).map((row) =>
    row._tag === "Value"
      ? `${"  ".repeat(row.level - 1)}${row.node.key ?? "root"}`
      : `${"  ".repeat(row.level - 1)}(${row._tag})`,
  );

describe("ValueTree", () => {
  it("asks for children it does not have, and shows them loading until they arrive", () => {
    const model = init({ id: "inspector", expandedIds: ["$"] });
    expect(labels(model, [payload])).toEqual(["root", "  name", "  orders"]);
    const opened = update(model, Message.Toggled({ id: "$/orders" }), { nodes: [payload] });
    expect(opened.outMessage).toEqual({ _tag: "RequestedChildren", id: "$/orders" });
    expect(labels(opened.model, [payload])).toEqual([
      "root",
      "  name",
      "  orders",
      "    (Loading)",
    ]);
    const loaded: ValueNode = {
      ...payload,
      children: [
        payload.children![0]!,
        {
          ...payload.children![1]!,
          children: [{ id: "$/orders/0", key: "0", preview: "#1042" }],
          more: 119,
        },
      ],
    };
    expect(labels(opened.model, [loaded])).toEqual([
      "root",
      "  name",
      "  orders",
      "    0",
      "    (More)",
    ]);
    expect(
      update(opened.model, Message.ClickedMore({ id: "$/orders" }), { nodes: [loaded] }).outMessage,
    ).toEqual({ _tag: "RequestedMore", id: "$/orders", loaded: 1 });
    // Collapsing and expanding again does not ask twice.
    const closed = update(opened.model, Message.Toggled({ id: "$/orders" }), {
      nodes: [loaded],
    }).model;
    expect(
      update(closed, Message.Toggled({ id: "$/orders" }), { nodes: [loaded] }).outMessage,
    ).toBeUndefined();
  });

  it("moves through visible rows and opens and closes with the arrow keys", () => {
    const nodes = [payload];
    let model = init({ id: "inspector" });
    const press = (key: string) => update(model, Message.Navigated({ key }), { nodes });
    model = press("ArrowRight").model;
    expect(model.expandedIds).toEqual(["$"]);
    model = press("ArrowRight").model;
    expect(model.activeId).toBe("$/name");
    model = press("ArrowDown").model;
    expect(press("ArrowRight").outMessage).toEqual({ _tag: "RequestedChildren", id: "$/orders" });
    model = press("ArrowLeft").model;
    expect(model.activeId).toBe("$");
    model = press("ArrowLeft").model;
    expect(model.expandedIds).toEqual([]);
  });

  it("builds nodes from plain values with paths for ids", () => {
    const root = fromValue({ name: "Ada", tags: new Set(["a"]), scores: [1, 2, 3, 4] }, "$", {
      limit: 3,
    });
    expect(root.preview).toBe("{…} · 3 entries");
    expect(root.children?.map((child) => `${child.id} ${child.preview}`)).toEqual([
      '$/name "Ada"',
      "$/tags set · 1 entry",
      "$/scores list · 4 entries",
    ]);
    expect(root.children?.[2]?.more).toBe(1);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(fromValue(cycle).children?.[0]?.preview).toBe("(circular)");
  });

  it("renders a tree with expansion state and kinds", () => {
    const html = view(
      {
        model: init({ id: "inspector", expandedIds: ["$"] }),
        nodes: [payload],
        label: "Payload",
        toParentMessage: (message) => message,
      },
      inertHtml as unknown as HtmlBuilder<Message>,
    );
    if (html === null) throw new Error("Expected tree HTML");
    expect(
      Scene.findAll(html, '[role="treeitem"]').map((node) =>
        Option.getOrUndefined(Scene.attr(node, "aria-label")),
      ),
    ).toEqual(["{…} · 2 entries", 'name: "Ada"', "orders: list · 120 entries"]);
    expect(
      Option.getOrUndefined(
        Scene.attr(
          Option.getOrThrow(Scene.find(html, '[data-value-node="$/orders"]')),
          "aria-expanded",
        ),
      ),
    ).toBe("false");
  });
});
