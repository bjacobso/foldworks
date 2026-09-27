import { Effect, Schema as S } from "effect";
import { Command, type Update } from "foldkit";

import { base64ToBytes, bytesToBase64, downloadBytes } from "./bytes";
import { readPdfPages, renderPages } from "./render";
import { Message } from "./viewer-message";
import {
  PageImage,
  ViewerDocument,
  Zoom,
  clampZoomPercent,
  effectiveZoomPercent,
  nextPendingPageIndex,
  pagesOf,
  type Model,
  type PageInfo,
  type ViewerPage,
} from "./viewer-model";

type UpdateReturn = Update.Return<Model, Message>;

const failureReason = (error: unknown): string =>
  typeof error === "object" &&
  error !== null &&
  "reason" in error &&
  typeof error.reason === "string"
    ? error.reason
    : error instanceof Error
      ? error.message
      : "The PDF could not be opened.";

const inspect = (revision: number, name: string, bytes: Uint8Array) =>
  readPdfPages(bytes).pipe(
    Effect.map((pages) =>
      Message.CompletedLoad({
        revision,
        name,
        bytesBase64: bytesToBase64(bytes),
        pages: pages.map(
          (page): PageInfo => ({
            pageIndex: page.pageIndex,
            width: page.width,
            height: page.height,
            cropBox: page.cropBox,
            rotation: page.rotation,
          }),
        ),
      }),
    ),
  );

const LoadUrl = Command.define("LoadPdfViewerUrl", {
  args: { revision: S.Number, url: S.String, name: S.String },
  messages: [Message.CompletedLoad, Message.FailedLoad],
  execute: ({ revision, url, name }) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`The PDF request returned ${response.status}.`);
        return new Uint8Array(await response.arrayBuffer());
      },
      catch: (error) => error,
    }).pipe(
      Effect.flatMap((bytes) => inspect(revision, name, bytes)),
      Effect.catch((error) =>
        Effect.succeed(
          Message.FailedLoad({
            revision,
            name,
            reason: failureReason(error),
          }),
        ),
      ),
    ),
});

const LoadBytes = Command.define("LoadPdfViewerBytes", {
  args: { revision: S.Number, name: S.String, bytesBase64: S.String },
  messages: [Message.CompletedLoad, Message.FailedLoad],
  execute: ({ revision, name, bytesBase64 }) =>
    Effect.suspend(() => inspect(revision, name, base64ToBytes(bytesBase64))).pipe(
      Effect.catch((error) =>
        Effect.succeed(
          Message.FailedLoad({
            revision,
            name,
            reason: failureReason(error),
          }),
        ),
      ),
    ),
});

const RenderPage = Command.define("RenderPdfViewerPage", {
  args: { revision: S.Number, bytesBase64: S.String, pageIndex: S.Number, scale: S.Number },
  messages: [Message.CompletedRenderPage, Message.FailedRenderPage],
  execute: ({ revision, bytesBase64, pageIndex, scale }) =>
    Effect.suspend(() =>
      renderPages(base64ToBytes(bytesBase64), { scale, pageIndexes: [pageIndex] }),
    ).pipe(
      Effect.map(([page]) =>
        page === undefined
          ? Message.FailedRenderPage({ revision, pageIndex, reason: "The page did not render." })
          : Message.CompletedRenderPage({ revision, pageIndex, url: page.imageUrl }),
      ),
      Effect.catch((error) =>
        Effect.succeed(
          Message.FailedRenderPage({
            revision,
            pageIndex,
            reason: failureReason(error),
          }),
        ),
      ),
    ),
});

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

const nextFrame = <A>(run: () => A): Effect.Effect<A> =>
  Effect.promise(
    () =>
      new Promise<A>((resolve) => {
        requestAnimationFrame(() => resolve(run()));
      }),
  );

const viewerScroller = (id: string): HTMLElement | null =>
  document.getElementById(id)?.querySelector<HTMLElement>("[data-pdf-viewer-scroller]") ?? null;

const ScrollToPage = Command.define("ScrollPdfViewerToPage", {
  args: { id: S.String, pageIndex: S.Number },
  messages: [Message.CompletedScrollToPage],
  execute: ({ id, pageIndex }) =>
    nextFrame(() => {
      const scroller = viewerScroller(id);
      const page = scroller?.querySelector<HTMLElement>(`[data-pdf-viewer-page="${pageIndex}"]`);
      if (scroller !== null && page !== null && page !== undefined) {
        const offset = page.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        const gap = Number.parseFloat(getComputedStyle(scroller).paddingTop) || 0;
        scroller.scrollTo({ top: scroller.scrollTop + offset - gap, behavior: scrollBehavior() });
      }
      return Message.CompletedScrollToPage();
    }),
});

const ScrollToOverlay = Command.define("ScrollPdfViewerToOverlay", {
  args: { id: S.String, overlayKey: S.String },
  messages: [Message.CompletedScrollToOverlay],
  execute: ({ id, overlayKey }) =>
    nextFrame(() => {
      const overlay = viewerScroller(id)?.querySelector<HTMLElement>(
        `[data-pdf-overlay-key="${CSS.escape(overlayKey)}"]`,
      );
      overlay?.scrollIntoView({ block: "center", inline: "center", behavior: scrollBehavior() });
      return Message.CompletedScrollToOverlay({
        overlayKey,
        found: overlay !== null && overlay !== undefined,
      });
    }),
});

const Download = Command.define("DownloadPdfViewerDocument", {
  args: { bytesBase64: S.String, name: S.String },
  messages: [Message.CompletedDownload],
  execute: ({ bytesBase64, name }) =>
    Effect.sync(() => {
      const fileName = /\.pdf$/i.test(name) ? name : `${name || "document"}.pdf`;
      downloadBytes(base64ToBytes(bytesBase64), fileName, "application/pdf");
      return Message.CompletedDownload();
    }),
});

const pageLabel = (pageIndex: number, pageCount: number): string =>
  `Page ${pageIndex + 1} of ${pageCount}`;

/** Render the next page still waiting, preferring pages near the one in view. */
const renderNext = (model: Model): UpdateReturn => {
  if (model.document._tag !== "Ready") return { model };
  const pageIndex = nextPendingPageIndex(model.document.pages, model.currentPageIndex);
  if (pageIndex === undefined) {
    return {
      model: {
        ...model,
        announcement: `${model.document.name} ready, ${model.document.pages.length} page${model.document.pages.length === 1 ? "" : "s"}.`,
      },
    };
  }
  return {
    model,
    commands: [
      RenderPage({
        revision: model.revision,
        bytesBase64: model.document.bytesBase64,
        pageIndex,
        scale: model.renderScale,
      }),
    ],
  };
};

const replacePage = (model: Model, pageIndex: number, image: PageImage): Model =>
  model.document._tag !== "Ready"
    ? model
    : {
        ...model,
        document: {
          ...model.document,
          pages: model.document.pages.map(
            (page): ViewerPage => (page.pageIndex === pageIndex ? { ...page, image } : page),
          ),
        },
      };

const setZoom = (model: Model, zoom: Zoom): UpdateReturn => {
  const next = { ...model, zoom };
  const label =
    zoom._tag === "FitWidth"
      ? `Fit to width, ${Math.round(effectiveZoomPercent(next))} percent.`
      : `Zoom ${zoom.percent} percent.`;
  return { model: { ...next, announcement: label } };
};

const startLoad = (model: Model, name: string): Model => ({
  ...model,
  document: ViewerDocument.Loading({ name }),
  revision: model.revision + 1,
  currentPageIndex: 0,
  announcement: `Opening ${name}.`,
});

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match(message, {
    RequestedLoadUrl: ({ url, name }) => {
      const next = startLoad(model, name);
      return { model: next, commands: [LoadUrl({ revision: next.revision, url, name })] };
    },
    RequestedLoadBytes: ({ name, bytesBase64 }) => {
      const next = startLoad(model, name);
      return { model: next, commands: [LoadBytes({ revision: next.revision, name, bytesBase64 })] };
    },
    CompletedLoad: ({ revision, name, bytesBase64, pages }) =>
      revision !== model.revision
        ? { model }
        : renderNext({
            ...model,
            document: ViewerDocument.Ready({
              name,
              bytesBase64,
              pages: pages.map((page) => ({ ...page, image: PageImage.Pending() })),
            }),
            currentPageIndex: 0,
            announcement: `Rendering ${name}.`,
          }),
    FailedLoad: ({ revision, name, reason }) =>
      revision !== model.revision
        ? { model }
        : {
            model: {
              ...model,
              document: ViewerDocument.Failed({ name, reason }),
              announcement: `${name} could not be opened. ${reason}`,
            },
          },
    CompletedRenderPage: ({ revision, pageIndex, url }) =>
      revision !== model.revision
        ? { model }
        : renderNext(replacePage(model, pageIndex, PageImage.Rendered({ url }))),
    FailedRenderPage: ({ revision, pageIndex, reason }) =>
      revision !== model.revision
        ? { model }
        : renderNext(replacePage(model, pageIndex, PageImage.Failed({ reason }))),
    RequestedPage: ({ pageIndex }) => {
      const pages = pagesOf(model);
      if (pages.length === 0) return { model };
      const target = Math.min(pages.length - 1, Math.max(0, Math.round(pageIndex)));
      return {
        model: {
          ...model,
          currentPageIndex: target,
          announcement: pageLabel(target, pages.length),
        },
        commands: [ScrollToPage({ id: model.id, pageIndex: target })],
      };
    },
    CompletedScrollToPage: () => ({ model }),
    ScrolledToPage: ({ pageIndex }) => {
      const pages = pagesOf(model);
      const target = Math.min(Math.max(0, pages.length - 1), Math.max(0, pageIndex));
      return target === model.currentPageIndex
        ? { model }
        : { model: { ...model, currentPageIndex: target } };
    },
    MeasuredViewport: ({ width }) =>
      width === model.viewportWidth
        ? { model }
        : { model: { ...model, viewportWidth: Math.max(0, width) } },
    ChangedZoom: ({ percent }) =>
      setZoom(model, Zoom.Percent({ percent: clampZoomPercent(percent) })),
    SelectedFitWidth: () => setZoom(model, Zoom.FitWidth()),
    RequestedScrollToOverlay: ({ overlayKey }) => ({
      model,
      commands: [ScrollToOverlay({ id: model.id, overlayKey })],
    }),
    CompletedScrollToOverlay: () => ({ model }),
    ClickedDownload: () =>
      model.document._tag !== "Ready"
        ? { model }
        : {
            model: { ...model, announcement: `Downloading ${model.document.name}.` },
            commands: [
              Download({ bytesBase64: model.document.bytesBase64, name: model.document.name }),
            ],
          },
    CompletedDownload: () => ({ model }),
  });

/** Load a PDF from a URL. Dispatch the result through the viewer's update. */
export const loadUrl = (
  url: string,
  name = url.split("/").pop()?.split("?")[0] || "document.pdf",
): Message => Message.RequestedLoadUrl({ url, name });

/** Load PDF bytes the application already holds, such as a freshly filled form. */
export const loadBytes = (name: string, bytes: Uint8Array): Message =>
  Message.RequestedLoadBytes({ name, bytesBase64: bytesToBase64(bytes) });

/** Scroll the overlay with `overlayKey` into view, centered in the viewer. */
export const scrollTo = (overlayKey: string): Message =>
  Message.RequestedScrollToOverlay({ overlayKey });

/** Scroll to a zero-based page. */
export const goToPage = (pageIndex: number): Message => Message.RequestedPage({ pageIndex });
