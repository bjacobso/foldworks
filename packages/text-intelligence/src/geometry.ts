// Text geometry over a painted element. Surfaces paint their text in a mirror
// beneath a transparent textarea, and textareas expose no geometry, so these
// helpers measure the mirror with DOM ranges. Elements marked
// `data-text-skip` are painted but are not part of the text, such as a
// suffix or a trailing zero-width space.

type Piece = Readonly<{ node: Text; start: number }>;

const SKIP = "[data-text-skip]";

/** The text nodes under a root that spell its text, with the offset each starts at. */
const pieces = (root: Element): ReadonlyArray<Piece> => {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const result: Piece[] = [];
  let start = 0;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const skipped = node.parentElement?.closest(SKIP);
    if (skipped !== null && skipped !== undefined && root.contains(skipped)) continue;
    const text = node as Text;
    result.push({ node: text, start });
    start += text.data.length;
  }
  return result;
};

const contains = (rect: DOMRect, x: number, y: number): boolean =>
  x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;

/**
 * The offset of the character under a viewport point, or `undefined` when the
 * point is not over text, such as past the end of a line.
 */
export const offsetAtPoint = (root: Element, x: number, y: number): number | undefined => {
  const doc = root.ownerDocument;
  const range = doc.createRange();
  for (const { node, start } of pieces(root)) {
    const length = node.data.length;
    if (length === 0) continue;
    range.selectNodeContents(node);
    const bounds = [...range.getClientRects()];
    if (!bounds.some((rect) => contains(rect, x, y))) continue;
    for (let index = 0; index < length; index += 1) {
      const code = node.data.charCodeAt(index);
      // Measure surrogate pairs as one character.
      const size = code >= 0xd800 && code <= 0xdbff && index + 1 < length ? 2 : 1;
      range.setStart(node, index);
      range.setEnd(node, index + size);
      if ([...range.getClientRects()].some((rect) => contains(rect, x, y))) {
        return start + index;
      }
      index += size - 1;
    }
  }
  return undefined;
};

/**
 * Where the caret would sit before an offset, as a zero-width rectangle in
 * viewport coordinates. An offset at the end of the text measures after its
 * last character.
 */
export const rectAtOffset = (root: Element, offset: number): DOMRect | undefined => {
  const doc = root.ownerDocument;
  const all = pieces(root);
  const range = doc.createRange();
  // At a boundary between pieces, measure the start of the next one: a word
  // that begins a wrapped line sits there, not at the end of the line above.
  const inside = all.find(
    ({ node, start }) => offset >= start && offset < start + node.data.length,
  );
  for (const { node, start } of inside === undefined ? all : [inside]) {
    const length = node.data.length;
    if (offset < start || offset > start + length) continue;
    const local = offset - start;
    if (local < length) {
      range.setStart(node, local);
      range.setEnd(node, local + 1);
      const rect = range.getClientRects()[0];
      if (rect !== undefined) return new DOMRect(rect.left, rect.top, 0, rect.height);
    } else if (length > 0) {
      range.setStart(node, length - 1);
      range.setEnd(node, length);
      const rects = range.getClientRects();
      const rect = rects[rects.length - 1];
      if (rect !== undefined) return new DOMRect(rect.right, rect.top, 0, rect.height);
    }
  }
  // An empty text: measure the root's first line box.
  const box = root.getBoundingClientRect();
  return all.length === 0 ? new DOMRect(box.left, box.top, 0, box.height) : undefined;
};

/** The viewport rectangles a range of text covers, one per line box. */
export const rangeRects = (root: Element, from: number, to: number): ReadonlyArray<DOMRect> => {
  const doc = root.ownerDocument;
  const range = doc.createRange();
  const result: DOMRect[] = [];
  for (const { node, start } of pieces(root)) {
    const length = node.data.length;
    const localFrom = Math.max(0, from - start);
    const localTo = Math.min(length, to - start);
    if (localFrom >= localTo) continue;
    range.setStart(node, localFrom);
    range.setEnd(node, localTo);
    result.push(...range.getClientRects());
  }
  return result;
};

/** Whether a viewport point falls on any of a list of rectangles. */
export const isOver = (rects: ReadonlyArray<DOMRect>, x: number, y: number): boolean =>
  rects.some((rect) => contains(rect, x, y));
