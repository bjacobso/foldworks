// Character geometry inside a textarea, measured with an off-screen mirror.
// Textareas expose no caret rectangles, so wrapped lines are found by laying
// the same text out in a div with one span per character.

const COPIED_STYLES = [
  "boxSizing",
  "width",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "fontStretch",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "textIndent",
  "wordSpacing",
  "tabSize",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopStyle",
  "borderRightStyle",
  "borderBottomStyle",
  "borderLeftStyle",
  "overflowWrap",
  "wordBreak",
] as const;

/** Past this length, lines are found from newlines only. */
const MEASURE_LIMIT = 4000;

type Geometry = Readonly<{ tops: ReadonlyArray<number>; lefts: ReadonlyArray<number> }>;

/** Positions `0..value.length`, each the top-left of the caret before that character. */
const measure = (input: HTMLTextAreaElement): Geometry | undefined => {
  const value = input.value;
  if (value.length > MEASURE_LIMIT) return undefined;
  const doc = input.ownerDocument;
  const view = doc.defaultView;
  if (view === null) return undefined;
  const computed = view.getComputedStyle(input);
  const mirror = doc.createElement("div");
  for (const name of COPIED_STYLES) mirror.style[name] = computed[name];
  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-10000px",
    height: "auto",
    overflow: "hidden",
    whiteSpace: "pre-wrap",
  });
  const spans: Array<Readonly<{ span: HTMLSpanElement; from: number; to: number }>> = [];
  let index = 0;
  for (const character of value) {
    const span = doc.createElement("span");
    span.textContent = character;
    mirror.append(span);
    spans.push({ span, from: index, to: index + character.length });
    index += character.length;
  }
  const end = doc.createElement("span");
  end.textContent = "\u200b";
  mirror.append(end);
  doc.body.append(mirror);
  const tops: number[] = [];
  const lefts: number[] = [];
  for (const { span, from, to } of spans) {
    for (let position = from; position < to; position += 1) {
      tops[position] = span.offsetTop;
      lefts[position] = span.offsetLeft;
    }
  }
  tops[value.length] = end.offsetTop;
  lefts[value.length] = end.offsetLeft;
  mirror.remove();
  return { tops, lefts };
};

const contentLeft = (input: HTMLTextAreaElement): number =>
  input.getBoundingClientRect().left + input.clientLeft;

export type CaretLines = Readonly<{ onFirstLine: boolean; onLastLine: boolean; x: number }>;

/** Whether the selection touches the first or last visual line, and the caret's x in the viewport. */
export const caretLines = (input: HTMLTextAreaElement): CaretLines => {
  const { selectionStart: start, selectionEnd: end, value } = input;
  const geometry = measure(input);
  if (geometry === undefined) {
    return {
      onFirstLine: !value.slice(0, start).includes("\n"),
      onLastLine: !value.slice(end).includes("\n"),
      x: contentLeft(input),
    };
  }
  const { tops, lefts } = geometry;
  return {
    onFirstLine: tops[start] === tops[0],
    onLastLine: tops[end] === tops[value.length],
    x: contentLeft(input) + (lefts[start] ?? 0),
  };
};

/** The text offset on the first or last visual line closest to a viewport x. */
export const offsetAtX = (
  input: HTMLTextAreaElement,
  x: number,
  line: "First" | "Last",
): number => {
  const value = input.value;
  const geometry = measure(input);
  if (geometry === undefined) {
    return line === "First" ? 0 : value.length;
  }
  const { tops, lefts } = geometry;
  const top = line === "First" ? tops[0] : tops[value.length];
  const target = x - contentLeft(input);
  let best = line === "First" ? 0 : value.length;
  let distance = Infinity;
  for (let position = 0; position <= value.length; position += 1) {
    if (tops[position] !== top) continue;
    const candidate = Math.abs((lefts[position] ?? 0) - target);
    if (candidate < distance) {
      best = position;
      distance = candidate;
    }
  }
  return best;
};
