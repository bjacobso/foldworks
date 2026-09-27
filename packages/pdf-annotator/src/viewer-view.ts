import { Effect, Queue, Stream } from "effect";
import { Mount } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FileX,
  MoveHorizontal,
  ZoomIn,
  ZoomOut,
} from "@lucide/icons";
import { Button, Empty, Icon, Skeleton } from "@foldworks/ui";

import type { PdfRect } from "./model";
import { userSpaceToPageFraction } from "./page-geometry";
import { Message } from "./viewer-message";
import {
  MAX_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
  effectiveZoomPercent,
  nextZoomStep,
  pageDisplayWidth,
  type Model,
  type ViewerPage,
} from "./viewer-model";

export type PdfOverlayTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

/**
 * A rectangle drawn over a page. `rect` is in PDF user space: points from the
 * bottom-left of the page's coordinate system, exactly as a widget's `/Rect`
 * stores it. The viewer accounts for the crop box offset and page rotation.
 */
export type PdfOverlay<ParentMessage> = Readonly<{
  key: string;
  /** Zero-based page index. */
  pageIndex: number;
  rect: PdfRect;
  /** Accessible name, announced by screen readers and used as the hover title by default. */
  label: string;
  tone?: PdfOverlayTone;
  /** Free-form application status, exposed as `data-status` for custom styling. */
  status?: string;
  isSelected?: boolean;
  /** Makes the overlay a button that sends this message when activated. */
  onClick?: ParentMessage;
  /** Hover text. Defaults to `label`. */
  title?: string;
}>;

export type ViewConfig<ParentMessage> = Readonly<{
  model: Model;
  toParentMessage: (message: Message) => ParentMessage;
  overlays?: ReadonlyArray<PdfOverlay<ParentMessage>>;
  /** Rendered between the toolbar and the pages, e.g. a "Synthetic preview" alert. */
  banner?: Html;
  /** Text stamped faintly across every page. Decorative; pair it with a banner for screen readers. */
  watermark?: string;
  /** Extra toolbar controls rendered before the download button. */
  actions?: ReadonlyArray<Html>;
  /** Accessible name for the viewer region. Defaults to "PDF viewer". */
  label?: string;
  showToolbar?: boolean;
  showDownload?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}>;

const LOADING_PAGE_ASPECT = "612 / 792";

/**
 * Observe the scroller: report its width for fit-to-width zoom, report the
 * page that fills most of the viewport, and keep the viewport's center stable
 * when zoom changes the content size.
 */
const ObserveScroller = Mount.defineStream("ObservePdfViewerScroller", {
  messages: [Message.MeasuredViewport, Message.ScrolledToPage],
  execute: ({ element }) =>
    Stream.callback((queue) =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            const scroller = element as HTMLElement;
            let frame = 0;
            let previousWidth = -1;
            let previousPage = -1;
            let anchorX = 0.5;
            let anchorY = 0;
            let atTop = true;
            let content: Element | null = null;

            const rememberAnchor = () => {
              atTop = scroller.scrollTop <= 1;
              anchorX =
                scroller.scrollWidth === 0
                  ? 0.5
                  : (scroller.scrollLeft + scroller.clientWidth / 2) / scroller.scrollWidth;
              anchorY =
                scroller.scrollHeight === 0
                  ? 0
                  : (scroller.scrollTop + scroller.clientHeight / 2) / scroller.scrollHeight;
            };

            const reportPage = () => {
              const viewport = scroller.getBoundingClientRect();
              let best = -1;
              let bestVisible = 0;
              for (const page of Array.from(
                scroller.querySelectorAll<HTMLElement>("[data-pdf-viewer-page]"),
              )) {
                const bounds = page.getBoundingClientRect();
                const visible =
                  Math.min(bounds.bottom, viewport.bottom) - Math.max(bounds.top, viewport.top);
                if (visible > bestVisible) {
                  bestVisible = visible;
                  best = Number(page.dataset.pdfViewerPage);
                }
              }
              if (best >= 0 && best !== previousPage) {
                previousPage = best;
                Queue.offerUnsafe(queue, Message.ScrolledToPage({ pageIndex: best }));
              }
            };

            const reportWidth = () => {
              const width = scroller.clientWidth;
              if (width === previousWidth) return;
              previousWidth = width;
              Queue.offerUnsafe(queue, Message.MeasuredViewport({ width }));
            };

            const onScroll = () => {
              cancelAnimationFrame(frame);
              frame = requestAnimationFrame(() => {
                rememberAnchor();
                reportPage();
              });
            };

            const restoreAnchor = () => {
              if (atTop) {
                scroller.scrollTop = 0;
              } else {
                scroller.scrollTop = anchorY * scroller.scrollHeight - scroller.clientHeight / 2;
              }
              scroller.scrollLeft = anchorX * scroller.scrollWidth - scroller.clientWidth / 2;
              reportPage();
            };

            const scrollerObserver = new ResizeObserver(reportWidth);
            const contentObserver = new ResizeObserver(restoreAnchor);
            const observeContent = () => {
              const next = scroller.firstElementChild;
              if (next === content) return;
              if (content !== null) contentObserver.unobserve(content);
              content = next;
              atTop = true;
              previousPage = -1;
              if (content !== null) contentObserver.observe(content);
            };
            const mutationObserver = new MutationObserver(observeContent);

            scroller.addEventListener("scroll", onScroll, { passive: true });
            scrollerObserver.observe(scroller);
            mutationObserver.observe(scroller, { childList: true });
            observeContent();
            reportWidth();
            return {
              dispose: () => {
                cancelAnimationFrame(frame);
                scroller.removeEventListener("scroll", onScroll);
                scrollerObserver.disconnect();
                contentObserver.disconnect();
                mutationObserver.disconnect();
              },
            };
          }),
          ({ dispose }) => Effect.sync(dispose),
        );
        return yield* Effect.never;
      }),
    ),
});

const skeleton = <ParentMessage>(label: string, h: HtmlBuilder<ParentMessage>): Html =>
  h.div(
    [h.Class("fk-pdf-viewer__skeleton")],
    [Skeleton.view({ label, width: "100%", height: "100%" }, h)],
  );

const percent = (fraction: number): string => `${fraction * 100}%`;

const overlayView = <ParentMessage>(
  page: ViewerPage,
  overlay: PdfOverlay<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const box = userSpaceToPageFraction(page, overlay.rect);
  const attributes = [
    h.Class("fk-pdf-viewer__overlay"),
    h.Style({
      left: percent(box.x),
      top: percent(box.y),
      width: percent(box.width),
      height: percent(box.height),
    }),
    h.DataAttribute("pdf-overlay-key", overlay.key),
    h.DataAttribute("tone", overlay.tone ?? "neutral"),
    h.DataAttribute("selected", overlay.isSelected === true ? "true" : "false"),
    ...(overlay.status === undefined ? [] : [h.DataAttribute("status", overlay.status)]),
    h.Title(overlay.title ?? overlay.label),
    h.AriaLabel(overlay.label),
  ];
  return overlay.onClick === undefined
    ? h.keyed("span")(overlay.key, [...attributes, h.Role("img")], [])
    : h.keyed("button")(
        overlay.key,
        [
          ...attributes,
          h.Type("button"),
          h.AriaPressed(overlay.isSelected === true ? "true" : "false"),
          h.OnClick(overlay.onClick),
        ],
        [],
      );
};

const pageView = <ParentMessage>(
  config: ViewConfig<ParentMessage>,
  name: string,
  pageCount: number,
  page: ViewerPage,
  overlays: ReadonlyArray<PdfOverlay<ParentMessage>>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const label = `Page ${page.pageIndex + 1} of ${pageCount}`;
  return h.keyed("div")(
    `page-${page.pageIndex}`,
    [
      h.Class("fk-pdf-viewer__page"),
      h.DataAttribute("pdf-viewer-page", String(page.pageIndex)),
      h.DataAttribute("state", page.image._tag.toLowerCase()),
      h.Role("group"),
      h.AriaLabel(label),
      h.Style({
        width: `${pageDisplayWidth(config.model, page)}px`,
        aspectRatio: `${page.width} / ${page.height}`,
      }),
    ],
    [
      page.image._tag === "Rendered"
        ? h.img([
            h.Class("fk-pdf-viewer__page-image"),
            h.Src(page.image.url),
            h.Alt(`${label} of ${name}`),
            h.Draggable(false),
          ])
        : page.image._tag === "Failed"
          ? h.div(
              [h.Class("fk-pdf-viewer__page-error"), h.Role("alert")],
              [
                Icon.view({ icon: FileX, size: 18 }, h),
                h.span([], [`${label} could not be rendered. ${page.image.reason}`]),
              ],
            )
          : skeleton(`Rendering ${label.toLowerCase()}`, h),
      config.watermark === undefined
        ? h.empty
        : h.span([h.Class("fk-pdf-viewer__watermark"), h.AriaHidden(true)], [config.watermark]),
      overlays.length === 0
        ? h.empty
        : h.div(
            [h.Class("fk-pdf-viewer__overlays")],
            overlays.map((overlay) => overlayView(page, overlay, h)),
          ),
    ],
  );
};

const toolbarView = <ParentMessage>(
  config: ViewConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { model, toParentMessage } = config;
  const ready = model.document._tag === "Ready" ? model.document : undefined;
  const pageCount = ready?.pages.length ?? 0;
  const zoom = effectiveZoomPercent(model);
  const name = model.document._tag === "Empty" ? "No document" : model.document.name;
  return h.div(
    [h.Class("fk-pdf-viewer__toolbar"), h.Role("toolbar"), h.AriaLabel("PDF controls")],
    [
      h.div(
        [h.Class("fk-pdf-viewer__document")],
        [
          h.span(
            [h.Class("fk-pdf-viewer__document-icon")],
            [Icon.view({ icon: FileText, size: 15 }, h)],
          ),
          h.div(
            [],
            [
              h.strong([h.Title(name)], [name]),
              h.span(
                [],
                [
                  ready === undefined
                    ? model.document._tag === "Loading"
                      ? "Opening…"
                      : ""
                    : `${pageCount} page${pageCount === 1 ? "" : "s"}`,
                ],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("fk-pdf-viewer__controls")],
        [
          Button.view(
            {
              icon: ChevronLeft,
              ariaLabel: "Previous page",
              variant: "ghost",
              size: "icon",
              isDisabled: ready === undefined || model.currentPageIndex <= 0,
              onClick: toParentMessage(
                Message.RequestedPage({ pageIndex: model.currentPageIndex - 1 }),
              ),
            },
            h,
          ),
          h.span(
            [h.Class("fk-pdf-viewer__page-label")],
            [
              ready === undefined
                ? "Page – of –"
                : `Page ${model.currentPageIndex + 1} of ${pageCount}`,
            ],
          ),
          Button.view(
            {
              icon: ChevronRight,
              ariaLabel: "Next page",
              variant: "ghost",
              size: "icon",
              isDisabled: ready === undefined || model.currentPageIndex >= pageCount - 1,
              onClick: toParentMessage(
                Message.RequestedPage({ pageIndex: model.currentPageIndex + 1 }),
              ),
            },
            h,
          ),
          h.span([h.Class("fk-pdf-viewer__divider"), h.AriaHidden(true)], []),
          Button.view(
            {
              icon: ZoomOut,
              ariaLabel: "Zoom out",
              variant: "ghost",
              size: "icon",
              isDisabled: Math.round(zoom) <= MIN_ZOOM_PERCENT,
              onClick: toParentMessage(Message.ChangedZoom({ percent: nextZoomStep(zoom, "out") })),
            },
            h,
          ),
          Button.view(
            {
              label: `${Math.round(zoom)}%`,
              ariaLabel: `Zoom ${Math.round(zoom)} percent. Reset to 100 percent`,
              variant: "ghost",
              size: "sm",
              onClick: toParentMessage(Message.ChangedZoom({ percent: 100 })),
            },
            h,
          ),
          Button.view(
            {
              icon: ZoomIn,
              ariaLabel: "Zoom in",
              variant: "ghost",
              size: "icon",
              isDisabled: Math.round(zoom) >= MAX_ZOOM_PERCENT,
              onClick: toParentMessage(Message.ChangedZoom({ percent: nextZoomStep(zoom, "in") })),
            },
            h,
          ),
          Button.view(
            {
              label: "Fit width",
              icon: MoveHorizontal,
              variant: model.zoom._tag === "FitWidth" ? "secondary" : "ghost",
              size: "sm",
              onClick: toParentMessage(Message.SelectedFitWidth()),
            },
            h,
          ),
        ],
      ),
      h.div(
        [h.Class("fk-pdf-viewer__actions")],
        [
          ...(config.actions ?? []),
          config.showDownload === false
            ? h.empty
            : Button.view(
                {
                  label: "Download",
                  icon: Download,
                  variant: "outline",
                  size: "sm",
                  isDisabled: ready === undefined,
                  onClick: toParentMessage(Message.ClickedDownload()),
                },
                h,
              ),
        ],
      ),
    ],
  );
};

const contentView = <ParentMessage>(
  config: ViewConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { model } = config;
  switch (model.document._tag) {
    case "Empty":
      return h.div(
        [h.Class("fk-pdf-viewer__state")],
        [
          Empty.view(
            {
              title: config.emptyTitle ?? "No PDF loaded",
              ...(config.emptyDescription === undefined
                ? {}
                : { description: config.emptyDescription }),
              media: Icon.view({ icon: FileText, size: 20 }, h),
            },
            h,
          ),
        ],
      );
    case "Failed":
      return h.div(
        [h.Class("fk-pdf-viewer__state"), h.Role("alert")],
        [
          Empty.view(
            {
              title: "That PDF did not open",
              description: model.document.reason,
              media: Icon.view({ icon: FileX, size: 20 }, h),
            },
            h,
          ),
        ],
      );
    case "Loading":
      // Keyed by revision so each new document starts scrolled to the top.
      return h.keyed("div")(
        `document-${model.revision}`,
        [h.Class("fk-pdf-viewer__pages")],
        [
          h.div(
            [
              h.Class("fk-pdf-viewer__page"),
              h.DataAttribute("state", "pending"),
              h.Style({
                width: `${pageDisplayWidth(model, { width: 612 })}px`,
                aspectRatio: LOADING_PAGE_ASPECT,
              }),
            ],
            [skeleton(`Opening ${model.document.name}`, h)],
          ),
        ],
      );
    case "Ready": {
      const document = model.document;
      const overlays = config.overlays ?? [];
      return h.keyed("div")(
        `document-${model.revision}`,
        [h.Class("fk-pdf-viewer__pages")],
        document.pages.map((page) =>
          pageView(
            config,
            document.name,
            document.pages.length,
            page,
            overlays.filter((overlay) => overlay.pageIndex === page.pageIndex),
            h,
          ),
        ),
      );
    }
  }
};

export const view = <ParentMessage>(
  config: ViewConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.section(
    [
      h.Class("fk-pdf-viewer"),
      h.Id(config.model.id),
      h.AriaLabel(config.label ?? "PDF viewer"),
      h.DataAttribute("document-state", config.model.document._tag.toLowerCase()),
    ],
    [
      config.showToolbar === false ? h.empty : toolbarView(config, h),
      config.banner === undefined
        ? h.empty
        : h.div([h.Class("fk-pdf-viewer__banner")], [config.banner]),
      h.div(
        [
          h.Class("fk-pdf-viewer__scroller"),
          h.DataAttribute("pdf-viewer-scroller", "true"),
          h.Tabindex(0),
          h.AriaLabel(
            config.model.document._tag === "Ready"
              ? `${config.model.document.name} pages`
              : "PDF pages",
          ),
          h.AriaBusy(
            config.model.document._tag === "Loading" ||
              (config.model.document._tag === "Ready" &&
                config.model.document.pages.some((page) => page.image._tag === "Pending")),
          ),
          h.OnMount(Mount.mapMessage(ObserveScroller(), config.toParentMessage)),
        ],
        [contentView(config, h)],
      ),
      h.div([h.Class("fk-pdf-viewer__sr-only"), h.AriaLive("polite")], [config.model.announcement]),
    ],
  );
