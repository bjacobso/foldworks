import { Option } from "effect";

import { DragAndDrop } from "@foldkit/ui";

import { dropLocationFromId } from "./document";

export const DEFAULT_ACTIVATION_THRESHOLD = 8;

export const maybeDropLocation = (model: DragAndDrop.Model) =>
  Option.flatMap(DragAndDrop.maybeDropTarget(model), ({ containerId }) =>
    Option.fromNullishOr(dropLocationFromId(containerId)),
  );

export const init = (config: Omit<DragAndDrop.InitConfig, "orientation">) =>
  DragAndDrop.init({
    ...config,
    activationThreshold: config.activationThreshold ?? DEFAULT_ACTIVATION_THRESHOLD,
    orientation: "Vertical",
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
