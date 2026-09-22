import { Effect, Queue, Schema as S, Stream } from "effect";
import { Mount } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
export const Box = S.Struct({ width: S.Number, height: S.Number });
export const Model = S.Record(S.String, Box);
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({ Measured: { boxes: Model } });
export type Message = typeof Message.Type;
export const init = (): Model => ({});
export const update = (_model: Model, message: Message) => ({
  model: message.boxes,
});
/** Root content box is "$root"; descendants with data-measure expose border boxes.
 * Reads come from ResizeObserver, writes are delivered once per animation frame. */
export const Observe = Mount.defineStream("ObserveElementBoxes", {
  messages: [Message.Measured],
  execute: ({ element }) =>
    Stream.callback<Message>((queue) =>
      Effect.gen(function* () {
        if (typeof ResizeObserver === "undefined") return;
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            let frame = 0;
            const boxes: Record<string, { width: number; height: number }> = {};
            const observed = new Set<Element>();
            const emit = () => {
              frame = 0;
              Queue.offerUnsafe(
                queue,
                Message.Measured({ boxes: { ...boxes } }),
              );
            };
            const schedule = () => {
              if (!frame) frame = requestAnimationFrame(emit);
            };
            const observer = new ResizeObserver((entries) => {
              for (const entry of entries) {
                const key =
                  entry.target === element
                    ? "$root"
                    : (entry.target as HTMLElement).dataset.measure;
                if (!key) continue;
                const box = entry.borderBoxSize[0];
                boxes[key] = {
                  width:
                    entry.target === element
                      ? entry.contentRect.width
                      : (box?.inlineSize ?? entry.contentRect.width),
                  height:
                    entry.target === element
                      ? entry.contentRect.height
                      : (box?.blockSize ?? entry.contentRect.height),
                };
              }
              schedule();
            });
            const reconcile = () => {
              const next = new Set([
                element,
                ...Array.from(element.querySelectorAll("[data-measure]")),
              ]);
              for (const node of observed)
                if (!next.has(node)) {
                  observer.unobserve(node);
                  observed.delete(node);
                  const key = (node as HTMLElement).dataset.measure;
                  if (key) delete boxes[key];
                }
              for (const node of next)
                if (!observed.has(node)) {
                  observer.observe(node);
                  observed.add(node);
                }
              schedule();
            };
            const mutation = new MutationObserver(reconcile);
            mutation.observe(element, { childList: true, subtree: true });
            reconcile();
            return () => {
              observer.disconnect();
              mutation.disconnect();
              cancelAnimationFrame(frame);
            };
          }),
          (dispose) => Effect.sync(dispose),
        );
        return yield* Effect.never;
      }),
    ),
});
