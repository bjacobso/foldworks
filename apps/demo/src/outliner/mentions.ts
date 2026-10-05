// Mentions and tags: a non-language use of the outliner's text intelligence.
// `@maya` names a person on the crew and `#print` tags an item. The outline
// paints them, explains them on hover, suggests them as they are typed, and
// flags a mention of someone who is not on the crew.

import { walk, type Items, type RowDecoration, type TextSpan } from "@foldworks/outliner";
import { Completion, type CompletionItem, type Diagnostic } from "@foldworks/text-intelligence";

export type Person = Readonly<{ handle: string; name: string; role: string }>;

export const PEOPLE: ReadonlyArray<Person> = [
  { handle: "maya", name: "Maya Chen", role: "Trail lead" },
  { handle: "jonah", name: "Jonah Park", role: "Design and print" },
  { handle: "ada", name: "Ada Ruiz", role: "Birding guide" },
  { handle: "sam", name: "Sam Okafor", role: "Volunteer coordinator" },
];

export type Mark = Readonly<{ from: number; to: number; kind: "mention" | "tag"; name: string }>;

const MARK = /(^|[\s(])([@#])([\p{L}\p{N}_-]+)/gu;

/** The mentions and tags in a text. */
export const marksOf = (text: string): ReadonlyArray<Mark> =>
  [...text.matchAll(MARK)].map((match) => {
    const from = match.index + match[1]!.length;
    return {
      from,
      to: from + 1 + match[3]!.length,
      kind: match[2] === "@" ? "mention" : "tag",
      name: match[3]!,
    };
  });

const personFor = (handle: string): Person | undefined =>
  PEOPLE.find((person) => person.handle === handle.toLowerCase());

const decorate = (text: string): RowDecoration | undefined => {
  const marks = marksOf(text);
  if (marks.length === 0) return undefined;
  const spans: TextSpan[] = [];
  const diagnostics: Diagnostic[] = [];
  let at = 0;
  for (const mark of marks) {
    if (mark.from > at) spans.push({ text: text.slice(at, mark.from) });
    spans.push({ text: text.slice(mark.from, mark.to), kind: mark.kind });
    if (mark.kind === "mention" && personFor(mark.name) === undefined) {
      diagnostics.push({
        from: mark.from,
        to: mark.to,
        severity: "warning",
        message: `No one on the crew is called @${mark.name}.`,
      });
    }
    at = mark.to;
  }
  if (at < text.length) spans.push({ text: text.slice(at) });
  return { spans, ...(diagnostics.length === 0 ? {} : { diagnostics }) };
};

const cache = new WeakMap<Items, Readonly<Record<string, RowDecoration>>>();

/** Paints every mention and tag, cached per document. */
export const decorations = (items: Items): Readonly<Record<string, RowDecoration>> => {
  const cached = cache.get(items);
  if (cached !== undefined) return cached;
  const result: Record<string, RowDecoration> = {};
  for (const node of walk(items)) {
    const decoration = decorate(node.text);
    if (decoration !== undefined) result[node.id] = decoration;
  }
  cache.set(items, result);
  return result;
};

/** How many items carry a mention or tag. */
const uses = (items: Items, kind: Mark["kind"], name: string): number =>
  walk(items).filter((node) =>
    marksOf(node.text).some(
      (mark) => mark.kind === kind && mark.name.toLowerCase() === name.toLowerCase(),
    ),
  ).length;

export type MarkInfo = Readonly<{
  from: number;
  to: number;
  title: string;
  detail: string;
  count: number;
}>;

/** What a mention or tag under an offset refers to. A mention of a stranger has no card. */
export const describeMark = (
  items: Items,
  text: string,
  offset: number,
  lenient = false,
): MarkInfo | undefined => {
  const mark = marksOf(text).find(
    (candidate) =>
      (candidate.from <= offset && offset < candidate.to) || (lenient && candidate.to === offset),
  );
  if (mark === undefined) return undefined;
  if (mark.kind === "tag") {
    return { ...mark, title: `#${mark.name}`, detail: "Tag", count: uses(items, "tag", mark.name) };
  }
  const person = personFor(mark.name);
  return person === undefined
    ? undefined
    : {
        ...mark,
        title: person.name,
        detail: person.role,
        count: uses(items, "mention", mark.name),
      };
};

/** Suggestions for a mention or tag being typed at the caret. */
export const suggestionsAt = (
  items: Items,
  text: string,
  caret: number,
): Readonly<{ from: number; to: number; items: ReadonlyArray<CompletionItem> }> | undefined => {
  const { from, word } = Completion.wordBefore(text, caret, /[@#][\p{L}\p{N}_-]*$/u);
  if (word === "" || (from > 0 && !/[\s(]/u.test(text[from - 1]!))) return undefined;
  const to = caret + (/^[\p{L}\p{N}_-]*/u.exec(text.slice(caret))?.[0].length ?? 0);
  const suggestions: ReadonlyArray<CompletionItem> = word.startsWith("@")
    ? PEOPLE.map((person) => ({
        label: `@${person.handle}`,
        insert: `@${person.handle} `,
        detail: person.name,
        kind: "person",
        filterText: `@${person.handle} ${person.name}`,
      }))
    : [
        ...new Set(
          walk(items).flatMap((node) =>
            marksOf(node.text)
              .filter((mark) => mark.kind === "tag")
              .map((mark) => mark.name.toLowerCase()),
          ),
        ),
      ]
        .sort()
        .map((tag) => ({ label: `#${tag}`, insert: `#${tag} `, kind: "tag" }));
  return { from, to, items: suggestions };
};
