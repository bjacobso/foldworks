import { Effect, Schema as S } from "effect";
import type { PDFPageProxy } from "pdfjs-dist";
type TextContent = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;

import { PdfRect } from "./rect";
import { getPage, PdfRenderError, withPdfDocument } from "./render";

/** One PDF.js text item (or an OCR word box), in PDF user space. */
export const PdfTextItem = S.Struct({ text: S.String, rect: PdfRect, hasEOL: S.Boolean });
export type PdfTextItem = typeof PdfTextItem.Type;
export const PdfPageText = S.Struct({ pageIndex: S.Number, items: S.Array(PdfTextItem) });
export type PdfPageText = typeof PdfPageText.Type;
export const PdfTextRegion = S.Struct({ pageIndex: S.Number, rects: S.Array(PdfRect) });
export type PdfTextRegion = typeof PdfTextRegion.Type;
export const PdfTextSelection = S.Struct({ text: S.String, regions: S.Array(PdfTextRegion) });
export type PdfTextSelection = typeof PdfTextSelection.Type;

/** Pure conversion of PDF.js text positions to item bounds; respects rotated baselines. */
export const pdfTextItems = (
  content: Pick<TextContent, "items" | "styles">,
): readonly PdfTextItem[] =>
  content.items.flatMap((item) => {
    if (!("str" in item) || (item.str.length === 0 && !item.hasEOL)) return [];
    const [a, b, c, d, x, y] = item.transform as number[];
    if ([a, b, c, d, x, y, item.width, item.height].some((value) => !Number.isFinite(value)))
      return [];
    const height = Math.hypot(c!, d!) || item.height;
    const advance = Math.hypot(a!, b!);
    if (height === 0 || advance === 0) return [];
    const style = content.styles[item.fontName];
    const ascent = style?.ascent ?? (style?.descent === undefined ? 0.8 : 1 + style.descent);
    const ux = a! / advance;
    const uy = b! / advance;
    const vx = c! / height;
    const vy = d! / height;
    const width = item.width;
    const bottom = (ascent - 1) * height;
    const top = ascent * height;
    const corners = [
      { x: x! + vx * bottom, y: y! + vy * bottom },
      { x: x! + vx * top, y: y! + vy * top },
      { x: x! + ux * width + vx * bottom, y: y! + uy * width + vy * bottom },
      { x: x! + ux * width + vx * top, y: y! + uy * width + vy * top },
    ];
    const left = Math.min(...corners.map((point) => point.x));
    const low = Math.min(...corners.map((point) => point.y));
    return [
      {
        text: item.str,
        hasEOL: item.hasEOL,
        rect: {
          x: left,
          y: low,
          width: Math.max(...corners.map((point) => point.x)) - left,
          height: Math.max(...corners.map((point) => point.y)) - low,
        },
      },
    ];
  });

export const readPageText = (
  page: PDFPageProxy,
  pageIndex: number,
): Effect.Effect<PdfPageText, PdfRenderError> =>
  Effect.tryPromise({
    try: () => page.getTextContent(),
    catch: (cause) => new PdfRenderError({ reason: "The page's text could not be read.", cause }),
  }).pipe(Effect.map((content) => ({ pageIndex, items: pdfTextItems(content) })));

/** Extract positioned text from a PDF. Scanned pages yield empty item arrays; OCR belongs to the host. */
export const readPdfText = (
  bytes: Uint8Array,
): Effect.Effect<readonly PdfPageText[], PdfRenderError> =>
  withPdfDocument(bytes, (document) =>
    Effect.forEach(
      Array.from({ length: document.numPages }, (_, index) => index),
      (pageIndex) =>
        getPage(document, pageIndex).pipe(Effect.flatMap((page) => readPageText(page, pageIndex))),
    ),
  );

type Source = Readonly<{ pageIndex: number; itemIndex: number }>;
type Normalized = Readonly<{ text: string; sources: readonly (Source | undefined)[] }>;
const normalize = (raw: string, sources: readonly (Source | undefined)[]): Normalized => {
  let text = "";
  const mapped: Array<Source | undefined> = [];
  for (let index = 0; index < raw.length; ) {
    // Only join a hyphen at an explicit line/page break, never ordinary word hyphens.
    const hyphen =
      raw[index] === "-" || raw[index] === "\u00ad"
        ? /^[\-\u00ad][ \t]*\r?\n[\s]*/.exec(raw.slice(index))
        : null;
    if (
      hyphen !== null &&
      /\p{L}/u.test(text.at(-1) ?? "") &&
      /\p{L}/u.test(raw[index + hyphen[0].length] ?? "")
    ) {
      index += hyphen[0].length;
      continue;
    }
    const char = String.fromCodePoint(raw.codePointAt(index)!);
    const normalized = char.normalize("NFKC");
    for (const value of normalized) {
      if (/\s/u.test(value)) {
        if (text.length > 0 && !text.endsWith(" ")) {
          text += " ";
          mapped.push(sources[index]);
        }
      } else {
        text += value;
        for (let unit = 0; unit < value.length; unit++) mapped.push(sources[index]);
      }
    }
    index += char.length;
  }
  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    mapped.pop();
  }
  return { text, sources: mapped };
};

export type QuoteLocation =
  | Readonly<{ _tag: "Found"; regions: readonly PdfTextRegion[] }>
  | Readonly<{ _tag: "NotFound" }>
  | Readonly<{ _tag: "EmptyQuote" }>
  | Readonly<{ _tag: "Ambiguous"; occurrences: number }>;

/**
 * Locate an exact normalized quote, including passages crossing pages.
 * Returns whole item boxes, never invented glyph positions. Repeated quotes
 * require an explicit zero-based occurrence; otherwise they are ambiguous.
 */
export const locateQuote = (
  pages: readonly PdfPageText[],
  quote: string,
  options: Readonly<{ occurrence?: number }> = {},
): QuoteLocation => {
  const needle = normalize(quote, []).text;
  if (needle.includes("\0")) return { _tag: "NotFound" };
  if (needle.length === 0) return { _tag: "EmptyQuote" };
  let raw = "";
  const sources: Array<Source | undefined> = [];
  const ordered = [...pages].sort((a, b) => a.pageIndex - b.pageIndex);
  const add = (value: string, source?: Source) => {
    raw += value;
    for (let index = 0; index < value.length; index++) sources.push(source);
  };
  let previousPage: number | undefined;
  for (const page of ordered) {
    if (previousPage !== undefined && page.pageIndex !== previousPage + 1) add("\0");
    if (!page.items.some((item) => item.text.trim().length > 0)) add("\0");
    if (raw.length > 0) add("\n");
    previousPage = page.pageIndex;
    page.items.forEach((item, itemIndex) => {
      add(item.text, { pageIndex: page.pageIndex, itemIndex });
      // PDF.js includes spaces in items; insert a separator only at explicit EOLs.
      if (item.hasEOL) add("\n");
    });
  }
  const haystack = normalize(raw, sources);
  const matches: number[] = [];
  for (let at = haystack.text.indexOf(needle); at >= 0; at = haystack.text.indexOf(needle, at + 1))
    matches.push(at);
  if (matches.length === 0) return { _tag: "NotFound" };
  if (options.occurrence === undefined && matches.length > 1)
    return { _tag: "Ambiguous", occurrences: matches.length };
  const occurrence = options.occurrence ?? 0;
  if (!Number.isInteger(occurrence) || occurrence < 0 || matches[occurrence] === undefined)
    return { _tag: "NotFound" };
  const at = matches[occurrence]!;
  const matched = haystack.sources.slice(at, at + needle.length);
  const regions = ordered.flatMap((page) => {
    const indexes = new Set(
      matched
        .filter((source) => source?.pageIndex === page.pageIndex)
        .map((source) => source!.itemIndex),
    );
    const rects = page.items
      .filter((_, index) => indexes.has(index))
      .map((item) => item.rect)
      .filter((rect) => rect.width > 0 && rect.height > 0);
    return rects.length === 0 ? [] : [{ pageIndex: page.pageIndex, rects }];
  });
  return { _tag: "Found", regions };
};
