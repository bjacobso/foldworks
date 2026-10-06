// A language service for environment files. The deploy host knows which
// settings it reads and which values the platform provides; this module turns
// that knowledge into @foldworks/text-intelligence values. The page's update
// sends tokens, diagnostics, and completions to the editor, and its view
// renders hover descriptions and highlights, all from one analysis.

import {
  Completion,
  type CompletionItem,
  type Diagnostic,
  type SemanticToken,
  type TextRange,
} from "@foldworks/text-intelligence";

export const environmentLanguage = "env";

type Setting = Readonly<{
  summary: string;
  /** What a value must be, as a phrase: "true or false". */
  expects: string;
  values?: ReadonlyArray<string>;
  accepts?: (value: string) => boolean;
}>;

const flag = (summary: string): Setting => ({
  summary,
  expects: "true or false",
  values: ["true", "false"],
});

/** The settings the deploy host reads. */
export const settings: Readonly<Record<string, Setting>> = {
  APP_NAME: { summary: "Name shown in page titles and logs.", expects: "text" },
  APP_ENV: {
    summary: "Chooses the logging and caching defaults.",
    expects: "development or production",
    values: ["development", "production"],
  },
  API_HOST: { summary: "Host name of the API, without a scheme.", expects: "a host name" },
  API_URL: {
    summary: "Base URL for API requests.",
    expects: "an http or https URL",
    accepts: (value) => /^https?:\/\/\S+$/.test(value),
  },
  RETRY_ATTEMPTS: {
    summary: "How many times a failed request is retried.",
    expects: "a whole number from 0 to 10",
    accepts: (value) => /^\d+$/.test(value) && Number(value) <= 10,
  },
  LOG_LEVEL: {
    summary: "The least severe message written to the log.",
    expects: "debug, info, warn, or error",
    values: ["debug", "info", "warn", "error"],
  },
  CACHE_URL: {
    summary: "Redis connection URL. Leave it unset to turn caching off.",
    expects: "a redis URL",
    accepts: (value) => /^rediss?:\/\/\S+$/.test(value),
  },
  FEATURE_SEARCH: flag("Shows the search field in the toolbar."),
  FEATURE_EXPORT: flag("Lets people download documents as files."),
};

/** Values the platform provides to every deploy, for `${NAME}` references. */
export const platform: Readonly<Record<string, Readonly<{ value: string; summary: string }>>> = {
  REGION: { value: "eu-west-1", summary: "The region this deploy runs in." },
  RELEASE: { value: "2026.10.1", summary: "The release being deployed." },
  PORT: { value: "8080", summary: "The port the app listens on." },
};

export const environmentSample = `# Settings the deploy host reads at start-up.
# \${NAME} uses another setting here, or a value the platform provides.
APP_NAME=Foldworks \${RELEASE}
APP_ENV=production
API_HOST=api.foldworks.dev
API_URL=https://\${API_HOST}/v2
RETRY_ATTEMPTS=3
LOG_LEVL=info
CACHE_URL=redis://\${CACHE_HOST}:6379
FEATURE_SEARCH=true
`;

const settingFor = (name: string): Setting | undefined =>
  Object.hasOwn(settings, name) ? settings[name] : undefined;
export const isSetting = (name: string): boolean => settingFor(name) !== undefined;
const platformFor = (name: string) => (Object.hasOwn(platform, name) ? platform[name] : undefined);

/** A `${NAME}` in a value. `closed` is false while the brace is still to be typed. */
export type Reference = TextRange & Readonly<{ name: string; closed: boolean }>;

/** One `NAME=value` line. */
export type Entry = Readonly<{
  line: number;
  name: string;
  key: TextRange;
  equals: number;
  value: TextRange & Readonly<{ text: string }>;
  references: ReadonlyArray<Reference>;
}>;

export type Analysis = Readonly<{
  text: string;
  entries: ReadonlyArray<Entry>;
  comments: ReadonlyArray<TextRange>;
  /** Lines that are neither comments nor settings. */
  malformed: ReadonlyArray<TextRange>;
}>;

const REFERENCE = /\$\{([A-Za-z0-9_]*)(\}?)/g;

export const analyze = (text: string): Analysis => {
  const entries: Entry[] = [];
  const comments: TextRange[] = [];
  const malformed: TextRange[] = [];
  let start = 0;
  text.split("\n").forEach((line, index) => {
    const from = start + line.length - line.trimStart().length;
    const to = start + line.trimEnd().length;
    const equals = line.indexOf("=");
    if (line.trimStart().startsWith("#")) comments.push({ from, to });
    else if (line.trim() === "") {
      // A blank line.
    } else if (equals < 0) malformed.push({ from, to });
    else {
      const name = line.slice(0, equals).trim();
      const valueFrom = start + equals + 1;
      const text = line.slice(equals + 1).trimEnd();
      entries.push({
        line: index,
        name,
        key: { from, to: from + name.length },
        equals: start + equals,
        value: { from: valueFrom, to: valueFrom + text.length, text },
        references: [...text.matchAll(REFERENCE)].map((match) => ({
          from: valueFrom + match.index,
          to: valueFrom + match.index + match[0].length,
          name: match[1] ?? "",
          closed: match[2] === "}",
        })),
      });
    }
    start += line.length + 1;
  });
  return { text, entries, comments, malformed };
};

/** The entry that sets a name: the last one, as later lines win. */
export const definition = (analysis: Analysis, name: string): Entry | undefined =>
  [...analysis.entries].reverse().find((entry) => entry.name === name);

const known = (analysis: Analysis, name: string): boolean =>
  definition(analysis, name) !== undefined || platformFor(name) !== undefined;

/** A value with its references replaced, as far as they resolve. */
const expand = (analysis: Analysis, entry: Entry, seen: ReadonlySet<string>): string =>
  entry.value.text.replace(
    REFERENCE,
    (whole, name: string) => resolve(analysis, name, seen) ?? whole,
  );

/** The value a name stands for: its setting in this file, or the platform's value. */
export const resolve = (
  analysis: Analysis,
  name: string,
  seen: ReadonlySet<string> = new Set(),
): string | undefined => {
  if (seen.has(name)) return undefined;
  const entry = definition(analysis, name);
  return entry === undefined
    ? platformFor(name)?.value
    : expand(analysis, entry, new Set([...seen, name]));
};

const valueKind = (text: string): string =>
  /^(true|false)$/.test(text) ? "constant" : /^-?\d+(\.\d+)?$/.test(text) ? "number" : "string";

/** Kinds for every part of the file. Unknown settings and references are `unknown`. */
export const tokens = (analysis: Analysis): ReadonlyArray<SemanticToken> =>
  [
    ...analysis.comments.map((range) => ({ ...range, kind: "comment" })),
    ...analysis.entries.flatMap((entry) => {
      const parts: SemanticToken[] = [
        { ...entry.key, kind: settingFor(entry.name) === undefined ? "unknown" : "property" },
        { from: entry.equals, to: entry.equals + 1, kind: "operator" },
      ];
      if (entry.references.length === 0 && entry.value.text !== "")
        return [...parts, { ...entry.value, kind: valueKind(entry.value.text) }];
      let at = entry.value.from;
      for (const reference of entry.references) {
        if (reference.from > at) parts.push({ from: at, to: reference.from, kind: "string" });
        parts.push({
          from: reference.from,
          to: reference.to,
          kind: known(analysis, reference.name) ? "reference" : "unknown",
        });
        at = reference.to;
      }
      if (entry.value.to > at) parts.push({ from: at, to: entry.value.to, kind: "string" });
      return parts;
    }),
  ].sort((a, b) => a.from - b.from);

/** The number of single-character edits between two names. */
const distance = (a: string, b: string): number => {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1)
      row[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = row;
  }
  return previous[b.length] ?? 0;
};

const closest = (name: string): string | undefined =>
  Object.keys(settings).find((candidate) => distance(name, candidate) <= 2);

export const diagnostics = (analysis: Analysis): ReadonlyArray<Diagnostic> => [
  ...analysis.malformed.map(
    (range): Diagnostic => ({ ...range, severity: "error", message: "Expected NAME=value." }),
  ),
  ...analysis.entries.flatMap((entry, index): ReadonlyArray<Diagnostic> => {
    const setting = settingFor(entry.name);
    const suggestion = setting === undefined ? closest(entry.name) : undefined;
    const later = analysis.entries.slice(index + 1).find((other) => other.name === entry.name);
    const references = entry.references.flatMap((reference): ReadonlyArray<Diagnostic> => {
      const message = !reference.closed
        ? "Close the reference with }."
        : reference.name === entry.name
          ? `${entry.name} cannot refer to itself.`
          : !known(analysis, reference.name)
            ? `${reference.name} is not set in this file or by the platform.`
            : undefined;
      return message === undefined ? [] : [{ ...reference, severity: "error", message }];
    });
    const value = expand(analysis, entry, new Set([entry.name]));
    // An empty value leaves a setting unset, so it is checked once it has one.
    const invalid =
      setting !== undefined &&
      value !== "" &&
      references.length === 0 &&
      !value.includes("${") &&
      ((setting.values !== undefined && !setting.values.includes(value)) ||
        (setting.accepts !== undefined && !setting.accepts(value)));
    return [
      ...(setting === undefined
        ? [
            {
              ...entry.key,
              severity: "warning" as const,
              message:
                entry.name === ""
                  ? "Expected a name before =."
                  : `${entry.name} is not a setting the deploy host reads.${suggestion === undefined ? "" : ` Did you mean ${suggestion}?`}`,
            },
          ]
        : []),
      ...(later === undefined
        ? []
        : [
            {
              ...entry.key,
              severity: "warning" as const,
              message: `${entry.name} is set again on line ${later.line + 1}, which wins.`,
            },
          ]),
      ...references,
      ...(invalid
        ? [
            {
              ...entry.value,
              severity: "error" as const,
              message: `${entry.name} expects ${setting.expects}.`,
            },
          ]
        : []),
    ];
  }),
];

/** Items that replace `from`–`to`. */
export type Offer = Readonly<{ from: number; to: number; items: ReadonlyArray<CompletionItem> }>;

const NAME_AFTER = /^[A-Za-z0-9_]*/;

/**
 * Suggestions at the caret: setting names at the start of a line, allowed
 * values after `=`, and names inside `${`. Without `invoked`, only when typing
 * has started a word, `=`, or `${`, and something matches.
 */
export const complete = (
  analysis: Analysis,
  caret: number,
  invoked: boolean,
): Offer | undefined => {
  const { text } = analysis;
  const lineStart = caret === 0 ? 0 : text.lastIndexOf("\n", caret - 1) + 1;
  const lineEnd = text.indexOf("\n", caret);
  const before = text.slice(lineStart, caret);
  const after = text.slice(caret, lineEnd < 0 ? text.length : lineEnd);
  const equals = before.indexOf("=");
  const line = text.slice(0, lineStart).split("\n").length - 1;
  const own = analysis.entries.find((entry) => entry.line === line);
  const reference = /\$\{([A-Za-z0-9_]*)$/.exec(before);
  const offer = ((): Offer | undefined => {
    if (before.trimStart().startsWith("#")) return undefined;
    if (reference !== null && equals >= 0) {
      const to = caret + (NAME_AFTER.exec(after)?.[0].length ?? 0);
      const names = [
        ...new Set(
          analysis.entries.map((entry) => entry.name).filter((name) => name !== own?.name),
        ),
      ];
      return {
        from: caret - (reference[1] ?? "").length,
        to: text[to] === "}" ? to + 1 : to,
        items: [
          ...names.map((name) => ({
            label: name,
            insert: name + "}",
            detail: resolve(analysis, name) ?? "",
            kind: "reference",
          })),
          ...Object.entries(platform).map(([name, { value }]) => ({
            label: name,
            insert: name + "}",
            detail: `${value} · platform`,
            kind: "reference",
          })),
        ],
      };
    }
    if (equals < 0) {
      const word = before.trimStart();
      if (!/^[A-Za-z0-9_]*$/.test(word) || (!invoked && word === "")) return undefined;
      const tail = NAME_AFTER.exec(after)?.[0] ?? "";
      const set = new Set(
        analysis.entries.filter((entry) => entry !== own).map((entry) => entry.name),
      );
      return {
        from: caret - word.length,
        to: caret + tail.length,
        items: Object.entries(settings)
          .filter(([name]) => !set.has(name))
          .map(([name, setting]) => ({
            label: name,
            insert: after.slice(tail.length).trimStart().startsWith("=") ? name : `${name}=`,
            detail: setting.expects,
            kind: "property",
          })),
      };
    }
    const values = settingFor(before.slice(0, equals).trim())?.values;
    const typed = before.slice(equals + 1);
    if (values === undefined || !/^[A-Za-z0-9_.-]*$/.test(typed)) return undefined;
    const tail = /^[A-Za-z0-9_.-]*/.exec(after)?.[0] ?? "";
    return {
      from: caret - typed.length,
      to: caret + tail.length,
      items: values.map((value) => ({ label: value, kind: "value" })),
    };
  })();
  if (offer === undefined) return undefined;
  if (
    !invoked &&
    Completion.visible(Completion.open(offer.from, offer.to, offer.items), text, caret).length === 0
  )
    return undefined;
  return offer;
};

/** What hovering explains: a setting, a reference, or a value that uses references. */
export type Description = TextRange &
  Readonly<{
    title: string;
    kind: string;
    summary?: string;
    values?: ReadonlyArray<string>;
    value?: string;
  }>;

const within = (range: TextRange, offset: number) => offset >= range.from && offset < range.to;

export const describe = (analysis: Analysis, offset: number): Description | undefined => {
  const entry = analysis.entries.find(
    (candidate) =>
      offset >= candidate.key.from && offset < Math.max(candidate.value.to, candidate.equals + 1),
  );
  if (entry === undefined) return undefined;
  if (within(entry.key, offset)) {
    const setting = settingFor(entry.name);
    if (setting === undefined) return undefined;
    return {
      ...entry.key,
      title: entry.name,
      kind: `Setting · ${setting.expects}`,
      summary: setting.summary,
      ...(setting.values === undefined ? {} : { values: setting.values }),
    };
  }
  const reference = entry.references.find((candidate) => within(candidate, offset));
  if (reference !== undefined) {
    const defined = definition(analysis, reference.name);
    const provided = platformFor(reference.name);
    const value = resolve(analysis, reference.name);
    if (!reference.closed || value === undefined) return undefined;
    return {
      from: reference.from,
      to: reference.to,
      title: reference.name,
      kind: defined === undefined ? "Platform value" : `Set on line ${defined.line + 1}`,
      ...(defined === undefined && provided !== undefined ? { summary: provided.summary } : {}),
      value,
    };
  }
  if (!within(entry.value, offset) || entry.references.length === 0) return undefined;
  return {
    ...entry.value,
    title: entry.name,
    kind: "Value",
    value: expand(analysis, entry, new Set([entry.name])),
  };
};

/** Where a name is set, as whole lines, and where it is used. */
export const occurrences = (
  analysis: Analysis,
  name: string,
): ReadonlyArray<TextRange & Readonly<{ kind: "definition" | "reference" }>> => [
  ...analysis.entries
    .filter((entry) => entry.name === name)
    .map((entry) => ({ from: entry.key.from, to: entry.value.to, kind: "definition" as const })),
  ...analysis.entries.flatMap((entry) =>
    entry.references
      .filter((reference) => reference.name === name && reference.closed)
      .map((reference) => ({ from: reference.from, to: reference.to, kind: "reference" as const })),
  ),
];
