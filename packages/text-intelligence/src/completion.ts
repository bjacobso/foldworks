import { Schema as S } from "effect";

import { CompletionItem } from "./vocabulary";

/**
 * An open completion list. `from` and `to` are the text it replaces when an
 * item is accepted; `to` follows typing at the end of the range. `index`
 * points into the items that match what has been typed since `from`.
 */
export const List = S.Struct({
  from: S.Number,
  to: S.Number,
  items: S.Array(CompletionItem),
  index: S.Number,
});
export type List = typeof List.Type;

/** Opens a list over a range. */
export const open = (from: number, to: number, items: ReadonlyArray<CompletionItem>): List => ({
  from,
  to,
  items,
  index: 0,
});

/**
 * Items that match a query, case-insensitively: those that start with it
 * first, then those that contain it, each in the order offered. An empty query
 * matches everything.
 */
export const matching = (
  items: ReadonlyArray<CompletionItem>,
  query: string,
): ReadonlyArray<CompletionItem> => {
  const wanted = query.toLowerCase();
  if (wanted === "") return items;
  const key = (item: CompletionItem) => (item.filterText ?? item.label).toLowerCase();
  return [
    ...items.filter((item) => key(item).startsWith(wanted)),
    ...items.filter((item) => !key(item).startsWith(wanted) && key(item).includes(wanted)),
  ];
};

/** Whether a caret can still complete into the list's range. */
export const contains = (completion: List, caret: number): boolean =>
  caret >= completion.from && caret <= completion.to;

/** The text typed since the list opened: from `from` to the caret. */
export const query = (completion: List, text: string, caret: number): string =>
  text.slice(completion.from, Math.max(completion.from, caret));

/**
 * The items to show for a text and caret, or none when the caret has left the
 * range. Surfaces show the list only while this is non-empty.
 */
export const visible = (
  completion: List,
  text: string,
  caret: number,
): ReadonlyArray<CompletionItem> =>
  contains(completion, caret) && completion.to <= text.length
    ? matching(completion.items, query(completion, text, caret))
    : [];

/** The active item among the visible ones. */
export const active = (
  completion: List,
  text: string,
  caret: number,
): CompletionItem | undefined => {
  const items = visible(completion, text, caret);
  return items[Math.min(completion.index, items.length - 1)];
};

/** Moves the active item, wrapping at either end. */
export const move = (completion: List, delta: number, count: number): List =>
  count === 0
    ? completion
    : {
        ...completion,
        index: (((Math.min(completion.index, count - 1) + delta) % count) + count) % count,
      };

/** The first and last offsets that differ between two versions of a text. */
const change = (
  before: string,
  after: string,
): Readonly<{ start: number; delta: number }> | undefined => {
  if (before === after) return undefined;
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) {
    start += 1;
  }
  return { start, delta: after.length - before.length };
};

/**
 * Carries an open list through an edit. Typing inside the range or at its end
 * grows or shrinks `to`; an edit before `from`, or a caret that leaves the
 * range, closes the list. Narrowing the matches resets the active item.
 */
export const track = (
  completion: List,
  before: string,
  after: string,
  caret: number,
): List | undefined => {
  const edit = change(before, after);
  if (edit === undefined) return contains(completion, caret) ? completion : undefined;
  if (edit.start < completion.from || edit.start > completion.to) return undefined;
  const next: List = {
    ...completion,
    to: Math.max(completion.from, completion.to + edit.delta),
    index: 0,
  };
  return contains(next, caret) && next.to <= after.length ? next : undefined;
};

/** What accepting an item does to a text: the new text and the caret after the insertion. */
export const accept = (
  completion: List,
  text: string,
  item: CompletionItem,
): Readonly<{ text: string; caret: number; from: number; to: number; insert: string }> => {
  const insert = item.insert ?? item.label;
  const to = Math.min(completion.to, text.length);
  return {
    text: text.slice(0, completion.from) + insert + text.slice(to),
    caret: completion.from + insert.length,
    from: completion.from,
    to,
    insert,
  };
};

/**
 * The word that ends at an offset, for deciding what a completion replaces.
 * Words are letters, digits, `_`, `-`, and `$` unless `pattern`, which must be
 * anchored at the end, says otherwise.
 */
export const wordBefore = (
  text: string,
  offset: number,
  pattern: RegExp = /[\p{L}\p{N}_$-]+$/u,
): Readonly<{ from: number; word: string }> => {
  const match = pattern.exec(text.slice(0, offset));
  const word = match?.[0] ?? "";
  return { from: offset - word.length, word };
};
