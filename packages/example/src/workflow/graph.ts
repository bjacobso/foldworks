import {
  Workflow,
  createStructuredWorkflowOperations,
  flowLocationFromId,
  flowLocationId,
  type FlowLocation,
} from "@foldworks/workflow";

import type {
  NodeKind,
  WorkflowDocument,
  WorkflowNode,
} from "./model";
import { nodeTypes } from "./node-types";

export const PALETTE_PREFIX = "palette:";
export const GRAPH_CONTAINER_ID = "workflow-graph";
export const PALETTE_CONTAINER_ID = "node-palette";

export const paletteItemId = (kind: NodeKind) => `${PALETTE_PREFIX}${kind}`;

export const kindFromPaletteItem = (itemId: string): NodeKind | undefined => {
  if (!itemId.startsWith(PALETTE_PREFIX)) return undefined;
  const kind = itemId.slice(PALETTE_PREFIX.length) as NodeKind;
  return kind in nodeTypes && nodeTypes[kind].palette !== undefined ? kind : undefined;
};

const operations = createStructuredWorkflowOperations<WorkflowNode>({
  isMovable: (node) => nodeTypes[node.type].movable,
  isDeletable: (node) => nodeTypes[node.type].deletable,
});

export const findNode = operations.findElement;
export const findFlow = operations.findFlow;
export const moveNode = operations.moveElement;
export const updateNode = operations.updateElement;
export const deleteNode = operations.deleteElement;
export const allNodes = operations.elements;

export const canMoveNode = (document: WorkflowDocument, nodeId: string) => {
  const node = findNode(document, nodeId);
  return node !== undefined && nodeTypes[node.type].movable;
};

export const insertNewNode = (
  document: WorkflowDocument,
  location: FlowLocation,
  kind: NodeKind,
  nextId: number,
): Readonly<{ document: WorkflowDocument; node: WorkflowNode }> | undefined => {
  const node = nodeTypes[kind].create(`node-${nextId}`);
  const nextDocument = operations.insertElement(document, location, node);
  return nextDocument === undefined ? undefined : { document: nextDocument, node };
};

export const isNodeKind = (value: string): value is NodeKind => value in nodeTypes;

export const isNodeSize = (value: string) =>
  value === "compact" || value === "default" || value === "wide";

export const previewDocumentForDrop = (
  document: WorkflowDocument,
  itemId: string,
  containerId: string,
): WorkflowDocument | undefined => {
  const location = flowLocationFromId(containerId);
  if (location === undefined) return undefined;
  const paletteKind = kindFromPaletteItem(itemId);
  if (paletteKind !== undefined) {
    return insertNewNode(document, location, paletteKind, 0)?.document;
  }
  return moveNode(document, itemId, location);
};

export const dropLocationFromTarget = flowLocationFromId;
export const dropTargetId = flowLocationId;
export const maybeDropLocation = Workflow.maybeDropLocation;
