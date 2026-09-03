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

export const init = (config: DragAndDrop.InitConfig) => DragAndDrop.init({
  ...config,
  activationThreshold: config.activationThreshold ?? DEFAULT_ACTIVATION_THRESHOLD,
});

export const Model = DragAndDrop.Model;
export type Model = DragAndDrop.Model;
export const Message = DragAndDrop.Message;
export type Message = DragAndDrop.Message;
export const OutMessage = DragAndDrop.OutMessage;
export type OutMessage = DragAndDrop.OutMessage;

export const update = DragAndDrop.update;
export const subscriptions = DragAndDrop.subscriptions;
export const draggable = DragAndDrop.draggable;
export const droppable = DragAndDrop.droppable;
export const ghostStyle = DragAndDrop.ghostStyle;
export const isDragging = DragAndDrop.isDragging;
export const maybeDraggedItemId = DragAndDrop.maybeDraggedItemId;
export const maybeDropTarget = DragAndDrop.maybeDropTarget;
