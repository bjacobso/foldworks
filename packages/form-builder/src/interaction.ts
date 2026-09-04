import { DragAndDrop } from "@foldkit/ui";

export const DEFAULT_ACTIVATION_THRESHOLD = 8;
export const DEFAULT_ID = "form-builder-drag-and-drop";

export type InitConfig = Readonly<
  Partial<Pick<DragAndDrop.InitConfig, "id" | "orientation" | "activationThreshold">>
>;

export const init = (config: InitConfig = {}): DragAndDrop.Model =>
  DragAndDrop.init({
    ...config,
    id: config.id ?? DEFAULT_ID,
    activationThreshold: config.activationThreshold ?? DEFAULT_ACTIVATION_THRESHOLD,
    orientation: config.orientation ?? "Vertical",
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
