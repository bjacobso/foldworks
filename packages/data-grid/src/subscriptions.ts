import { Effect, Schema as S, Stream } from "effect";
import { Subscription } from "foldkit";

import { Message } from "./message";
import type { Model } from "./model";

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  columnResize: entry(
    { isResizing: S.Boolean },
    {
      modelToDependencies: (model) => ({
        isResizing: model.resizeState._tag === "Resizing",
      }),
      dependenciesToStream: ({ isResizing }) => {
        const pointerMoves = Stream.fromEventListener<PointerEvent>(
          document,
          "pointermove",
        ).pipe(
          Stream.map((event) => Message.MovedColumnResize({ screenX: event.screenX })),
        );
        const pointerUps = Stream.fromEventListener<PointerEvent>(
          document,
          "pointerup",
        ).pipe(Stream.map(() => Message.FinishedColumnResize()));
        return Stream.when(
          Stream.merge(pointerMoves, pointerUps),
          Effect.sync(() => isResizing),
        );
      },
    },
  ),
}));
