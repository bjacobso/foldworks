import { Effect, Queue, Stream } from "effect";
import { Mount } from "foldkit";

import { Message } from "./message";
import type { Viewport } from "./model";

export const DATA_GRID_HEADER_HEIGHT = 39;

export type VirtualizationConfig = Readonly<{
  overscan?: number;
  initialViewportHeight?: number;
}>;

export type VirtualWindow = Readonly<{
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
}>;

export const virtualWindow = (
  rowCount: number,
  rowHeight: number,
  viewport: Viewport,
  overscan = 4,
  includeRowIndex?: number,
): VirtualWindow => {
  if (rowCount <= 0) {
    return { startIndex: 0, endIndex: 0, paddingTop: 0, paddingBottom: 0 };
  }
  const safeRowHeight = Number.isFinite(rowHeight) ? Math.max(1, rowHeight) : 1;
  const safeOverscan = Number.isFinite(overscan)
    ? Math.max(1, Math.floor(overscan))
    : 4;
  const scrollTop = Number.isFinite(viewport.scrollTop)
    ? Math.max(0, viewport.scrollTop)
    : 0;
  const viewportHeight = Number.isFinite(viewport.height)
    ? Math.max(0, viewport.height)
    : 0;
  const bodyScrollTop = Math.max(0, scrollTop - DATA_GRID_HEADER_HEIGHT);
  const bodyViewportHeight = Math.max(
    safeRowHeight,
    viewportHeight - DATA_GRID_HEADER_HEIGHT,
  );
  const firstVisible = Math.min(
    rowCount - 1,
    Math.floor(bodyScrollTop / safeRowHeight),
  );
  const lastVisible = Math.min(
    rowCount,
    Math.ceil((bodyScrollTop + bodyViewportHeight) / safeRowHeight),
  );
  let startIndex = Math.max(0, firstVisible - safeOverscan);
  let endIndex = Math.min(rowCount, lastVisible + safeOverscan);
  if (
    includeRowIndex !== undefined &&
    includeRowIndex >= 0 &&
    includeRowIndex < rowCount
  ) {
    startIndex = Math.min(startIndex, includeRowIndex);
    endIndex = Math.max(endIndex, includeRowIndex + 1);
  }
  return {
    startIndex,
    endIndex,
    paddingTop: startIndex * safeRowHeight,
    paddingBottom: (rowCount - endIndex) * safeRowHeight,
  };
};

export const ObserveViewport = Mount.defineStream("ObserveDataGridViewport", {
  messages: [Message.MeasuredViewport],
  execute: ({ element }) => Stream.callback((queue) => Effect.gen(function* () {
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const scroller = element as HTMLElement;
        let frame = 0;
        let disposed = false;
        let previousScrollTop = -1;
        let previousHeight = -1;
        const emit = () => {
          if (disposed) return;
          const scrollTop = scroller.scrollTop;
          const height = scroller.clientHeight;
          if (scrollTop === previousScrollTop && height === previousHeight) return;
          previousScrollTop = scrollTop;
          previousHeight = height;
          Queue.offerUnsafe(queue, Message.MeasuredViewport({ scrollTop, height }));
        };
        const schedule = () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(emit);
        };
        const observer = new ResizeObserver(schedule);
        scroller.addEventListener("scroll", schedule, { passive: true });
        observer.observe(scroller);
        emit();
        return {
          dispose: () => {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            scroller.removeEventListener("scroll", schedule);
          },
        };
      }),
      ({ dispose }) => Effect.sync(dispose),
    );
    return yield* Effect.never;
  })),
});
