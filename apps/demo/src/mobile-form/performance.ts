/// <reference types="vite/client" />
import { Effect, Schema as S, Stream } from "effect";
import { Mount } from "foldkit";
import type { Runtime } from "foldkit";

/**
 * A measurement probe for the mobile form. The runtime reports every Update,
 * View, and Patch duration through its `slow` hook, and an input listener
 * records the time from each keystroke or tap to the next painted frame.
 *
 * The readout writes to the DOM directly instead of dispatching Messages, so
 * displaying the numbers never causes the renders being measured.
 */

type Phase = "Update" | "View" | "Patch" | "Paint";
const LIMIT = 400;
const samples: Record<Phase, Array<number>> = { Update: [], View: [], Patch: [], Paint: [] };

const push = (phase: Phase, ms: number) => {
  const list = samples[phase];
  list.push(ms);
  if (list.length > LIMIT) list.shift();
};

const defaultBudgets = { Update: 4, View: 16, Patch: 8, SubscriptionDependencies: 2 } as const;

/** Measure every phase; keep Foldkit's default slow warnings in development. */
export const slowConfig = <Model, Message>(): Runtime.SlowConfig<Model, Message> => ({
  show: "Always",
  measuredPhases: ["Update", "View", "Patch"],
  thresholdOverrides: { Update: -1, View: -1, Patch: -1 },
  onSlow: (context) => {
    if (context._tag !== "SubscriptionDependencies") push(context._tag, context.durationMs);
    if (import.meta.env.DEV && context.durationMs > defaultBudgets[context._tag])
      console.warn(`[foldkit] Slow ${context._tag}: ${context.durationMs.toFixed(1)}ms`);
  },
});

export const percentile = (values: ReadonlyArray<number>, p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
};

const format = (ms: number): string => (ms < 1 ? `${ms.toFixed(2)} ms` : `${ms.toFixed(1)} ms`);

/** Records input-to-next-paint for interactions inside the observed element. */
export const Readout = Mount.defineStream("MobileFormPerformanceReadout", {
  args: { scope: S.String },
  messages: [S.Never],
  execute: ({ scope, element }) =>
    Stream.callback<never>(() =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            const onInteraction = (event: Event) => {
              if (!(event.target instanceof Element) || !event.target.closest(scope)) return;
              const start = event.timeStamp;
              requestAnimationFrame(() =>
                setTimeout(() => push("Paint", performance.now() - start), 0),
              );
            };
            const render = () => {
              for (const phase of ["Update", "View", "Patch", "Paint"] as const) {
                const cell = element.querySelector(`[data-phase="${phase}"]`);
                if (cell === null) continue;
                const values = samples[phase];
                cell.textContent =
                  values.length === 0
                    ? "–"
                    : `${format(percentile(values, 50))} · ${format(percentile(values, 95))}`;
              }
              const count = element.querySelector("[data-count]");
              if (count !== null) count.textContent = String(samples.Paint.length);
            };
            document.addEventListener("input", onInteraction, true);
            document.addEventListener("click", onInteraction, true);
            const timer = setInterval(render, 500);
            return () => {
              document.removeEventListener("input", onInteraction, true);
              document.removeEventListener("click", onInteraction, true);
              clearInterval(timer);
            };
          }),
          (dispose) => Effect.sync(dispose),
        );
        return yield* Effect.never;
      }),
    ),
});

/** Exposes raw samples so the benchmark script can read the same numbers. */
export const exposeSamples = () => {
  (globalThis as { __foldworksMobileFormSamples?: typeof samples }).__foldworksMobileFormSamples =
    samples;
};
