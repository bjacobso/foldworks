import { describe, expect, it } from "vitest";

import {
  ancestorIds,
  descendantIds,
  lowestCommonAncestor,
  topologicalOrder,
  validateDocument,
  wouldCreateCycle,
  type DiagramDocument,
} from "./document";
import { boundaryPoint, pathForPoints, polylineMidpoint, smoothPathForPoints } from "./geometry";
import { Diagram } from "./index";
import { createFreeformLayout, createLayeredLayout, feedbackEdges } from "./layout";
import { createDiagramOperations } from "./operations";
import { edgeAt, elementsInRect, nodeAt, relativePosition, toRelative } from "./scene";

type NodeData = Readonly<{ label: string; kind: "state" | "compound" }>;
type EdgeData = Readonly<{ event: string }>;

const document: DiagramDocument<NodeData, EdgeData> = {
  nodes: [
    { id: "idle", data: { label: "Idle", kind: "state" } },
    { id: "active", data: { label: "Active", kind: "compound" } },
    { id: "loading", parentId: "active", data: { label: "Loading", kind: "state" } },
    { id: "ready", parentId: "active", data: { label: "Ready", kind: "state" } },
    { id: "done", data: { label: "Done", kind: "state" } },
  ],
  edges: [
    {
      id: "start",
      source: { nodeId: "idle" },
      target: { nodeId: "loading" },
      data: { event: "START" },
    },
    {
      id: "loaded",
      source: { nodeId: "loading" },
      target: { nodeId: "ready" },
      data: { event: "LOADED" },
    },
    {
      id: "refresh",
      source: { nodeId: "ready" },
      target: { nodeId: "loading" },
      data: { event: "REFRESH" },
    },
    {
      id: "tick",
      source: { nodeId: "ready" },
      target: { nodeId: "ready" },
      data: { event: "TICK" },
    },
    {
      id: "finish",
      source: { nodeId: "active" },
      target: { nodeId: "done" },
      data: { event: "FINISH" },
    },
    {
      id: "reset",
      source: { nodeId: "done" },
      target: { nodeId: "idle" },
      data: { event: "RESET" },
    },
  ],
  annotations: [{ id: "note", data: { text: "Remember to retry." } }],
};

const size = () => ({ width: 120, height: 48 });

describe("diagram documents", () => {
  it("answers compound-graph queries", () => {
    expect(ancestorIds(document.nodes, "loading")).toEqual(["active"]);
    expect(descendantIds(document.nodes, "active")).toEqual(["loading", "ready"]);
    expect(lowestCommonAncestor(document.nodes, "loading", "ready")).toBe("active");
    expect(lowestCommonAncestor(document.nodes, "loading", "done")).toBeUndefined();
  });

  it("detects cycles without forbidding them", () => {
    expect(wouldCreateCycle(document.edges, "loading", "ready")).toBe(true);
    expect(wouldCreateCycle([], "a", "b")).toBe(false);
    expect(topologicalOrder(["idle", "loading", "ready"], document.edges)).toBeUndefined();
    expect(
      topologicalOrder(["a", "b"], [{ source: { nodeId: "a" }, target: { nodeId: "b" } }]),
    ).toEqual(["a", "b"]);
  });

  it("reports structural issues", () => {
    expect(validateDocument(document)).toEqual([]);
    const broken: DiagramDocument<NodeData, EdgeData> = {
      ...document,
      nodes: [
        ...document.nodes,
        { id: "orphan", parentId: "missing", data: { label: "?", kind: "state" } },
        { id: "a", parentId: "b", data: { label: "A", kind: "state" } },
        { id: "b", parentId: "a", data: { label: "B", kind: "state" } },
      ],
      edges: [
        ...document.edges,
        {
          id: "dangling",
          source: { nodeId: "idle", portId: "out" },
          target: { nodeId: "gone" },
          data: { event: "" },
        },
      ],
    };
    expect(validateDocument(broken).map((issue) => issue.code)).toEqual([
      "MissingParent",
      "ParentCycle",
      "ParentCycle",
      "MissingPort",
      "MissingEndpoint",
    ]);
  });
});

describe("diagram operations", () => {
  const operations = createDiagramOperations<NodeData, EdgeData, { text: string }>({
    canNest: (_document, _child, parent) => parent === undefined || parent.data.kind === "compound",
    canDelete: (node) => node.id !== "idle",
  });

  it("removes nodes with descendants and connected edges", () => {
    const next = operations.removeNode(document, "active");
    expect(next?.nodes.map((node) => node.id)).toEqual(["idle", "done"]);
    expect(next?.edges.map((edge) => edge.id)).toEqual(["reset"]);
    expect(operations.removeNode(document, "idle")).toBeUndefined();
  });

  it("reparents through the adapter policy and rejects cycles in nesting", () => {
    expect(
      operations
        .reparentNode(document, "done", "active", { x: 10, y: 10 })
        ?.nodes.find((node) => node.id === "done"),
    ).toMatchObject({ parentId: "active", position: { x: 10, y: 10 } });
    expect(operations.reparentNode(document, "done", "idle")).toBeUndefined();
    expect(operations.reparentNode(document, "active", "loading")).toBeUndefined();
    expect(
      operations
        .reparentNode(document, "loading", undefined)
        ?.nodes.find((node) => node.id === "loading")?.parentId,
    ).toBeUndefined();
  });

  it("validates connections against the policy", () => {
    const acyclic = createDiagramOperations<NodeData, EdgeData, { text: string }>({
      allowCycles: false,
      allowSelfLoops: false,
    });
    expect(
      operations.connectionRejection(document, { nodeId: "done" }, { nodeId: "done" }),
    ).toBeUndefined();
    expect(acyclic.connectionRejection(document, { nodeId: "done" }, { nodeId: "done" })).toBe(
      "SelfLoop",
    );
    expect(acyclic.connectionRejection(document, { nodeId: "ready" }, { nodeId: "loading" })).toBe(
      "Cycle",
    );
    expect(
      operations.connectionRejection(document, { nodeId: "idle", portId: "x" }, { nodeId: "done" }),
    ).toBe("MissingPort");
    expect(
      operations.addEdge(document, {
        id: "start",
        source: { nodeId: "idle" },
        target: { nodeId: "done" },
        data: { event: "DUPLICATE" },
      }),
    ).toBeUndefined();
  });

  it("translates unpinned nodes from their laid-out positions", () => {
    const moved = operations.translateElements(document, ["idle"], { x: 5, y: -5 }, () => ({
      x: 100,
      y: 100,
    }));
    expect(moved?.nodes[0]?.position).toEqual({ x: 105, y: 95 });
    expect(operations.clearPositions(moved ?? document).nodes[0]?.position).toBeUndefined();
  });
});

describe("diagram layouts", () => {
  const layered = createLayeredLayout<NodeData, EdgeData, { text: string }>({
    nodeSize: size,
    isContainer: (node) => node.data.kind === "compound",
    containerPadding: { top: 40, right: 20, bottom: 20, left: 20 },
  });

  it("lays out cyclic compound graphs with containers around their children", () => {
    const scene = layered(document);
    const active = scene.nodes.get("active");
    const loading = scene.nodes.get("loading");
    const ready = scene.nodes.get("ready");
    const idle = scene.nodes.get("idle");
    expect(active?.isContainer).toBe(true);
    expect(loading?.depth).toBe(1);
    for (const child of [loading, ready]) {
      expect(child?.x).toBeGreaterThanOrEqual(active?.x ?? 0);
      expect((child?.y ?? 0) + (child?.height ?? 0)).toBeLessThanOrEqual(
        (active?.y ?? 0) + (active?.height ?? 0),
      );
    }
    // The cycle idle → active → done → idle is broken so ranks still descend.
    expect(idle?.y).toBeLessThan(active?.y ?? 0);
    expect(loading?.y).toBeLessThan(ready?.y ?? 0);
    expect(scene.edges.find((edge) => edge.id === "tick")?.isSelfLoop).toBe(true);
    // Opposing edges between loading and ready bend apart.
    const loaded = scene.edges.find((edge) => edge.id === "loaded");
    const refresh = scene.edges.find((edge) => edge.id === "refresh");
    expect(loaded?.points).toHaveLength(3);
    expect(loaded?.points[1]).not.toEqual(refresh?.points[1]);
    expect(scene.annotations[0]?.x).toBeGreaterThan(0);
  });

  it("keeps pinned positions relative to the parent", () => {
    const pinned = {
      ...document,
      nodes: document.nodes.map((node) =>
        node.id === "ready" ? { ...node, position: { x: 300, y: 10 } } : node,
      ),
    };
    const scene = layered(pinned);
    const active = scene.nodes.get("active");
    expect(scene.nodes.get("ready")).toMatchObject({
      x: (active?.x ?? 0) + 20 + 300,
      y: (active?.y ?? 0) + 40 + 10,
    });
    expect(active?.width).toBeGreaterThanOrEqual(20 + 300 + 120 + 20);
    expect(relativePosition(scene, "ready")).toEqual({ x: 300, y: 10 });
  });

  it("reverses only feedback edges", () => {
    expect([
      ...feedbackEdges(
        ["a", "b", "c"],
        [
          { id: "ab", source: "a", target: "b" },
          { id: "bc", source: "b", target: "c" },
          { id: "ca", source: "c", target: "a" },
        ],
      ),
    ]).toEqual(["ca"]);
  });

  it("places freeform nodes and supports hit testing", () => {
    const freeform = createFreeformLayout<NodeData, EdgeData, { text: string }>({
      nodeSize: size,
      isContainer: (node) => node.data.kind === "compound",
    });
    const scene = freeform({
      ...document,
      nodes: document.nodes.map((node, index) => ({
        ...node,
        position: { x: index * 10, y: index * 200 },
      })),
    });
    const loading = scene.nodes.get("loading");
    expect(loading).toBeDefined();
    const inside = { x: (loading?.x ?? 0) + 5, y: (loading?.y ?? 0) + 5 };
    expect(nodeAt(scene, inside)?.id).toBe("loading");
    expect(nodeAt(scene, inside, { exclude: new Set(["active"]) })).toBeUndefined();
    expect(nodeAt(scene, inside, { filter: (node) => node.isContainer })?.id).toBe("active");
    expect(toRelative(scene, "active", inside)).toEqual({ x: 2 * 10 + 5, y: 2 * 200 + 5 });
    const edge = scene.edges.find((candidate) => candidate.id === "finish");
    const middle = edge === undefined ? undefined : polylineMidpoint(edge.points);
    expect(middle === undefined ? undefined : edgeAt(scene, middle)?.id).toBe("finish");
    expect(elementsInRect(scene, scene.bounds)).toContain("note");
  });
});

describe("diagram geometry", () => {
  it("clips to rectangle boundaries and draws paths", () => {
    expect(boundaryPoint({ x: 0, y: 0, width: 100, height: 50 }, { x: 200, y: 25 })).toEqual({
      x: 100,
      y: 25,
    });
    expect(
      pathForPoints([
        { x: 0, y: 0 },
        { x: 0, y: 20 },
      ]),
    ).toBe("M 0 0 L 0 20");
    expect(
      smoothPathForPoints([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 },
      ]),
    ).toMatch(/^M 0 0 C .* C .* 20 0$/);
  });
});

describe("diagram interaction", () => {
  const model = Diagram.init({ id: "canvas" });
  const press = Diagram.Message.PressedElement({
    id: "idle",
    isMovable: true,
    clientX: 100,
    clientY: 100,
    anchorX: 60,
    anchorY: 24,
  });

  it("selects on click without moving", () => {
    const pressed = Diagram.update(model, press).model;
    const released = Diagram.update(pressed, Diagram.Message.ReleasedPointer());
    expect(released.model.selection).toEqual(["idle"]);
    expect(released.outMessage).toEqual(Diagram.OutMessage.Clicked({ id: "idle" }));
  });

  it("lets the innermost element claim a bubbled press", () => {
    const pressed = Diagram.update(model, press).model;
    const bubbled = Diagram.update(
      pressed,
      Diagram.Message.PressedElement({
        id: "active",
        isMovable: true,
        clientX: 100,
        clientY: 100,
        anchorX: 0,
        anchorY: 0,
      }),
    ).model;
    const canvas = Diagram.update(
      bubbled,
      Diagram.Message.PressedCanvas({ clientX: 100, clientY: 100 }),
    ).model;
    expect(canvas.gesture).toMatchObject({ _tag: "Pressing", primaryId: "idle" });
  });

  it("drags in world units and reports the drop point", () => {
    const zoomed = { ...model, viewport: { x: 0, y: 0, zoom: 2 } };
    const pressed = Diagram.update(zoomed, press).model;
    const dragging = Diagram.update(
      pressed,
      Diagram.Message.MovedPointer({ clientX: 140, clientY: 120 }),
    );
    expect(dragging.outMessage).toEqual(Diagram.OutMessage.ChangedSelection({ ids: ["idle"] }));
    expect(Diagram.maybeDragPreview(dragging.model)).toMatchObject({
      _tag: "Some",
      value: { delta: { x: 20, y: 10 }, drop: { x: 80, y: 34 } },
    });
    const dropped = Diagram.update(dragging.model, Diagram.Message.ReleasedPointer());
    expect(dropped.outMessage).toMatchObject({
      _tag: "MovedElements",
      ids: ["idle"],
      deltaX: 20,
      deltaY: 10,
      dropX: 80,
      dropY: 34,
    });
    expect(dropped.model.gesture._tag).toBe("Idle");
  });

  it("previews and requests connections from ports", () => {
    const pressed = Diagram.update(
      model,
      Diagram.Message.PressedPort({
        source: { nodeId: "idle" },
        clientX: 0,
        clientY: 0,
        anchorX: 10,
        anchorY: 10,
      }),
    ).model;
    const moved = Diagram.update(
      pressed,
      Diagram.Message.MovedPointer({ clientX: 50, clientY: 30 }),
    ).model;
    expect(Diagram.maybeConnectionPreview(moved)).toMatchObject({
      _tag: "Some",
      value: { from: { x: 10, y: 10 }, to: { x: 60, y: 40 } },
    });
    expect(Diagram.update(moved, Diagram.Message.ReleasedPointer()).outMessage).toEqual(
      Diagram.OutMessage.RequestedConnection({ source: { nodeId: "idle" }, x: 60, y: 40 }),
    );
  });

  it("pans the viewport and clears selection on a background click", () => {
    const selected = Diagram.select(model, ["idle"]);
    const pressed = Diagram.update(
      selected,
      Diagram.Message.PressedCanvas({ clientX: 0, clientY: 0 }),
    ).model;
    const clicked = Diagram.update(pressed, Diagram.Message.ReleasedPointer());
    expect(clicked.model.selection).toEqual([]);
    const panned = Diagram.update(
      pressed,
      Diagram.Message.MovedPointer({ clientX: 30, clientY: -20 }),
    ).model;
    expect(panned.viewport).toMatchObject({ x: 30, y: -20 });
    expect(Diagram.update(panned, Diagram.Message.ReleasedPointer()).model.selection).toEqual([
      "idle",
    ]);
  });

  it("nudges and deletes the selection from the keyboard", () => {
    const selected = Diagram.select(model, ["idle", "done"]);
    expect(
      Diagram.update(
        selected,
        Diagram.Message.PressedElementKey({
          id: "idle",
          key: "ArrowRight",
          shiftKey: true,
        }),
      ).outMessage,
    ).toMatchObject({ _tag: "MovedElements", ids: ["idle", "done"], deltaX: 10, isKeyboard: true });
    expect(
      Diagram.update(
        selected,
        Diagram.Message.PressedElementKey({
          id: "idle",
          key: "Delete",
          shiftKey: false,
        }),
      ).outMessage,
    ).toEqual(Diagram.OutMessage.RequestedDelete({ ids: ["idle", "done"] }));
  });

  it("zooms around a focus point and fits bounds", () => {
    expect(Diagram.zoomAt({ x: 0, y: 0, zoom: 1 }, 2, { x: 100, y: 100 })).toEqual({
      x: -100,
      y: -100,
      zoom: 2,
    });
    expect(
      Diagram.fitViewport({ x: 0, y: 0, width: 400, height: 200 }, { width: 500, height: 300 }, 50),
    ).toEqual({ zoom: 1, x: 50, y: 50 });
  });
});
