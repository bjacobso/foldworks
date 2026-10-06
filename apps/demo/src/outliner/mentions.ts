// Surface adapter: walking Items and counting rows belongs to the outline host.
import { walk, type Items, type RowDecoration } from "@foldworks/outliner";
import { Mentions, segments } from "@foldworks/text-intelligence";
import { crewData } from "../references/crew";

export const marksOf = Mentions.recognize;
const dataFor = (items: Items) => crewData(Mentions.tagsIn(walk(items).map((node) => node.text)));
const cache = new WeakMap<Items, Readonly<Record<string, RowDecoration>>>();
export const decorations = (items: Items): Readonly<Record<string, RowDecoration>> => {
  const cached = cache.get(items);
  if (cached !== undefined) return cached;
  const data = dataFor(items);
  const result: Record<string, RowDecoration> = {};
  for (const node of walk(items)) {
    const { tokens, diagnostics } = Mentions.analyze(node.text, data);
    if (tokens.length)
      result[node.id] = {
        spans: segments(node.text, { tokens }).map((part) => ({
          text: part.text,
          ...(part.covering.tokens[0] ? { kind: part.covering.tokens[0].kind } : {}),
        })),
        diagnostics,
      };
  }
  cache.set(items, result);
  return result;
};
export type MarkInfo = Mentions.Description & Readonly<{ count: number }>;
export const describeMark = (
  items: Items,
  text: string,
  offset: number,
  lenient = false,
): MarkInfo | undefined => {
  const description = Mentions.describe(text, offset, dataFor(items), {}, lenient);
  if (!description) return undefined;
  const count = walk(items).filter((node) =>
    marksOf(node.text).some(
      (mark) =>
        mark.kind === description.kind &&
        mark.name.normalize("NFC").toLowerCase() ===
          description.name.normalize("NFC").toLowerCase(),
    ),
  ).length;
  return { ...description, count };
};
export const suggestionsAt = (items: Items, text: string, caret: number) => {
  const query = Mentions.queryAt(text, caret);
  return query === undefined ? undefined : Mentions.suggestions(query, text, dataFor(items));
};
