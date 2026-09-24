import { describe, expect, it } from "vitest";

import { Diagram, validateDocument } from "@foldworks/diagram";

import {
  enabledTransitions,
  findMachine,
  initialConfiguration,
  layoutMachine,
  lintMachine,
  operations,
  takeTransition,
  type MachineDocument,
} from "./machine";
import { Message } from "./message";
import { init } from "./model";
import { sampleLibrary } from "./sample";
import { currentDocument, update } from "./update";

const checkout = findMachine(sampleLibrary, "checkout")?.document as MachineDocument;
const fire = (configuration: ReadonlyArray<string>, edgeId: string) =>
  takeTransition(checkout, configuration, edgeId);

describe("statechart adapter", () => {
  it("ships structurally valid, lint-clean sample machines", () => {
    for (const machine of sampleLibrary.machines) {
      expect(validateDocument(machine.document)).toEqual([]);
      expect(lintMachine(sampleLibrary, machine)).toEqual([]);
    }
  });

  it("enters compound and parallel states through their initial states", () => {
    expect(initialConfiguration(checkout)).toEqual(["cart"]);
    expect(fire(["cart"], "t-checkout")).toEqual(["shipping"]);
    expect(fire(["payment"], "t-paid")).toEqual(["picking", "emailing"]);
  });

  it("keeps sibling regions active and lets outer transitions exit nested states", () => {
    expect(fire(["picking", "emailing"], "t-packed")).toEqual(["emailing", "packed"]);
    expect(fire(["picking", "emailing"], "t-retry-email")).toEqual(["picking", "emailing"]);
    // EDIT_CART is declared on Details and applies while Billing is active.
    expect(enabledTransitions(checkout, ["billing"]).map((edge) => edge.id)).toEqual(
      expect.arrayContaining(["t-back", "t-pay", "t-edit-cart"]),
    );
    expect(fire(["billing"], "t-edit-cart")).toEqual(["cart"]);
  });

  it("enforces statechart nesting and connection rules", () => {
    expect(operations.reparentNode(checkout, "cart", "shipping")).toBeUndefined();
    expect(operations.reparentNode(checkout, "cart", "fulfilment")).toBeUndefined();
    expect(operations.reparentNode(checkout, "cart", "details")).toBeDefined();
    expect(
      operations.connectionRejection(checkout, { nodeId: "complete" }, { nodeId: "cart" }),
    ).toBe("Policy");
    expect(operations.connectionRejection(checkout, { nodeId: "cart" }, { nodeId: "start" })).toBe(
      "Policy",
    );
    expect(
      operations.connectionRejection(checkout, { nodeId: "cart" }, { nodeId: "cart" }),
    ).toBeUndefined();
  });

  it("lays out containers around nested states in both directions", () => {
    for (const direction of ["Down", "Right"] as const) {
      const scene = layoutMachine(checkout, direction);
      const details = scene.nodes.get("details");
      const billing = scene.nodes.get("billing");
      expect(details?.isContainer).toBe(true);
      expect(billing?.x).toBeGreaterThan(details?.x ?? Infinity);
      expect((billing?.y ?? 0) + (billing?.height ?? 0)).toBeLessThan(
        (details?.y ?? 0) + (details?.height ?? 0),
      );
      expect(scene.edges.find((edge) => edge.id === "t-add")?.isSelfLoop).toBe(true);
    }
  });
});

describe("statechart editor update", () => {
  const canvas = (model: ReturnType<typeof init>, message: Diagram.Message) =>
    update(model, Message.GotCanvasMessage({ message })).model;

  it("creates a transition from a dragged handle and undoes it", () => {
    const model = init();
    const scene = layoutMachine(currentDocument(model), model.direction);
    const cart = scene.nodes.get("cart");
    const billing = scene.nodes.get("billing");
    if (cart === undefined || billing === undefined) throw new Error("Missing states.");
    const pressed = canvas(
      model,
      Diagram.Message.PressedPort({
        source: { nodeId: "cart" },
        clientX: 0,
        clientY: 0,
        anchorX: cart.x,
        anchorY: cart.y,
      }),
    );
    const zoom = pressed.canvas.viewport.zoom;
    const moved = canvas(
      pressed,
      Diagram.Message.MovedPointer({
        clientX: (billing.x + 10 - cart.x) * zoom,
        clientY: (billing.y + 10 - cart.y) * zoom,
      }),
    );
    const connected = canvas(moved, Diagram.Message.ReleasedPointer());
    const added = currentDocument(connected).edges.at(-1);
    expect(added).toMatchObject({ source: { nodeId: "cart" }, target: { nodeId: "billing" } });
    expect(connected.canvas.selection).toEqual([added?.id]);

    const undone = update(connected, Message.ClickedUndo()).model;
    expect(currentDocument(undone).edges).toHaveLength(currentDocument(model).edges.length);
  });

  it("reparents a dropped state into a compound state", () => {
    const model = init();
    const scene = layoutMachine(currentDocument(model), model.direction);
    const cancelled = scene.nodes.get("cancelled");
    const details = scene.nodes.get("details");
    if (cancelled === undefined || details === undefined) throw new Error("Missing states.");
    const target = { x: details.x + details.width - 30, y: details.y + details.height - 30 };
    const anchor = { x: cancelled.x + cancelled.width / 2, y: cancelled.y + cancelled.height / 2 };
    const zoom = model.canvas.viewport.zoom;
    const pressed = canvas(
      model,
      Diagram.Message.PressedElement({
        id: "cancelled",
        isMovable: true,
        clientX: 0,
        clientY: 0,
        anchorX: anchor.x,
        anchorY: anchor.y,
      }),
    );
    const dragged = canvas(
      pressed,
      Diagram.Message.MovedPointer({
        clientX: (target.x - anchor.x) * zoom,
        clientY: (target.y - anchor.y) * zoom,
      }),
    );
    const dropped = canvas(dragged, Diagram.Message.ReleasedPointer());
    const node = currentDocument(dropped).nodes.find((candidate) => candidate.id === "cancelled");
    expect(node?.parentId).toBe("details");
    expect(node?.position?.x).toBeGreaterThanOrEqual(0);
    expect(dropped.announcement).toBe("Cancelled moved into Details.");
  });

  it("adds new states inside the selected container and opens submachines", () => {
    const selected = { ...init(), canvas: Diagram.select(init().canvas, ["details"]) };
    const added = update(selected, Message.ClickedAddState({ kind: "atomic" })).model;
    const [newId] = added.canvas.selection;
    expect(currentDocument(added).nodes.find((node) => node.id === newId)?.parentId).toBe(
      "details",
    );

    const opened = update(added, Message.ClickedOpenSubmachine({ stateId: "payment" })).model;
    expect(opened.path).toEqual(["checkout", "payment"]);
    expect(update(opened, Message.ClickedBreadcrumb({ index: 0 })).model.path).toEqual([
      "checkout",
    ]);
  });

  it("fires enabled transitions only while simulating", () => {
    const simulating = update(init(), Message.SelectedMode({ mode: "Simulate" })).model;
    const fired = update(simulating, Message.ClickedFireTransition({ edgeId: "t-checkout" })).model;
    expect(fired.configuration).toEqual(["shipping"]);
    expect(
      update(fired, Message.ClickedFireTransition({ edgeId: "t-paid" })).model.configuration,
    ).toEqual(["shipping"]);
  });
});
