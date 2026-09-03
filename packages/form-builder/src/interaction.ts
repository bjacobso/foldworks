import { DragAndDrop } from "@foldkit/ui";

export const DEFAULT_ACTIVATION_THRESHOLD = 8;
export const DEFAULT_ID = "form-builder-drag-and-drop";

export type InitConfig = Readonly<
  Partial<Pick<DragAndDrop.InitConfig, "id" | "orientation" | "activationThreshold">>
>;

export const init = (config: InitConfig = {}) =>
  DragAndDrop.init({
    ...config,
    id: config.id ?? DEFAULT_ID,
    activationThreshold: config.activationThreshold ?? DEFAULT_ACTIVATION_THRESHOLD,
    orientation: config.orientation ?? "Vertical",
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
