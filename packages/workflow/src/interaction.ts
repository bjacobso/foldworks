import { Option } from "effect";

import { DragAndDrop } from "@foldkit/ui";
import {
  flowIdFromContainerId,
  flowLocationFromId,
} from "./layout";

export const DEFAULT_ACTIVATION_THRESHOLD = 8;

export const maybeDropLocation = (model: DragAndDrop.Model) =>
  Option.flatMap(DragAndDrop.maybeDropTarget(model), ({ containerId, index }) => {
    const explicit = flowLocationFromId(containerId);
    if (explicit !== undefined) return Option.some(explicit);
    const flowId = flowIdFromContainerId(containerId);
    if (flowId === undefined) return Option.none();
    const sourceFlowId = model.dragState._tag === "KeyboardDragging" ||
        model.dragState._tag === "Dragging"
      ? flowIdFromContainerId(model.dragState.sourceContainerId)
      : undefined;
    const targetIndex = sourceFlowId === flowId &&
        (model.dragState._tag === "KeyboardDragging" || model.dragState._tag === "Dragging") &&
        model.dragState.sourceIndex < index
      ? index + 1
      : index;
    return Option.some({ flowId, index: targetIndex });
  });

export const init = (config: DragAndDrop.InitConfig): DragAndDrop.Model => DragAndDrop.init({
  ...config,
  activationThreshold: config.activationThreshold ?? DEFAULT_ACTIVATION_THRESHOLD,
});

export const Model: typeof DragAndDrop.Model = DragAndDrop.Model;
export type Model = DragAndDrop.Model;
export const Message: typeof DragAndDrop.Message = DragAndDrop.Message;
export type Message = DragAndDrop.Message;
export const OutMessage: typeof DragAndDrop.OutMessage = DragAndDrop.OutMessage;
export type OutMessage = DragAndDrop.OutMessage;

export const update: typeof DragAndDrop.update = DragAndDrop.update;
export const subscriptions: typeof DragAndDrop.subscriptions = DragAndDrop.subscriptions;
export const draggable: typeof DragAndDrop.draggable = DragAndDrop.draggable;
export const droppable: typeof DragAndDrop.droppable = DragAndDrop.droppable;
export const ghostStyle: typeof DragAndDrop.ghostStyle = DragAndDrop.ghostStyle;
export const isDragging: typeof DragAndDrop.isDragging = DragAndDrop.isDragging;
export const maybeDraggedItemId: typeof DragAndDrop.maybeDraggedItemId = DragAndDrop.maybeDraggedItemId;
export const maybeDropTarget: typeof DragAndDrop.maybeDropTarget = DragAndDrop.maybeDropTarget;
