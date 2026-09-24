import { Schema as S } from "effect";

import {
  ancestorIds,
  childrenOf,
  createDiagramOperations,
  createLayeredLayout,
  descendantIds,
  DocumentSchema,
  findNode,
  lowestCommonAncestor,
  NoteDataSchema,
  type DiagramDocument,
  type DiagramNode,
  type Dimensions,
  type LayeredDirection,
} from "@foldworks/diagram";

export const StateKind = S.Literals([
  "initial",
  "atomic",
  "compound",
  "parallel",
  "final",
  "submachine",
]);
export type StateKind = typeof StateKind.Type;

export const StateData = S.Struct({
  name: S.String,
  kind: StateKind,
  machineId: S.optionalKey(S.String),
});
export type StateData = typeof StateData.Type;

export const TransitionData = S.Struct({
  event: S.String,
  guard: S.optionalKey(S.String),
});
export type TransitionData = typeof TransitionData.Type;

export const MachineDocument = DocumentSchema({
  node: StateData,
  edge: TransitionData,
  annotation: NoteDataSchema,
});
export type MachineDocument = DiagramDocument<StateData, TransitionData>;
export type StateNode = DiagramNode<StateData>;

export const Machine = S.Struct({
  id: S.String,
  name: S.String,
  document: MachineDocument,
});
export type Machine = typeof Machine.Type;

export const Library = S.Struct({
  rootMachineId: S.String,
  machines: S.Array(Machine),
});
export type Library = typeof Library.Type;

export const isContainerKind = (kind: StateKind) => kind === "compound" || kind === "parallel";
export const isPseudoKind = (kind: StateKind) => kind === "initial";

/** Statechart rules layered on the diagram primitive: only compound and
 *  parallel states hold children, parallel states hold compound regions,
 *  initial states have one outgoing transition, and final states have none. */
export const operations = createDiagramOperations<StateData, TransitionData, { text: string }>({
  canNest: (_document, child, parent) => {
    if (parent === undefined) return true;
    if (!isContainerKind(parent.data.kind)) return false;
    if (parent.data.kind === "parallel") return child.data.kind === "compound";
    return true;
  },
  canConnect: (document, source, target) => {
    if (source.data.kind === "final" || target.data.kind === "initial") return false;
    if (source.data.kind === "initial") {
      return (
        source.parentId === target.parentId &&
        !document.edges.some((edge) => edge.source.nodeId === source.id)
      );
    }
    return true;
  },
});

const sizes: Record<StateKind, Dimensions> = {
  initial: { width: 22, height: 22 },
  atomic: { width: 148, height: 44 },
  compound: { width: 196, height: 96 },
  parallel: { width: 220, height: 110 },
  final: { width: 30, height: 30 },
  submachine: { width: 200, height: 54 },
};

export const stateSize = (node: StateNode): Dimensions => sizes[node.data.kind];

const layouts = new Map<LayeredDirection, ReturnType<typeof createLayout>>();

const createLayout = (direction: LayeredDirection) =>
  createLayeredLayout<StateData, TransitionData, { text: string }>({
    direction,
    nodeSize: stateSize,
    annotationSize: () => ({ width: 188, height: 84 }),
    isContainer: (node) => isContainerKind(node.data.kind),
    containerPadding: { top: 42, right: 26, bottom: 26, left: 26 },
    rankGap: 84,
    nodeGap: 44,
    edgeSpacing: 30,
  });

export const layoutMachine = (document: MachineDocument, direction: LayeredDirection) => {
  const cached = layouts.get(direction);
  if (cached !== undefined) return cached(document);
  const layout = createLayout(direction);
  layouts.set(direction, layout);
  return layout(document);
};

export const findMachine = (library: Library, machineId: string): Machine | undefined =>
  library.machines.find((machine) => machine.id === machineId);

export const updateMachine = (
  library: Library,
  machineId: string,
  update: (document: MachineDocument) => MachineDocument,
): Library => ({
  ...library,
  machines: library.machines.map((machine) =>
    machine.id === machineId ? { ...machine, document: update(machine.document) } : machine,
  ),
});

// Simulation ---------------------------------------------------------------

const initialChild = (document: MachineDocument, parentId: string | undefined) => {
  const children = childrenOf(document.nodes, parentId);
  const initial = children.find((node) => node.data.kind === "initial");
  const viaInitial =
    initial === undefined
      ? undefined
      : document.edges.find((edge) => edge.source.nodeId === initial.id)?.target.nodeId;
  return viaInitial ?? children.find((node) => !isPseudoKind(node.data.kind))?.id;
};

/** Default entry: descend through initial transitions and enter every region
 *  of a parallel state. Returns the active leaf states. */
const enterState = (document: MachineDocument, stateId: string): ReadonlyArray<string> => {
  const node = findNode(document, stateId);
  if (node === undefined) return [];
  if (node.data.kind === "parallel") {
    return childrenOf(document.nodes, stateId).flatMap((region) => enterState(document, region.id));
  }
  if (node.data.kind === "compound") {
    const child = initialChild(document, stateId);
    return child === undefined ? [stateId] : enterState(document, child);
  }
  return [stateId];
};

export const initialConfiguration = (document: MachineDocument): ReadonlyArray<string> => {
  const entry = initialChild(document, undefined);
  return entry === undefined ? [] : enterState(document, entry);
};

/** Active leaves plus all of their ancestors. */
export const activeStates = (
  document: MachineDocument,
  configuration: ReadonlyArray<string>,
): ReadonlySet<string> =>
  new Set(configuration.flatMap((id) => [id, ...ancestorIds(document.nodes, id)]));

/** Transitions that would fire for the current configuration: for each
 *  active leaf, the innermost state that handles an event wins. */
export const enabledTransitions = (
  document: MachineDocument,
  configuration: ReadonlyArray<string>,
) => {
  const result = new Map<string, MachineDocument["edges"][number]>();
  for (const leaf of configuration) {
    const handled = new Set<string>();
    for (const stateId of [leaf, ...ancestorIds(document.nodes, leaf)]) {
      for (const edge of document.edges) {
        if (edge.source.nodeId !== stateId || handled.has(edge.data.event)) continue;
        result.set(edge.id, edge);
      }
      for (const edge of document.edges) {
        if (edge.source.nodeId === stateId) handled.add(edge.data.event);
      }
    }
  }
  return [...result.values()];
};

/** Takes one transition: exits active states inside the transition domain,
 *  then enters the target with its ancestors, including sibling regions of
 *  any parallel state on the way in. */
export const takeTransition = (
  document: MachineDocument,
  configuration: ReadonlyArray<string>,
  edgeId: string,
): ReadonlyArray<string> => {
  const edge = document.edges.find((candidate) => candidate.id === edgeId);
  if (edge === undefined) return configuration;
  const source = edge.source.nodeId;
  const target = edge.target.nodeId;
  const common = lowestCommonAncestor(document.nodes, source, target);
  const domain =
    common === source || common === target ? findNode(document, common)?.parentId : common;
  const inside = domain === undefined ? undefined : new Set(descendantIds(document.nodes, domain));
  const kept = configuration.filter((id) => inside !== undefined && !inside.has(id));

  const path = [target, ...ancestorIds(document.nodes, target)];
  const stop = domain === undefined ? path.length : path.indexOf(domain);
  const entering = path.slice(0, stop < 0 ? path.length : stop).reverse();
  const entered: string[] = [];
  for (const [index, stateId] of entering.entries()) {
    const node = findNode(document, stateId);
    const next = entering[index + 1];
    if (node?.data.kind === "parallel" && next !== undefined) {
      for (const region of childrenOf(document.nodes, stateId)) {
        if (region.id !== next) entered.push(...enterState(document, region.id));
      }
    }
  }
  entered.push(...enterState(document, target));
  return [...kept, ...entered];
};

export const isComplete = (document: MachineDocument, configuration: ReadonlyArray<string>) =>
  configuration.length > 0 &&
  configuration.every((id) => {
    const node = findNode(document, id);
    return node?.data.kind === "final" && node.parentId === undefined;
  });

// Lint ---------------------------------------------------------------------

export type MachineIssue = Readonly<{ elementId: string; message: string }>;

export const lintMachine = (library: Library, machine: Machine): ReadonlyArray<MachineIssue> => {
  const document = machine.document;
  const issues: MachineIssue[] = [];
  const containers = [
    undefined,
    ...document.nodes.filter((node) => node.data.kind === "compound").map((node) => node.id),
  ];
  for (const containerId of containers) {
    const children = childrenOf(document.nodes, containerId);
    if (children.length > 0 && !children.some((node) => node.data.kind === "initial")) {
      issues.push({
        elementId: containerId ?? machine.id,
        message: `${containerId === undefined ? machine.name : findNode(document, containerId)?.data.name} has no initial state.`,
      });
    }
  }
  const reachable = new Set<string>();
  const queue: string[] = [];
  const reach = (leaves: ReadonlyArray<string>) => {
    for (const leaf of leaves) {
      for (const stateId of [leaf, ...ancestorIds(document.nodes, leaf)]) {
        if (reachable.has(stateId)) continue;
        reachable.add(stateId);
        queue.push(stateId);
      }
    }
  };
  reach(initialConfiguration(document));
  while (queue.length > 0) {
    const stateId = queue.pop();
    for (const edge of document.edges) {
      if (edge.source.nodeId === stateId) reach(takeTransition(document, [], edge.id));
    }
  }
  for (const node of document.nodes) {
    if (!isPseudoKind(node.data.kind) && !reachable.has(node.id)) {
      issues.push({ elementId: node.id, message: `${node.data.name} is unreachable.` });
    }
    if (
      node.data.kind === "submachine" &&
      (node.data.machineId === undefined || findMachine(library, node.data.machineId) === undefined)
    ) {
      issues.push({
        elementId: node.id,
        message: `${node.data.name} does not reference a machine.`,
      });
    }
  }
  for (const edge of document.edges) {
    const source = findNode(document, edge.source.nodeId);
    if (source !== undefined && !isPseudoKind(source.data.kind) && edge.data.event.trim() === "") {
      issues.push({
        elementId: edge.id,
        message: `A transition from ${source.data.name} has no event.`,
      });
    }
  }
  return issues;
};

/** Returns an id with the given prefix that no element in the document uses. */
export const freshId = (document: MachineDocument, prefix: string, seed: number): string => {
  const used = new Set([
    ...document.nodes.map((node) => node.id),
    ...document.edges.map((edge) => edge.id),
    ...document.annotations.map((annotation) => annotation.id),
  ]);
  let index = seed;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
};
