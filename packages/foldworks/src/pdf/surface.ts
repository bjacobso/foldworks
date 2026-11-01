import type { Attribute, Html, HtmlBuilder } from "foldkit/html";

import { userSpaceToPageFraction, type PdfPageGeometry } from "./page-geometry";
import type { PdfRect } from "./rect";

export type SurfaceOverlay = Readonly<{ key: string; rect: PdfRect }>;

/** CSS placement for a PDF user-space rectangle on a displayed page. */
export const overlayPosition = (
  page: PdfPageGeometry,
  rect: PdfRect,
): Readonly<{ left: string; top: string; width: string; height: string }> => {
  const fraction = userSpaceToPageFraction(page, rect);
  const percent = (value: number): string => `${value * 100}%`;
  return {
    left: percent(fraction.x),
    top: percent(fraction.y),
    width: percent(fraction.width),
    height: percent(fraction.height),
  };
};

export type PageSurfaceConfig<Message> = Readonly<{
  key: string;
  pageIndex: number;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight?: number;
  label: string;
  content: ReadonlyArray<Html>;
  className?: string;
  dataAttributes?: Readonly<Record<string, string>>;
  attributes?: ReadonlyArray<Attribute<Message>>;
}>;

/** A page-sized layer. The host supplies its image, tools, overlays, and interaction. */
export const pageSurface = <Message>(
  config: PageSurfaceConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed("div")(
    config.key,
    [
      h.Class(config.className ?? "fk-pdf-page-surface"),
      h.DataAttribute("pdf-page-index", String(config.pageIndex)),
      ...(config.attributes ?? []),
      ...Object.entries(config.dataAttributes ?? {}).map(([name, value]) =>
        h.DataAttribute(name, value),
      ),
      h.Role("group"),
      h.AriaLabel(config.label),
      h.Style({
        position: "relative",
        width: `${config.displayWidth}px`,
        aspectRatio: `${config.width} / ${config.height}`,
        ...(config.displayHeight === undefined ? {} : { height: `${config.displayHeight}px` }),
      }),
    ],
    [...config.content],
  );
