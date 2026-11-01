import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { segments } from "./segments";
import type { TextRange } from "./vocabulary";

export type HighlightTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

/** UTF-16 offsets into the original text; keys must be unique within a view. */
export type HighlightRange<Message> = TextRange &
  Readonly<{
    key: string;
    tone?: HighlightTone;
    label?: string;
    onClick?: Message;
    tooltip?: string;
  }>;

export type HighlightedTextConfig<Message> = Readonly<{
  text: string;
  ranges?: ReadonlyArray<HighlightRange<Message>>;
  selectedKey?: string;
  label?: string;
}>;

const validRanges = <Message>(text: string, ranges: ReadonlyArray<HighlightRange<Message>>) =>
  ranges
    .filter(
      (range) =>
        Number.isFinite(range.from) &&
        Number.isFinite(range.to) &&
        range.to > range.from &&
        range.to > 0 &&
        range.from < text.length,
    )
    .map((range) => ({
      ...range,
      from: Math.max(0, Math.floor(range.from)),
      to: Math.min(text.length, Math.ceil(range.to)),
    }));

/** Narrowest covering range wins; ties use input order. */
export const innermostRange = <Message>(ranges: ReadonlyArray<HighlightRange<Message>>) =>
  ranges.reduce<HighlightRange<Message> | undefined>(
    (best, range) =>
      best === undefined || range.to - range.from < best.to - best.from ? range : best,
    undefined,
  );

/** Overlap-safe read-only text. Each actionable range has one keyboard stop. */
export const HighlightedText = {
  view: <Message>(config: HighlightedTextConfig<Message>, h: HtmlBuilder<Message>): Html => {
    const ranges = validRanges(config.text, config.ranges ?? []);
    const pieces = segments(config.text, { ranges });
    const first = new Map<string, number>();
    for (const piece of pieces) {
      const range = innermostRange(piece.covering.ranges);
      if (range !== undefined && !first.has(range.key)) first.set(range.key, piece.from);
    }
    const controls = ranges.filter((range) => range.onClick !== undefined && !first.has(range.key));
    return h.div(
      [
        h.Class("fw-highlighted-text"),
        ...(config.label === undefined ? [] : [h.AriaLabel(config.label)]),
      ],
      [
        ...pieces.flatMap((piece) => {
          const range = innermostRange(piece.covering.ranges);
          const hidden = controls
            .filter((control) => Math.max(0, control.from) === piece.from)
            .map((control) =>
              h.button(
                [
                  h.Type("button"),
                  h.Class("fw-highlighted-text__hidden-control"),
                  h.DataAttribute("highlight-key", control.key),
                  h.OnClick(control.onClick!),
                  h.AriaLabel(
                    control.label ?? config.text.slice(Math.max(0, control.from), control.to),
                  ),
                ],
                [control.label ?? control.key],
              ),
            );
          if (range === undefined) return [...hidden, h.span([], [piece.text])];
          const attrs = [
            h.Class("fw-highlighted-text__range"),
            h.DataAttribute("highlight-key", range.key),
            h.DataAttribute("tone", range.tone ?? "info"),
            h.DataAttribute("depth", String(piece.covering.ranges.length)),
            h.DataAttribute(
              "selected",
              piece.covering.ranges.some((item) => item.key === config.selectedKey)
                ? "true"
                : "false",
            ),
            ...(range.tooltip === undefined ? [] : [h.AriaDescription(range.tooltip)]),
          ];
          const painted =
            range.onClick === undefined
              ? h.mark(attrs, [piece.text])
              : h.span(
                  [
                    ...attrs,
                    h.Role("button"),
                    h.Tabindex(first.get(range.key) === piece.from ? 0 : -1),
                    h.AriaLabel(range.label ?? config.text.slice(range.from, range.to)),
                    h.AriaPressed(range.key === config.selectedKey ? "true" : "false"),
                    h.OnClick(range.onClick),
                    h.OnKeyDownPreventDefault((key) =>
                      key === "Enter" || key === " " ? Option.some(range.onClick!) : Option.none(),
                    ),
                  ],
                  [piece.text],
                );
          return [
            ...hidden,
            range.tooltip === undefined
              ? painted
              : h.span(
                  [h.Class("fw-highlighted-text__group")],
                  [
                    painted,
                    h.span(
                      [
                        h.Class("fw-highlighted-text__tooltip"),
                        h.Role("tooltip"),
                        h.DataAttribute("text-skip", "true"),
                      ],
                      [range.tooltip],
                    ),
                  ],
                ),
          ];
        }),
      ],
    );
  },
};

export type TextSnippet = Readonly<{
  from: number;
  to: number;
  text: string;
  leadingEllipsis: boolean;
  trailingEllipsis: boolean;
  /** Clipped ranges, still in original source coordinates (use `segments`' offset). */
  ranges: ReadonlyArray<TextRange>;
}>;

/** Keyword-in-context windows, merging touching neighbors. Context is in UTF-16 units. */
export const snippets = (
  text: string,
  ranges: ReadonlyArray<TextRange>,
  context = 40,
): ReadonlyArray<TextSnippet> => {
  const padding = Number.isFinite(context) ? Math.max(0, Math.floor(context)) : 40;
  const clipped = ranges
    .filter(
      (range) =>
        Number.isFinite(range.from) &&
        Number.isFinite(range.to) &&
        range.to > range.from &&
        range.from < text.length &&
        range.to > 0,
    )
    .map((range) => ({
      from: Math.max(0, Math.floor(range.from)),
      to: Math.min(text.length, Math.ceil(range.to)),
    }));
  const windows: Array<{ from: number; to: number }> = [];
  for (const range of [...clipped].sort((a, b) => a.from - b.from)) {
    const from = Math.max(0, range.from - padding);
    const to = Math.min(text.length, range.to + padding);
    const previous = windows.at(-1);
    if (previous !== undefined && from <= previous.to) previous.to = Math.max(previous.to, to);
    else windows.push({ from, to });
  }
  return windows.map(({ from, to }) => ({
    from,
    to,
    text: text.slice(from, to),
    leadingEllipsis: from > 0,
    trailingEllipsis: to < text.length,
    ranges: clipped.filter((range) => range.from < to && range.to > from),
  }));
};
