import { Schema as S } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import * as Completion from "./completion";
import type { CompletionItem, Diagnostic, SemanticToken, TextRange } from "./vocabulary";

export const Kind = S.Literals(["mention", "tag"]);
export type Kind = typeof Kind.Type;
/** Host identity is distinct from the spelling inserted into the text. */
export const Entity = S.Struct({
  id: S.String,
  kind: Kind,
  name: S.String,
  label: S.String,
  description: S.optional(S.String),
});
export type Entity = typeof Entity.Type;
export type Mark = Readonly<TextRange & { kind: Kind; name: string }>;
export type Options = Readonly<{
  /** Defaults to whitespace and opening/closing sentence punctuation. */
  boundary?: (before: string, from: number, text: string) => boolean;
  /** Ranges supplied by the surface's syntax tree (code, links, literal escapes). */
  excluded?: ReadonlyArray<TextRange>;
}>;
export type Data = Readonly<{
  entities: ReadonlyArray<Entity>;
  /** Optional document-derived tag spellings; host entities take precedence. */
  tags?: ReadonlyArray<string>;
  unknownMention?: (name: string) => string;
}>;
const key = (value: string) => value.normalize("NFC").toLowerCase();
const marker = (kind: Kind) => (kind === "mention" ? "@" : "#");
const namePattern = /^[\p{L}\p{N}_][\p{L}\p{M}\p{N}_-]*$/u;
const boundary = (before: string) => before === "" || /[\s([{,;:!?]/u.test(before);
const allowed = (text: string, from: number, to: number, options: Options) =>
  (options.boundary ?? boundary)(text.slice(0, from).at(-1) ?? "", from, text) &&
  !(options.excluded ?? []).some(
    (range) =>
      (range.from <= from && from < range.to) ||
      (range.from < to && to <= range.to) ||
      (from <= range.from && to >= range.to),
  );

/** UTF-16 ranges; decomposed accents and astral letters remain intact. */
const scan = (text: string, options: Options, empty: boolean): ReadonlyArray<Mark> => {
  const result: Mark[] = [];
  for (const match of text.matchAll(/[@#][\p{L}\p{M}\p{N}_-]*/gu)) {
    const from = match.index;
    const name = match[0].slice(1);
    const to = from + match[0].length;
    if (((empty && name === "") || namePattern.test(name)) && allowed(text, from, to, options))
      result.push({ from, to, kind: match[0][0] === "@" ? "mention" : "tag", name });
  }
  return result;
};
export const recognize = (text: string, options: Options = {}): ReadonlyArray<Mark> =>
  scan(text, options, false);
export type Query = Readonly<Mark & { caret: number; text: string }>;
/** The replacement covers the whole token, even when the caret is in its middle. */
export const queryAt = (text: string, caret: number, options: Options = {}): Query | undefined => {
  if (
    !Number.isInteger(caret) ||
    caret < 0 ||
    caret > text.length ||
    (/[\uD800-\uDBFF]/u.test(text[caret - 1] ?? "") && /[\uDC00-\uDFFF]/u.test(text[caret] ?? ""))
  )
    return undefined;
  const mark = scan(text, options, true).find((mark) => mark.from < caret && caret <= mark.to);
  return mark === undefined ? undefined : { ...mark, caret, text: text.slice(mark.from, caret) };
};
const entities = (data: Data): ReadonlyArray<Entity> => {
  const result = new Map<string, Entity>();
  for (const entity of data.entities) {
    if (namePattern.test(entity.name)) result.set(`${entity.kind}:${key(entity.name)}`, entity);
  }
  for (const name of data.tags ?? []) {
    const id = `tag:${key(name)}`;
    if (namePattern.test(name) && !result.has(id))
      result.set(id, {
        id,
        kind: "tag",
        name: key(name),
        label: `#${key(name)}`,
        description: "Tag",
      });
  }
  return [...result.values()];
};
export const resolve = (mark: Mark, data: Data): Entity | undefined =>
  entities(data).find((entity) => entity.kind === mark.kind && key(entity.name) === key(mark.name));
export const tagsIn = (
  texts: ReadonlyArray<string>,
  options: Options = {},
): ReadonlyArray<string> =>
  [
    ...new Set(
      texts.flatMap((text) =>
        recognize(text, options)
          .filter((mark) => mark.kind === "tag")
          .map((mark) => key(mark.name)),
      ),
    ),
  ].sort();
/** Ordinary completion items: the surface retains acceptance, keys, focus and undo. */
export const suggestions = (query: Query, text: string, data: Data): Completion.List => {
  // Existing whitespace or punctuation belongs to the document. Add a separator only at EOF.
  const suffix = query.to === text.length ? " " : "";
  const items: ReadonlyArray<CompletionItem> = entities(data)
    .filter((entity) => entity.kind === query.kind)
    .map((entity) => ({
      label: `${marker(entity.kind)}${entity.name}`,
      insert: `${marker(entity.kind)}${entity.name}${suffix}`,
      ...(entity.label === `${marker(entity.kind)}${entity.name}` ? {} : { detail: entity.label }),
      kind: entity.kind,
      filterText: `${marker(entity.kind)}${entity.name} ${entity.label} ${entity.label
        .split(/\s+/u)
        .map((word) => `${marker(entity.kind)}${word}`)
        .join(" ")}`,
    }));
  return Completion.open(query.from, query.to, items);
};
export const analyze = (
  text: string,
  data: Data,
  options: Options = {},
): Readonly<{ tokens: ReadonlyArray<SemanticToken>; diagnostics: ReadonlyArray<Diagnostic> }> => {
  const marks = recognize(text, options);
  return {
    tokens: marks.map(({ from, to, kind }) => ({ from, to, kind })),
    diagnostics:
      data.unknownMention === undefined
        ? []
        : marks
            .filter((mark) => mark.kind === "mention" && resolve(mark, data) === undefined)
            .map((mark) => ({
              from: mark.from,
              to: mark.to,
              severity: "warning",
              message: data.unknownMention!(mark.name),
            })),
  };
};
export type Description = Readonly<Mark & { entity: Entity; title: string; detail: string }>;
export const describe = (
  text: string,
  offset: number,
  data: Data,
  options: Options = {},
  lenient = false,
): Description | undefined => {
  const mark = recognize(text, options).find(
    (mark) => (mark.from <= offset && offset < mark.to) || (lenient && offset === mark.to),
  );
  if (!mark) return undefined;
  const entity = resolve(mark, data);
  if (!entity) return undefined;
  return {
    ...mark,
    entity,
    title: entity.label,
    detail: entity.description ?? (entity.kind === "tag" ? "Tag" : `@${entity.name}`),
  };
};
/** Optional shared content for the existing HoverPopup, with host-provided text. */
export const descriptionView = <Message>(description: Description, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("fw-reference-card")],
    [h.strong([], [description.title]), h.span([], [description.detail])],
  );

/**
 * Conservative exclusions for raw Markdown. AST-aware hosts should supply their
 * parser's ranges instead. No parsing dependency or document mutation is required.
 */
export const markdownOptions = (text: string): Options => {
  const excluded: TextRange[] = [];
  let fence: { marker: string; length: number; from: number } | undefined;
  let at = 0;
  for (const line of text.split(/(?<=\n)/u)) {
    const match = /^ {0,3}(`{3,}|~{3,})/u.exec(line);
    if (fence) {
      if (
        match &&
        match[1]![0] === fence.marker &&
        match[1]!.length >= fence.length &&
        /^\s*$/u.test(line.slice(match[0].length))
      ) {
        excluded.push({ from: fence.from, to: at + line.length });
        fence = undefined;
      }
    } else if (match) fence = { marker: match[1]![0]!, length: match[1]!.length, from: at };
    else if (/^ {0,3}#{1,6}(?:\s|$)/u.test(line) || /^(?: {4}|\t)/u.test(line))
      excluded.push({ from: at, to: at + line.length });
    at += line.length;
  }
  if (fence) excluded.push({ from: fence.from, to: text.length });
  for (const match of text.matchAll(/`+/gu)) {
    if (excluded.some((range) => range.from <= match.index && match.index < range.to)) continue;
    const delimiter = match[0];
    const after = match.index + delimiter.length;
    let end = text.indexOf(delimiter, after);
    while (end >= 0 && (text[end - 1] === "`" || text[end + delimiter.length] === "`"))
      end = text.indexOf(delimiter, end + delimiter.length);
    if (end >= 0) excluded.push({ from: match.index, to: end + delimiter.length });
  }
  for (const match of text.matchAll(
    /(?:https?:\/\/|mailto:|www\.)[^\s<>]+|[\p{L}\p{N}_.+-]+@[\p{L}\p{N}.-]+|<[^>\n]*>|\]\([^\n)]*\)/giu,
  ))
    excluded.push({ from: match.index, to: match.index + match[0].length });
  return {
    excluded,
    boundary: (before, from, source) => {
      let escapes = 0;
      for (let index = from - 1; source[index] === "\\"; index--) escapes++;
      return escapes % 2 === 0 && boundary(before);
    },
  };
};
