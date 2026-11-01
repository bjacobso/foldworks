import { Effect, Queue, Schema as S, Stream } from "effect";
import { Mount } from "foldkit";
import type { PDFPageProxy, TextLayer as PdfJsTextLayer } from "pdfjs-dist";
import {
  base64ToBytes,
  displayRectToUserSpace,
  getPage,
  pageInfo,
  rasterizePage,
  withPdfDocument,
} from "../pdf";

import { Message } from "./viewer-message";

/** A mounted document owns one worker, the render queue, and optional native text layers. */
export const RenderVisiblePages = Mount.defineStream("RenderVisiblePdfPages", {
  args: {
    revision: S.Number,
    bytesBase64: S.String,
    scale: S.Number,
    maxCachedPages: S.Number,
    selectableText: S.Boolean,
  },
  messages: [
    Message.StartedRenderSession,
    Message.FailedRenderSession,
    Message.ChangedVisiblePages,
    Message.CompletedRenderPage,
    Message.FailedRenderPage,
    Message.SelectedText,
  ],
  execute: ({ element, revision, bytesBase64, scale, maxCachedPages, selectableText }) =>
    Stream.callback((output) =>
      Effect.gen(function* () {
        const requests = yield* Queue.sliding<void>(1);
        const root = element as HTMLElement;
        const scroller = root.parentElement!;
        const inFlight = new Set<number>();
        const resources = new Map<number, { page: PDFPageProxy; layer?: PdfJsTextLayer }>();
        let desired: number[] = [];
        let reported = "";
        const emit = (
          message: Extract<
            Message,
            {
              _tag:
                | "StartedRenderSession"
                | "FailedRenderSession"
                | "ChangedVisiblePages"
                | "CompletedRenderPage"
                | "FailedRenderPage"
                | "SelectedText";
            }
          >,
        ) => Queue.offerUnsafe(output, message);
        const disposePages = () => {
          for (const resource of resources.values()) {
            resource.layer?.cancel();
            resource.page.cleanup();
          }
          resources.clear();
        };
        emit(Message.StartedRenderSession({ revision }));
        const elements = () =>
          Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-viewer-page]"));
        const nodeFor = (index: number) =>
          root.querySelector<HTMLElement>(`[data-pdf-viewer-page="${index}"]`);
        const schedule = () => {
          const viewport = scroller.getBoundingClientRect();
          const center = (viewport.top + viewport.bottom) / 2;
          desired = elements()
            .filter((node) => {
              const bounds = node.getBoundingClientRect();
              return (
                bounds.bottom > viewport.top - viewport.height &&
                bounds.top < viewport.bottom + viewport.height
              );
            })
            .sort(
              (a, b) =>
                Math.abs(
                  (a.getBoundingClientRect().top + a.getBoundingClientRect().bottom) / 2 - center,
                ) -
                Math.abs(
                  (b.getBoundingClientRect().top + b.getBoundingClientRect().bottom) / 2 - center,
                ),
            )
            .slice(0, maxCachedPages)
            .map((node) => Number(node.dataset.pdfViewerPage));
          const next = desired.join(",");
          if (next !== reported) {
            reported = next;
            emit(Message.ChangedVisiblePages({ revision, pageIndexes: desired }));
          }
          for (const [index, resource] of resources) {
            const node = nodeFor(index);
            if (node?.dataset.state !== "pending") {
              inFlight.delete(index);
              continue;
            }
            // Keep the completed result until Foldkit has applied the corresponding patch.
            if (inFlight.has(index)) continue;
            resource.layer?.cancel();
            node.querySelector<HTMLElement>("[data-pdf-text-layer]")?.replaceChildren();
            resource.page.cleanup();
            resources.delete(index);
          }
          Queue.offerUnsafe(requests, undefined);
        };
        const updateLayers = () => {
          for (const [index, resource] of resources) {
            const node = nodeFor(index);
            if (node === null || resource.layer === undefined) continue;
            const info = pageInfo(resource.page, index);
            const layerNode = node.querySelector<HTMLElement>("[data-pdf-text-layer]");
            const displayScale = node.clientWidth / info.width;
            layerNode?.style.setProperty("--total-scale-factor", String(displayScale));
            resource.layer.update({ viewport: resource.page.getViewport({ scale: displayScale }) });
          }
          schedule();
        };
        const select = () => {
          if (!selectableText) return;
          const selection = root.ownerDocument.getSelection();
          if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return;
          const range = selection.getRangeAt(0);
          const parent = (node: Node) => (node instanceof Element ? node : node.parentElement);
          if (
            !parent(range.startContainer)?.closest("[data-pdf-text-layer]") ||
            !parent(range.endContainer)?.closest("[data-pdf-text-layer]") ||
            !root.contains(range.startContainer) ||
            !root.contains(range.endContainer)
          )
            return;
          const regions = [];
          const texts: string[] = [];
          for (const node of elements()) {
            const layer = node.querySelector<HTMLElement>("[data-pdf-text-layer]");
            if (layer === null || !range.intersectsNode(layer)) continue;
            const resource = resources.get(Number(node.dataset.pdfViewerPage));
            if (resource === undefined) continue;
            const part = range.cloneRange();
            if (!layer.contains(part.startContainer)) part.setStart(layer, 0);
            if (!layer.contains(part.endContainer)) part.setEnd(layer, layer.childNodes.length);
            const bounds = node.getBoundingClientRect();
            const info = pageInfo(resource.page, Number(node.dataset.pdfViewerPage));
            const seen = new Set<string>();
            const rects = Array.from(part.getClientRects())
              .filter((rect) => rect.width > 0 && rect.height > 0)
              .filter((rect) => {
                const key = [rect.left, rect.top, rect.width, rect.height]
                  .map((value) => value.toFixed(3))
                  .join(",");
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              })
              .map((rect) =>
                displayRectToUserSpace(info, {
                  x: ((rect.left - bounds.left) * info.width) / bounds.width,
                  y: ((rect.top - bounds.top) * info.height) / bounds.height,
                  width: (rect.width * info.width) / bounds.width,
                  height: (rect.height * info.height) / bounds.height,
                }),
              );
            if (rects.length > 0) {
              regions.push({ pageIndex: info.pageIndex, rects });
              texts.push(part.toString());
            }
          }
          if (regions.length > 0)
            emit(
              Message.SelectedText({ revision, selection: { text: texts.join("\n"), regions } }),
            );
        };
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            const resize = new ResizeObserver(updateLayers);
            resize.observe(root);
            const mutations = new MutationObserver(schedule);
            mutations.observe(root, {
              subtree: true,
              attributes: true,
              attributeFilter: ["data-state"],
            });
            scroller.addEventListener("scroll", schedule, { passive: true });
            root.ownerDocument.addEventListener("pointerup", select);
            root.ownerDocument.addEventListener("keyup", select);
            schedule();
            return () => {
              resize.disconnect();
              mutations.disconnect();
              scroller.removeEventListener("scroll", schedule);
              root.ownerDocument.removeEventListener("pointerup", select);
              root.ownerDocument.removeEventListener("keyup", select);
              disposePages();
            };
          }),
          (dispose) => Effect.sync(dispose),
        );
        yield* withPdfDocument(base64ToBytes(bytesBase64), (document) =>
          Effect.gen(function* () {
            const pdfjs = selectableText
              ? yield* Effect.promise(() => import("pdfjs-dist"))
              : undefined;
            while (true) {
              yield* Queue.take(requests);
              const index = desired.find(
                (index) => nodeFor(index)?.dataset.state === "pending" && !inFlight.has(index),
              );
              if (index === undefined) continue;
              inFlight.add(index);
              yield* Effect.gen(function* () {
                const page = yield* getPage(document, index);
                resources.set(index, { page });
                const raster = yield* rasterizePage(page, scale);
                if (selectableText && pdfjs !== undefined) {
                  const node = nodeFor(index)!;
                  const container = node.querySelector<HTMLElement>("[data-pdf-text-layer]")!;
                  const displayScale = node.clientWidth / pageInfo(page, index).width;
                  container.style.setProperty("--total-scale-factor", String(displayScale));
                  const content = yield* Effect.promise(() => page.getTextContent());
                  const layer = new pdfjs.TextLayer({
                    textContentSource: content,
                    container,
                    viewport: page.getViewport({ scale: displayScale }),
                  });
                  resources.set(index, { page, layer });
                  yield* Effect.promise(() => layer.render());
                }
                emit(
                  Message.CompletedRenderPage({ revision, pageIndex: index, url: raster.imageUrl }),
                );
              }).pipe(
                Effect.catchCause((cause) =>
                  Effect.sync(() => {
                    emit(
                      Message.FailedRenderPage({
                        revision,
                        pageIndex: index,
                        reason: String(cause),
                      }),
                    );
                  }),
                ),
              );
              // Wait for Foldkit's patch before releasing the request. A result
              // can be evicted immediately if the viewport changed during rendering;
              // that must not leave the page permanently marked as in flight.
              yield* Effect.promise(
                () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
              );
              inFlight.delete(index);
              schedule();
            }
          }).pipe(Effect.ensuring(Effect.sync(disposePages))),
        ).pipe(
          Effect.catch((error) =>
            Effect.sync(() => {
              emit(Message.FailedRenderSession({ revision, reason: error.reason }));
            }),
          ),
        );
      }),
    ),
});
