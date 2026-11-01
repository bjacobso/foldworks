import { Option } from "effect";
import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it, vi } from "vitest";
import * as Graph from "./graph";

const document: Graph.GraphDocument = {
  nodes: [
    { id: "group", data: { label: "Group" } },
    { id: "a", parentId: "group", data: { label: "A" } },
    { id: "b", parentId: "group", data: { label: "B" } },
    { id: "c", data: { label: "C" } },
  ],
  edges: [
    { id: "ab", source: { nodeId: "a" }, target: { nodeId: "b" }, data: { label: "Requires" } },
    { id: "bc", source: { nodeId: "b" }, target: { nodeId: "c" }, data: { tone: "info" } },
    { id: "ca", source: { nodeId: "c" }, target: { nodeId: "a" }, data: {} },
  ],
  annotations: [],
};
const h = inertHtml as unknown as HtmlBuilder<Graph.Message>;

describe("read-only graph", () => {
  it("explores cyclic neighborhoods without revisiting nodes", () => {
    expect([...Graph.neighborhoodIds(document, "a", 0)]).toEqual(["a"]);
    expect([...Graph.neighborhoodIds(document, "a", 1)]).toEqual(["a", "b", "c"]);
    expect(Graph.neighborhoodIds(document, "a", 20).size).toBe(3);
    expect(Graph.neighborhoodIds(document, "missing", 1).size).toBe(0);
  });
  it("collapses nested nodes, reroutes external edges, and retains selection on the parent", () => {
    const model = Graph.init({ id: "graph" });
    const selected = Graph.update(model, Graph.Message.SelectedNode({ id: "a" }), document).model;
    const collapsed = Graph.update(selected, Graph.Message.ToggledNode({ id: "group" }), document);
    const visible = Graph.visibleDocument(collapsed.model, document);
    expect(visible.nodes.map((node) => node.id)).toEqual(["group", "c"]);
    expect(visible.edges.map((edge) => [edge.source.nodeId, edge.target.nodeId])).toEqual([
      ["group", "c"],
      ["c", "group"],
    ]);
    expect(collapsed.model.canvas.selection).toEqual(["group"]);
    expect(collapsed.outMessage).toEqual(
      Graph.OutMessage.ChangedExpansion({ id: "group", isExpanded: false }),
    );
  });
  it("reports selection clearing from the canvas", () => {
    const selected = Graph.update(
      Graph.init({ id: "graph" }),
      Graph.Message.SelectedNode({ id: "a" }),
      document,
    ).model;
    const cleared = Graph.update(
      selected,
      Graph.Message.GotCanvasMessage({ message: { _tag: "SelectedElements", ids: [] } }),
      document,
    );
    expect(cleared.model.canvas.selection).toEqual([]);
    expect(cleared.outMessage).toEqual(Graph.OutMessage.ClearedSelection());
  });
  it("preserves ancestors while filtering a neighborhood", () => {
    const model = Graph.init({ id: "graph", focusId: "a", hops: 0 });
    expect(Graph.visibleDocument(model, document).nodes.map((node) => node.id)).toEqual([
      "group",
      "a",
    ]);
  });
  it("navigates along edges and siblings instead of moving nodes", () => {
    expect(Graph.navigationTarget(document, "a", "ArrowDown")).toBe("b");
    expect(Graph.navigationTarget(document, "b", "ArrowUp")).toBe("a");
    expect(Graph.navigationTarget(document, "a", "ArrowRight")).toBe("b");
    expect(Graph.navigationTarget(document, "a", "ArrowLeft")).toBeUndefined();
    const model = Graph.init({ id: "graph" });
    vi.stubGlobal("document", { querySelector: () => null });
    vi.stubGlobal("HTMLElement", class {});
    Scene.scene(
      {
        update: (model: Graph.Model, message: Graph.Message) =>
          Graph.update(model, message, document),
        view: (model: Graph.Model) =>
          Graph.view({ model, document, toParentMessage: (message) => message }, h),
      },
      Scene.given(model),
      Scene.keydown(Scene.selector('[data-graph-node="a"]'), "ArrowDown"),
      Scene.expectOutMessage(Graph.OutMessage.Selected({ id: "b" })),
    );
    vi.unstubAllGlobals();
    expect(document.nodes[1]?.position).toBeUndefined();
  });
  it("renders labeled edges and the same relations in an accessible list", () => {
    const html = Graph.view(
      { model: Graph.init({ id: "graph" }), document, toParentMessage: (message) => message },
      h,
    )!;
    expect(Scene.findAll(html, "[data-graph-list-node]")).toHaveLength(4);
    expect(Scene.textContent(html)).toContain("Requires: B");
    expect(Scene.findAll(html, "text").map((node) => Scene.textContent(node))).toContain(
      "Requires",
    );
    const focused = Graph.update(
      Graph.init({ id: "graph", collapsedIds: ["group"], focusId: "c" }),
      Graph.Message.RequestedFocus({ id: "a" }),
      document,
    ).model;
    expect(focused.collapsedIds).toEqual([]);
    expect(Option.getOrUndefined(focused.focusId)).toBe("a");
  });
});
