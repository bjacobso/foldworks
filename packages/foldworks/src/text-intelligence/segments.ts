import type { TextRange } from "./vocabulary";

/** A piece of text and, for each layer, the ranges that cover all of it. */
export type Segment<Layers extends Readonly<Record<string, ReadonlyArray<TextRange>>>> = Readonly<{
  from: number;
  to: number;
  text: string;
  covering: { readonly [Name in keyof Layers]: ReadonlyArray<Layers[Name][number]> };
}>;

/**
 * Splits a text wherever a range in any layer starts or ends, so each piece
 * can be painted once with everything that applies to it, such as a token
 * kind, a diagnostic underline, and a highlight. Ranges are clipped to the
 * text; empty ranges split the text but cover nothing. `offset` shifts the
 * ranges, for painting one line of a larger document.
 */
export const segments = <Layers extends Readonly<Record<string, ReadonlyArray<TextRange>>>>(
  text: string,
  layers: Layers,
  offset = 0,
): ReadonlyArray<Segment<Layers>> => {
  const end = text.length;
  const clip = (value: number) => Math.max(0, Math.min(end, value - offset));
  const names = Object.keys(layers) as Array<keyof Layers>;
  const relevant = names.map(
    (name) =>
      [
        name,
        layers[name]!.filter((range) => range.to - offset >= 0 && range.from - offset <= end),
      ] as const,
  );
  const cuts = new Set<number>([0, end]);
  for (const [, ranges] of relevant) {
    for (const range of ranges) {
      cuts.add(clip(range.from));
      cuts.add(clip(range.to));
    }
  }
  const positions = [...cuts].sort((a, b) => a - b);
  const result: Array<Segment<Layers>> = [];
  for (let index = 0; index < positions.length - 1; index += 1) {
    const from = positions[index]!;
    const to = positions[index + 1]!;
    const covering = Object.fromEntries(
      relevant.map(([name, ranges]) => [
        name,
        ranges.filter((range) => clip(range.from) <= from && clip(range.to) >= to),
      ]),
    ) as unknown as Segment<Layers>["covering"];
    result.push({ from, to, text: text.slice(from, to), covering });
  }
  return result;
};
