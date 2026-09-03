import type { DragAndDrop } from "@foldkit/ui";

import {
  flowIdFromContainerId,
  flowLocationFromId,
} from "./layout";
import { paletteTypeFromId } from "./registry";
import type { ElementShape, FlowLocation, WorkflowDocument } from "./structured";

export type ReorderOperations<Node extends ElementShape<Node>> = Readonly<{
  insertElement: (
    document: WorkflowDocument<Node>,
    location: FlowLocation,
    element: Node,
  ) => WorkflowDocument<Node> | undefined;
  moveElement: (
    document: WorkflowDocument<Node>,
    elementId: string,
    location: FlowLocation,
  ) => WorkflowDocument<Node> | undefined;
}>;

export type ReorderResult<Node extends ElementShape<Node>> =
  | Readonly<{
      _tag: "Inserted";
      document: WorkflowDocument<Node>;
      element: Node;
      location: FlowLocation;
    }>
  | Readonly<{
      _tag: "Moved";
      document: WorkflowDocument<Node>;
      elementId: string;
      location: FlowLocation;
    }>;

export type ApplyReorderConfig<Node extends ElementShape<Node>> = Readonly<{
  document: WorkflowDocument<Node>;
  reordered: Extract<DragAndDrop.OutMessage, { readonly _tag: "Reordered" }>;
  operations: ReorderOperations<Node>;
  createFromPalette: (type: string, location: FlowLocation) => Node | undefined;
}>;

const reorderLocation = (
  reordered: Readonly<{
    fromContainerId: string;
    fromIndex: number;
    toContainerId: string;
    toIndex: number;
  }>,
): FlowLocation | undefined => {
  const explicit = flowLocationFromId(reordered.toContainerId);
  if (explicit !== undefined) return explicit;
  const flowId = flowIdFromContainerId(reordered.toContainerId);
  if (flowId === undefined) return undefined;
  const sourceFlowId = flowIdFromContainerId(reordered.fromContainerId);
  const index = sourceFlowId === flowId && reordered.fromIndex < reordered.toIndex
    ? reordered.toIndex + 1
    : reordered.toIndex;
  return { flowId, index };
};

export const applyReorder = <Node extends ElementShape<Node>>(
  config: ApplyReorderConfig<Node>,
): ReorderResult<Node> | undefined => {
  const location = reorderLocation(config.reordered);
  if (location === undefined) return undefined;
  const paletteType = paletteTypeFromId(config.reordered.itemId);
  if (paletteType !== undefined) {
    const element = config.createFromPalette(paletteType, location);
    if (element === undefined) return undefined;
    const document = config.operations.insertElement(config.document, location, element);
    return document === undefined
      ? undefined
      : { _tag: "Inserted", document, element, location };
  }
  const document = config.operations.moveElement(
    config.document,
    config.reordered.itemId,
    location,
  );
  return document === undefined
    ? undefined
    : {
        _tag: "Moved",
        document,
        elementId: config.reordered.itemId,
        location,
      };
};
