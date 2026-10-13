import type { Html, HtmlBuilder } from "foldkit/html";

export type TextDiffPart = Readonly<{
  kind: "equal" | "addition" | "removal";
  text: string;
  /** UTF-16 offsets at the start of this part in each source. */
  oldFrom: number;
  newFrom: number;
}>;

export type DiffTextOptions = Readonly<{
  granularity?: "word" | "sentence";
  locale?: string;
  /** Bounds Myers' search memory/work. Larger changes fall back to a replacement. */
  maxSearchCells?: number;
}>;

type Edit = Readonly<{ kind: TextDiffPart["kind"]; text: string }>;
const tokenize = (text: string, options: DiffTextOptions): string[] =>
  options.granularity === "sentence"
    ? [
        ...new Intl.Segmenter(options.locale ?? "en", { granularity: "sentence" }).segment(text),
      ].map((part) => part.segment)
    : (text.match(/[\p{L}\p{N}\p{M}_]+|\s+|[^\p{L}\p{N}\p{M}_\s]/gu) ?? []);

const myers = (old: readonly string[], next: readonly string[], maxCells: number): Edit[] => {
  const trace: Map<number, number>[] = [];
  let frontier = new Map<number, number>([[1, 0]]);
  let cells = 0;
  for (let distance = 0; distance <= old.length + next.length; distance++) {
    cells += 2 * distance + 1;
    if (cells > maxCells) break;
    trace.push(new Map(frontier));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      let x =
        diagonal === -distance ||
        (diagonal !== distance &&
          (frontier.get(diagonal - 1) ?? -Infinity) < (frontier.get(diagonal + 1) ?? -Infinity))
          ? (frontier.get(diagonal + 1) ?? 0)
          : (frontier.get(diagonal - 1) ?? 0) + 1;
      let y = x - diagonal;
      while (x < old.length && y < next.length && old[x] === next[y]) {
        x++;
        y++;
      }
      frontier.set(diagonal, x);
      if (x < old.length || y < next.length) continue;
      const edits: Edit[] = [];
      x = old.length;
      y = next.length;
      for (let depth = distance; depth >= 0; depth--) {
        const previous = trace[depth]!;
        const k = x - y;
        const previousK =
          k === -depth ||
          (k !== depth && (previous.get(k - 1) ?? -Infinity) < (previous.get(k + 1) ?? -Infinity))
            ? k + 1
            : k - 1;
        const previousX = previous.get(previousK) ?? 0;
        const previousY = previousX - previousK;
        while (x > previousX && y > previousY) {
          edits.push({ kind: "equal", text: old[--x]! });
          y--;
        }
        if (depth === 0) break;
        if (x === previousX) edits.push({ kind: "addition", text: next[--y]! });
        else edits.push({ kind: "removal", text: old[--x]! });
      }
      return edits.reverse();
    }
  }
  return [
    ...old.map((text): Edit => ({ kind: "removal", text })),
    ...next.map((text): Edit => ({ kind: "addition", text })),
  ];
};

/** Exact, whitespace-preserving prose diff. No inference of moved sentences. */
export const diffText = (
  oldText: string,
  newText: string,
  options: DiffTextOptions = {},
): readonly TextDiffPart[] => {
  const old = tokenize(oldText, options);
  const next = tokenize(newText, options);
  let start = 0;
  while (start < Math.min(old.length, next.length) && old[start] === next[start]) start++;
  let end = 0;
  while (
    end < Math.min(old.length, next.length) - start &&
    old[old.length - 1 - end] === next[next.length - 1 - end]
  )
    end++;
  const budget =
    options.maxSearchCells !== undefined && Number.isFinite(options.maxSearchCells)
      ? Math.max(0, Math.floor(options.maxSearchCells))
      : 1_000_000;
  const edits: Edit[] = [
    ...old.slice(0, start).map((text): Edit => ({ kind: "equal", text })),
    ...myers(old.slice(start, old.length - end), next.slice(start, next.length - end), budget),
    ...old.slice(old.length - end).map((text): Edit => ({ kind: "equal", text })),
  ];
  const parts: Array<{
    kind: TextDiffPart["kind"];
    text: string;
    oldFrom: number;
    newFrom: number;
  }> = [];
  let oldFrom = 0;
  let newFrom = 0;
  for (const edit of edits) {
    const previous = parts.at(-1);
    if (previous?.kind === edit.kind) previous.text += edit.text;
    else parts.push({ ...edit, oldFrom, newFrom });
    if (edit.kind !== "addition") oldFrom += edit.text.length;
    if (edit.kind !== "removal") newFrom += edit.text.length;
  }
  return parts;
};

export type ProseDiffConfig = Readonly<{
  oldText: string;
  newText: string;
  mode?: "inline" | "split";
  options?: DiffTextOptions;
  label?: string;
  oldLabel?: string;
  newLabel?: string;
}>;

export const ProseDiff = {
  view: <Message>(config: ProseDiffConfig, h: HtmlBuilder<Message>): Html => {
    const parts = diffText(config.oldText, config.newText, config.options);
    const content = (side?: "old" | "new") =>
      parts
        .filter((part) =>
          side === "old"
            ? part.kind !== "addition"
            : side === "new"
              ? part.kind !== "removal"
              : true,
        )
        .map((part) => {
          const attrs = [h.Class("fk-prose-diff__part"), h.DataAttribute("kind", part.kind)];
          return part.kind === "addition"
            ? h.ins(attrs, [part.text])
            : part.kind === "removal"
              ? h.del(attrs, [part.text])
              : h.span(attrs, [part.text]);
        });
    return h.section(
      [
        h.Class("fk-prose-diff"),
        h.DataAttribute("mode", config.mode ?? "inline"),
        h.AriaLabel(config.label ?? "Text comparison"),
      ],
      config.mode === "split"
        ? [
            h.div(
              [h.Class("fk-prose-diff__column")],
              [
                h.h3([], [config.oldLabel ?? "Original"]),
                h.div([h.Class("fk-prose-diff__text")], content("old")),
              ],
            ),
            h.div(
              [h.Class("fk-prose-diff__column")],
              [
                h.h3([], [config.newLabel ?? "Revised"]),
                h.div([h.Class("fk-prose-diff__text")], content("new")),
              ],
            ),
          ]
        : [h.div([h.Class("fk-prose-diff__text")], content())],
    );
  },
};
