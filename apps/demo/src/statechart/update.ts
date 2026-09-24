import { Effect } from "effect";
import { Command, type Update } from "foldkit";

import {
  addPoints,
  Diagram,
  findAnnotation,
  findEdge,
  findNode,
  nodeAt,
  relativePosition,
  toRelative,
  type DiagramScene,
  type Point,
} from "@foldworks/diagram";
import { History } from "@foldworks/history";

import {
  enabledTransitions,
  findMachine,
  freshId,
  initialConfiguration,
  isContainerKind,
  layoutMachine,
  operations,
  StateKind,
  takeTransition,
  updateMachine,
  type Library,
  type MachineDocument,
  type StateKind as StateKindType,
} from "./machine";
import { Message } from "./message";
import { CANVAS_ID, init, type Model } from "./model";
import { sampleLibrary } from "./sample";

type UpdateReturn = Update.Return<Model, Message>;

const isStateKind = (value: string): value is StateKindType =>
  (StateKind.literals as ReadonlyArray<string>).includes(value);

const MeasureCanvas = Command.define("MeasureStatechartCanvas", {
  args: {},
  messages: [Message.CompletedMeasureCanvas],
  // Wait a frame so a canvas rendered by the same update has been laid out.
  execute: () =>
    Effect.callback<ReturnType<typeof Message.CompletedMeasureCanvas>>((resume) => {
      requestAnimationFrame(() => {
        const canvas = document.querySelector(`[data-diagram-canvas="${CANVAS_ID}"]`);
        const rect = canvas?.getBoundingClientRect();
        resume(
          Effect.succeed(
            Message.CompletedMeasureCanvas({
              width: rect?.width ?? 0,
              height: rect?.height ?? 0,
            }),
          ),
        );
      });
    }),
});

const fit = MeasureCanvas({});

export const currentMachineId = (model: Model): string =>
  model.path[model.path.length - 1] ?? model.library.rootMachineId;

export const currentDocument = (model: Model): MachineDocument =>
  findMachine(model.library, currentMachineId(model))?.document ?? {
    nodes: [],
    edges: [],
    annotations: [],
  };

export const currentScene = (model: Model): DiagramScene =>
  layoutMachine(currentDocument(model), model.direction);

const kindLabels: Record<StateKindType, string> = {
  initial: "Initial state",
  atomic: "State",
  compound: "Compound state",
  parallel: "Parallel state",
  final: "Final state",
  submachine: "Submachine",
};

export const labelForKind = (kind: StateKindType) => kindLabels[kind];

const elementName = (document: MachineDocument, id: string): string =>
  findNode(document, id)?.data.name ??
  (findEdge(document, id) === undefined
    ? findAnnotation(document, id) === undefined
      ? "Element"
      : "Note"
    : `${findEdge(document, id)?.data.event || "Transition"}`);

/** Replaces the current machine's document, recording history. */
const commit = (
  model: Model,
  document: MachineDocument,
  announcement: string,
  coalescingKey?: string,
): Model => {
  const library = updateMachine(model.library, currentMachineId(model), () => document);
  return {
    ...model,
    history: History.record(
      model.history,
      model.library,
      coalescingKey === undefined ? {} : { coalescingKey },
    ),
    library,
    nextId: model.nextId + 1,
    announcement,
  };
};

const commitLibrary = (model: Model, library: Library, announcement: string): Model => ({
  ...model,
  history: History.record(model.history, model.library),
  library,
  nextId: model.nextId + 1,
  announcement,
});

const announce = (model: Model, announcement: string): UpdateReturn => ({
  model: { ...model, announcement },
});

const clampInside = (parentId: string | undefined, point: Point): Point =>
  parentId === undefined ? point : { x: Math.max(0, point.x), y: Math.max(0, point.y) };

const parentOf = (document: MachineDocument, id: string) =>
  findNode(document, id)?.parentId ?? findAnnotation(document, id)?.parentId;

/** Pins elements where they would land after moving by `delta`. */
export const translated = (
  document: MachineDocument,
  scene: DiagramScene,
  ids: ReadonlyArray<string>,
  delta: Point,
): MachineDocument | undefined => {
  const positions = new Map<string, Point>();
  for (const id of ids) {
    const current = relativePosition(scene, id);
    if (current === undefined) return undefined;
    positions.set(id, clampInside(parentOf(document, id), addPoints(current, delta)));
  }
  return operations.setPositions(document, positions);
};

/** The container a single dragged element would be nested into, if it is
 *  different from its current parent. `null` means the document root. */
export const dropContainer = (
  document: MachineDocument,
  scene: DiagramScene,
  id: string,
  drop: Point,
): string | null | undefined => {
  const target = nodeAt(scene, drop, {
    exclude: new Set([id]),
    filter: (candidate) => {
      const node = findNode(document, candidate.id);
      return node !== undefined && isContainerKind(node.data.kind);
    },
  })?.id;
  const parent = parentOf(document, id);
  if (target === parent) return undefined;
  return target ?? null;
};

const moveElements = (
  model: Model,
  moved: Extract<Diagram.OutMessage, { readonly _tag: "MovedElements" }>,
): UpdateReturn => {
  const document = currentDocument(model);
  const scene = currentScene(model);
  const delta = { x: moved.deltaX, y: moved.deltaY };
  const [only] = moved.ids;
  if (!moved.isKeyboard && moved.ids.length === 1 && only !== undefined) {
    const container = dropContainer(document, scene, only, { x: moved.dropX, y: moved.dropY });
    const rect =
      scene.nodes.get(only) ?? scene.annotations.find((annotation) => annotation.id === only);
    if (container !== undefined && rect !== undefined) {
      const parentId = container ?? undefined;
      const position = clampInside(parentId, toRelative(scene, parentId, addPoints(rect, delta)));
      const next =
        findNode(document, only) === undefined
          ? operations.reparentAnnotation(document, only, parentId, position)
          : operations.reparentNode(document, only, parentId, position);
      const name = elementName(document, only);
      if (next === undefined) {
        return announce(
          model,
          `${name} cannot be nested in ${parentId === undefined ? "the machine" : elementName(document, parentId)}.`,
        );
      }
      return {
        model: commit(
          model,
          next,
          parentId === undefined
            ? `${name} moved out to the machine.`
            : `${name} moved into ${elementName(document, parentId)}.`,
        ),
      };
    }
  }
  const next = translated(document, scene, moved.ids, delta);
  if (next === undefined) return { model };
  return {
    model: commit(
      model,
      next,
      `${moved.ids.length === 1 ? elementName(document, only ?? "") : `${moved.ids.length} elements`} moved.`,
      moved.isKeyboard ? `nudge:${moved.ids.join(",")}` : undefined,
    ),
  };
};

const connect = (
  model: Model,
  requested: Extract<Diagram.OutMessage, { readonly _tag: "RequestedConnection" }>,
): UpdateReturn => {
  const document = currentDocument(model);
  const scene = currentScene(model);
  const target = nodeAt(scene, { x: requested.x, y: requested.y });
  if (target === undefined) return announce(model, "Release on a state to create a transition.");
  const source = findNode(document, requested.source.nodeId);
  const rejection = operations.connectionRejection(document, requested.source, {
    nodeId: target.id,
  });
  if (source === undefined || rejection !== undefined) {
    return announce(
      model,
      source?.data.kind === "initial"
        ? "An initial state has exactly one transition, to a sibling state."
        : source?.data.kind === "final"
          ? "Final states cannot have outgoing transitions."
          : "Transitions cannot target initial states.",
    );
  }
  const id = freshId(document, "t", model.nextId);
  const event = source.data.kind === "initial" ? "" : `EVENT_${model.nextId}`;
  const next = operations.addEdge(document, {
    id,
    source: requested.source,
    target: { nodeId: target.id },
    data: { event },
  });
  if (next === undefined) return { model };
  const targetName = findNode(document, target.id)?.data.name ?? "state";
  const committed = commit(
    model,
    next,
    target.id === source.id
      ? `Self-transition added to ${source.data.name}.`
      : `Transition added from ${source.data.name} to ${targetName}.`,
  );
  return { model: { ...committed, canvas: Diagram.select(committed.canvas, [id]) } };
};

const removeSelection = (model: Model, ids: ReadonlyArray<string>): UpdateReturn => {
  if (ids.length === 0) return { model };
  const document = currentDocument(model);
  const next = operations.removeElements(document, ids);
  if (next === undefined) return announce(model, "That element cannot be deleted.");
  const committed = commit(
    model,
    next,
    ids.length === 1
      ? `${elementName(document, ids[0] ?? "")} deleted.`
      : `${ids.length} elements deleted.`,
  );
  return {
    model: {
      ...committed,
      canvas: Diagram.select(committed.canvas, []),
      configuration: committed.configuration.filter((id) => !ids.includes(id)),
    },
  };
};

const fire = (model: Model, edgeId: string): UpdateReturn => {
  const document = currentDocument(model);
  const edge = findEdge(document, edgeId);
  if (
    edge === undefined ||
    !enabledTransitions(document, model.configuration).some((e) => e.id === edgeId)
  ) {
    return { model };
  }
  const configuration = takeTransition(document, model.configuration, edgeId);
  const names = configuration.map((id) => findNode(document, id)?.data.name ?? id).join(", ");
  const event = edge.data.event || "(automatic)";
  return {
    model: {
      ...model,
      configuration,
      log: [...model.log, `${event} → ${names}`].slice(-12),
      announcement: `${event} fired. Active: ${names}.`,
    },
  };
};

const foldCanvas = (model: Model, message: Diagram.Message): UpdateReturn => {
  const result = Diagram.update(model.canvas, message);
  const next = { ...model, canvas: result.model };
  const out = result.outMessage;
  if (out === undefined) return { model: next };
  return Diagram.OutMessage.match<UpdateReturn>(out, {
    ChangedSelection: () => ({ model: next }),
    Clicked: ({ id }) =>
      next.mode === "Simulate" && findEdge(currentDocument(next), id) !== undefined
        ? fire(next, id)
        : { model: next },
    MovedElements: (moved) => (next.mode === "Edit" ? moveElements(next, moved) : { model: next }),
    RequestedConnection: (requested) =>
      next.mode === "Edit" ? connect(next, requested) : { model: next },
    RequestedDelete: ({ ids }) =>
      next.mode === "Edit" ? removeSelection(next, ids) : { model: next },
    Cancelled: () => announce(next, "Gesture cancelled."),
  });
};

const selectedId = (model: Model): string | undefined =>
  model.canvas.selection.length === 1 ? model.canvas.selection[0] : undefined;

const updateSelectedState = (
  model: Model,
  change: (
    data: MachineDocument["nodes"][number]["data"],
  ) => MachineDocument["nodes"][number]["data"],
  key: string,
): UpdateReturn => {
  const id = selectedId(model);
  if (id === undefined) return { model };
  const document = currentDocument(model);
  const next = operations.updateNode(document, id, (node) => ({
    ...node,
    data: change(node.data),
  }));
  return next === undefined
    ? { model }
    : { model: commit(model, next, "State updated.", `${id}:${key}`) };
};

const updateSelectedTransition = (
  model: Model,
  change: (
    data: MachineDocument["edges"][number]["data"],
  ) => MachineDocument["edges"][number]["data"],
  key: string,
): UpdateReturn => {
  const id = selectedId(model);
  if (id === undefined) return { model };
  const next = operations.updateEdge(currentDocument(model), id, (edge) => ({
    ...edge,
    data: change(edge.data),
  }));
  return next === undefined
    ? { model }
    : { model: commit(model, next, "Transition updated.", `${id}:${key}`) };
};

const openMachine = (model: Model, path: ReadonlyArray<string>): UpdateReturn => {
  const next: Model = {
    ...model,
    path,
    canvas: Diagram.select(model.canvas, []),
  };
  const document = currentDocument(next);
  return {
    model: {
      ...next,
      configuration: initialConfiguration(document),
      log: [],
      history: History.breakCoalescing(model.history),
      announcement: `${findMachine(model.library, path[path.length - 1] ?? "")?.name ?? "Machine"} opened.`,
    },
    commands: [fit],
  };
};

const addState = (model: Model, kind: StateKindType): UpdateReturn => {
  const document = currentDocument(model);
  const selected = selectedId(model);
  const selectedNode = selected === undefined ? undefined : findNode(document, selected);
  const parentId =
    selectedNode !== undefined && isContainerKind(selectedNode.data.kind)
      ? selectedNode.id
      : selectedNode?.parentId;
  const id = freshId(document, kind === "initial" ? "initial" : "state", model.nextId);
  let library = model.library;
  let machineId: string | undefined;
  if (kind === "submachine") {
    machineId = `machine-${model.nextId}`;
    while (findMachine(library, machineId) !== undefined) machineId = `${machineId}-copy`;
    library = {
      ...library,
      machines: [
        ...library.machines,
        {
          id: machineId,
          name: `Submachine ${model.nextId}`,
          document: {
            nodes: [
              { id: "start", data: { name: "Start", kind: "initial" } },
              { id: "running", data: { name: "Running", kind: "atomic" } },
              { id: "done", data: { name: "Done", kind: "final" } },
            ],
            edges: [
              {
                id: "t-start",
                source: { nodeId: "start" },
                target: { nodeId: "running" },
                data: { event: "" },
              },
              {
                id: "t-finish",
                source: { nodeId: "running" },
                target: { nodeId: "done" },
                data: { event: "FINISH" },
              },
            ],
            annotations: [],
          },
        },
      ],
    };
  }
  const name =
    kind === "initial"
      ? "Start"
      : kind === "submachine"
        ? `Submachine ${model.nextId}`
        : `${labelForKind(kind).replace(" state", "")} ${model.nextId}`;
  const node = {
    id,
    data: { name, kind, ...(machineId === undefined ? {} : { machineId }) },
  };
  const next =
    (parentId === undefined ? undefined : operations.addNode(document, { ...node, parentId })) ??
    operations.addNode(document, node);
  if (next === undefined) return { model };
  const placed = findNode(next, id)?.parentId;
  const committed = commitLibrary(
    model,
    updateMachine(library, currentMachineId(model), () => next),
    placed === undefined
      ? `${name} added.`
      : `${name} added to ${findNode(document, placed)?.data.name ?? "state"}.`,
  );
  return { model: { ...committed, canvas: Diagram.select(committed.canvas, [id]) } };
};

const restore = (model: Model, direction: "Undo" | "Redo"): UpdateReturn => {
  const step =
    direction === "Undo"
      ? History.undo(model.history, model.library)
      : History.redo(model.history, model.library);
  if (step === undefined) return { model };
  const path = model.path.filter((id) => findMachine(step.value, id) !== undefined);
  const next: Model = {
    ...model,
    library: step.value,
    history: step.history,
    path: path.length === 0 ? [step.value.rootMachineId] : path,
    announcement: `${direction} completed.`,
  };
  const document = currentDocument(next);
  const known = (id: string) =>
    findNode(document, id) !== undefined ||
    findEdge(document, id) !== undefined ||
    findAnnotation(document, id) !== undefined;
  return {
    model: {
      ...next,
      canvas: Diagram.select(next.canvas, next.canvas.selection.filter(known)),
      configuration: next.configuration.every(known)
        ? next.configuration
        : initialConfiguration(document),
    },
  };
};

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    GotCanvasMessage: ({ message: canvasMessage }) => foldCanvas(model, canvasMessage),
    ClickedAddState: ({ kind }) => addState(model, kind),
    ClickedAddNote: () => {
      const document = currentDocument(model);
      const selected = selectedId(model);
      const id = freshId(document, "note", model.nextId);
      const attached =
        selected !== undefined && findAnnotation(document, selected) === undefined
          ? [selected]
          : [];
      const parentId = selected === undefined ? undefined : findNode(document, selected)?.parentId;
      const next = operations.addAnnotation(document, {
        id,
        ...(parentId === undefined ? {} : { parentId }),
        attachedTo: attached,
        data: { text: "New note" },
      });
      if (next === undefined) return { model };
      const committed = commit(model, next, "Note added.");
      return { model: { ...committed, canvas: Diagram.select(committed.canvas, [id]) } };
    },
    ChangedStateName: ({ value }) =>
      updateSelectedState(model, (data) => ({ ...data, name: value }), "name"),
    ChangedStateKind: ({ value }) => {
      const id = selectedId(model);
      const document = currentDocument(model);
      const node = id === undefined ? undefined : findNode(document, id);
      if (node === undefined || !isStateKind(value)) return { model };
      const hasChildren = document.nodes.some((candidate) => candidate.parentId === node.id);
      if (hasChildren && !isContainerKind(value)) {
        return announce(model, `${node.data.name} has nested states; move them out first.`);
      }
      const parent = node.parentId === undefined ? undefined : findNode(document, node.parentId);
      if (parent?.data.kind === "parallel" && value !== "compound") {
        return announce(model, "Parallel regions must be compound states.");
      }
      const otherMachine = model.library.machines.find(
        (machine) => machine.id !== currentMachineId(model),
      );
      return updateSelectedState(
        model,
        (data) => {
          const { machineId: _machineId, ...rest } = data;
          return value === "submachine" && otherMachine !== undefined
            ? { ...rest, kind: value, machineId: data.machineId ?? otherMachine.id }
            : { ...rest, kind: value };
        },
        "kind",
      );
    },
    ChangedSubmachine: ({ value }) =>
      findMachine(model.library, value) === undefined
        ? { model }
        : updateSelectedState(model, (data) => ({ ...data, machineId: value }), "machine"),
    ChangedTransitionEvent: ({ value }) =>
      updateSelectedTransition(
        model,
        (data) => ({ ...data, event: value.toUpperCase().replace(/\s+/g, "_") }),
        "event",
      ),
    ChangedTransitionGuard: ({ value }) =>
      updateSelectedTransition(
        model,
        (data) => {
          const { guard: _guard, ...rest } = data;
          return value.trim() === "" ? rest : { ...rest, guard: value };
        },
        "guard",
      ),
    ChangedNoteText: ({ value }) => {
      const id = selectedId(model);
      if (id === undefined) return { model };
      const next = operations.updateAnnotation(currentDocument(model), id, (annotation) => ({
        ...annotation,
        data: { text: value },
      }));
      return next === undefined
        ? { model }
        : { model: commit(model, next, "Note updated.", `${id}:text`) };
    },
    ClickedDeleteSelection: () => removeSelection(model, model.canvas.selection),
    ClickedOpenSubmachine: ({ stateId }) => {
      const machineId = findNode(currentDocument(model), stateId)?.data.machineId;
      if (machineId === undefined || findMachine(model.library, machineId) === undefined)
        return { model };
      return openMachine(model, [...model.path, machineId]);
    },
    ClickedOpenMachine: ({ machineId }) =>
      findMachine(model.library, machineId) === undefined
        ? { model }
        : openMachine(
            model,
            machineId === model.library.rootMachineId
              ? [machineId]
              : [model.library.rootMachineId, machineId],
          ),
    ClickedBreadcrumb: ({ index }) =>
      index >= model.path.length - 1
        ? { model }
        : openMachine(model, model.path.slice(0, index + 1)),
    SelectedMode: ({ mode }) =>
      mode === model.mode
        ? { model }
        : {
            model: {
              ...model,
              mode,
              configuration: initialConfiguration(currentDocument(model)),
              log: [],
              canvas: Diagram.select(model.canvas, []),
              announcement:
                mode === "Simulate"
                  ? "Simulation started. Click a highlighted transition to fire it."
                  : "Editing resumed.",
            },
          },
    SelectedDirection: ({ direction }) =>
      direction === model.direction
        ? { model }
        : {
            model: {
              ...model,
              direction,
              announcement: `${direction === "Down" ? "Top-down" : "Left-to-right"} layout.`,
            },
            commands: [fit],
          },
    ClickedAutoLayout: () => ({
      model: commit(
        model,
        operations.clearPositions({
          ...currentDocument(model),
          annotations: currentDocument(model).annotations.map(
            ({ position: _position, ...annotation }) => annotation,
          ),
        }),
        "Positions cleared; the layered layout placed every state.",
      ),
      commands: [fit],
    }),
    ClickedFit: () => ({ model, commands: [fit] }),
    CompletedMeasureCanvas: ({ width, height }) => {
      if (width <= 0 || height <= 0) return { model };
      const viewport = Diagram.fitViewport(currentScene(model).bounds, { width, height }, 56);
      return {
        model: {
          ...model,
          canvas: Diagram.update(model.canvas, Diagram.Message.ChangedViewport(viewport)).model,
        },
      };
    },
    ClickedFireTransition: ({ edgeId }) => fire(model, edgeId),
    ClickedRestartSimulation: () => ({
      model: {
        ...model,
        configuration: initialConfiguration(currentDocument(model)),
        log: [],
        announcement: "Simulation restarted.",
      },
    }),
    ClickedSelectElement: ({ id }) => ({
      model: { ...model, canvas: Diagram.select(model.canvas, [id]) },
    }),
    ClickedUndo: () => restore(model, "Undo"),
    ClickedRedo: () => restore(model, "Redo"),
    ClickedReset: () => {
      const reset = init(sampleLibrary);
      return {
        model: {
          ...reset,
          direction: model.direction,
          history: History.record(model.history, model.library),
          announcement: "Statechart reset to the example.",
        },
        commands: [fit],
      };
    },
  });
