import { Effect, Schema as S, Stream } from "effect";
import { Mount } from "foldkit";
/** Keep Enter/Escape used by an IME away from editing and ancestor shortcut handlers. */
export const GuardComposition = Mount.defineStream("GuardTextComposition", {
  messages: [S.Never],
  execute: ({ element }) =>
    Stream.callback<never>(() =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            let composing = false;
            const start = () => {
              composing = true;
            };
            const end = () => {
              composing = false;
            };
            const key = (event: Event) => {
              const keyboard = event as KeyboardEvent;
              if (composing || keyboard.isComposing || keyboard.keyCode === 229)
                keyboard.stopImmediatePropagation();
            };
            element.addEventListener("compositionstart", start);
            element.addEventListener("compositionend", end);
            element.addEventListener("keydown", key, true);
            return () => {
              element.removeEventListener("compositionstart", start);
              element.removeEventListener("compositionend", end);
              element.removeEventListener("keydown", key, true);
            };
          }),
          (dispose) => Effect.sync(dispose),
        );
        return yield* Effect.never;
      }),
    ),
});
