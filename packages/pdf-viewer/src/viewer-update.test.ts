import { describe, expect, it } from "vitest";

import { Message } from "./viewer-message";
import {
  CSS_PIXELS_PER_POINT,
  PAGE_GUTTER,
  effectiveZoomPercent,
  init,
  nextZoomStep,
  pageDisplayWidth,
  type Model,
  type PageInfo,
} from "./viewer-model";
import { loadBytes, scrollTo, update } from "./viewer-update";

const page = (pageIndex: number, width = 612, height = 792): PageInfo => ({
  pageIndex,
  width,
  height,
  cropBox: { x: 0, y: 0, width, height },
  rotation: 0,
});

const commandNames = (result: ReturnType<typeof update>): ReadonlyArray<string> =>
  (result.commands ?? []).map((command) => command.name);

const loaded = (pages: ReadonlyArray<PageInfo> = [page(0), page(1), page(2)]): Model => {
  const requested = update(
    init({ id: "journey-pdf" }),
    loadBytes("i-9.pdf", new Uint8Array([37, 80, 68, 70])),
  ).model;
  return update(
    requested,
    Message.CompletedLoad({
      revision: requested.revision,
      name: "i-9.pdf",
      bytesBase64: "JVBERg==",
      pages,
    }),
  ).model;
};

describe("PDF viewer update", () => {
  it("opens a document, then renders its pages one at a time", () => {
    const requested = update(
      init({ id: "journey-pdf" }),
      loadBytes("i-9.pdf", new Uint8Array([37, 80, 68, 70])),
    );
    expect(requested.model.document._tag).toBe("Loading");
    expect(commandNames(requested)).toEqual(["LoadPdfViewerBytes"]);

    const opened = update(
      requested.model,
      Message.CompletedLoad({
        revision: requested.model.revision,
        name: "i-9.pdf",
        bytesBase64: "JVBERg==",
        pages: [page(0), page(1)],
      }),
    );
    expect(opened.model.document._tag).toBe("Ready");
    expect(commandNames(opened)).toEqual(["RenderPdfViewerPage"]);

    const first = update(
      opened.model,
      Message.CompletedRenderPage({
        revision: opened.model.revision,
        pageIndex: 0,
        url: "data:image/png;base64,AA==",
      }),
    );
    expect(commandNames(first)).toEqual(["RenderPdfViewerPage"]);

    const second = update(
      first.model,
      Message.FailedRenderPage({
        revision: first.model.revision,
        pageIndex: 1,
        reason: "Broken content stream.",
      }),
    );
    expect(commandNames(second)).toEqual([]);
    const pages = second.model.document._tag === "Ready" ? second.model.document.pages : [];
    expect(pages.map((item) => item.image._tag)).toEqual(["Rendered", "Failed"]);
  });

  it("ignores results that arrive after a newer document was requested", () => {
    const first = update(init({ id: "journey-pdf" }), loadBytes("first.pdf", new Uint8Array([1])));
    const second = update(first.model, loadBytes("second.pdf", new Uint8Array([2])));
    const stale = update(
      second.model,
      Message.CompletedLoad({
        revision: first.model.revision,
        name: "first.pdf",
        bytesBase64: "AQ==",
        pages: [page(0)],
      }),
    );
    expect(stale.model).toBe(second.model);
    expect(commandNames(stale)).toEqual([]);
  });

  it("fits the widest page to the measured scroller", () => {
    const model = update(
      loaded([page(0), page(1, 792, 612)]),
      Message.MeasuredViewport({ width: 1104 }),
    ).model;
    const expected = ((1104 - PAGE_GUTTER * 2) / (792 * CSS_PIXELS_PER_POINT)) * 100;
    expect(effectiveZoomPercent(model)).toBeCloseTo(expected);
    expect(pageDisplayWidth(model, { width: 792 })).toBeCloseTo(1104 - PAGE_GUTTER * 2);
    const wide = update(model, Message.MeasuredViewport({ width: 4000 })).model;
    expect(effectiveZoomPercent(wide)).toBe(200);
  });

  it("steps and clamps zoom between 50% and 200%", () => {
    const zoomed = update(loaded(), Message.ChangedZoom({ percent: 400 })).model;
    expect(effectiveZoomPercent(zoomed)).toBe(200);
    expect(effectiveZoomPercent(update(zoomed, Message.ChangedZoom({ percent: 10 })).model)).toBe(
      50,
    );
    expect(nextZoomStep(88, "in")).toBe(100);
    expect(nextZoomStep(88, "out")).toBe(75);
    expect(nextZoomStep(200, "in")).toBe(200);
    const fitted = update(zoomed, Message.SelectedFitWidth()).model;
    expect(fitted.zoom._tag).toBe("FitWidth");
  });

  it("navigates to clamped pages and scrolls them into view", () => {
    const result = update(loaded(), Message.RequestedPage({ pageIndex: 9 }));
    expect(result.model.currentPageIndex).toBe(2);
    expect(commandNames(result)).toEqual(["ScrollPdfViewerToPage"]);
    expect(
      update(result.model, Message.ScrolledToPage({ pageIndex: 1 })).model.currentPageIndex,
    ).toBe(1);
  });

  it("scrolls to an overlay and downloads the original bytes", () => {
    expect(commandNames(update(loaded(), scrollTo("employee-ssn")))).toEqual([
      "ScrollPdfViewerToOverlay",
    ]);
    expect(commandNames(update(loaded(), Message.ClickedDownload()))).toEqual([
      "DownloadPdfViewerDocument",
    ]);
    expect(commandNames(update(init({ id: "empty" }), Message.ClickedDownload()))).toEqual([]);
  });
});
