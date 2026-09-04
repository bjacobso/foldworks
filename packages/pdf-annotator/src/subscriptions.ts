import { Effect, Schema as S, Stream } from "effect";
import { Subscription } from "foldkit";

import { DragAndDrop } from "@foldkit/ui";
import { Message } from "./message";
import type { Model } from "./model";

const drag = Subscription.lift({
  pdfAnnotationPointer: DragAndDrop.subscriptions.documentPointer,
  pdfAnnotationEscape: DragAndDrop.subscriptions.documentEscape,
  pdfAnnotationKeyboard: DragAndDrop.subscriptions.documentKeyboard,
})<Model, Message>({
  toChildModel: (model) => model.dragAndDrop,
  toParentMessage: (message) => Message.GotDragMessage({ message }),
});

const resize = Subscription.make<Model, Message>()((entry) => ({
  annotationResize: entry(
    { isResizing: S.Boolean },
    {
      modelToDependencies: (model) => ({
        isResizing: model.resizeState._tag === "Resizing",
      }),
      dependenciesToStream: ({ isResizing }) => Stream.when(
        Stream.merge(
          Stream.fromEventListener<PointerEvent>(document, "pointermove").pipe(
            Stream.map((event) => Message.MovedResize({
              screenX: event.screenX,
              screenY: event.screenY,
            })),
          ),
          Stream.fromEventListener<PointerEvent>(document, "pointerup").pipe(
            Stream.map(() => Message.FinishedResize()),
          ),
        ),
        Effect.sync(() => isResizing),
      ),
    },
  ),
}));

export const subscriptions = Subscription.aggregate<Model, Message>()(drag, resize);
