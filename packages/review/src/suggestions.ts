import { Schema as S } from "effect";

export const Suggestion = S.Struct({
  path: S.String,
  startLine: S.Number,
  endLine: S.Number,
  replacement: S.String,
  /** Exact original range content, joined with LF, without its terminal newline. */
  expected: S.String,
});
export type Suggestion = typeof Suggestion.Type;
export type SuggestionResult =
  | Readonly<{ status: "applied"; text: string }>
  | Readonly<{
      status: "rejected";
      reason: "overlap" | "mixed-paths" | "stale";
      stale: readonly Suggestion[];
    }>;
/** Atomic application; the host chooses when to commit and resolve threads. */
export const applySuggestions = (
  text: string,
  suggestions: readonly Suggestion[],
): SuggestionResult => {
  if (!suggestions.length) return { status: "applied", text };
  const normalized = text.replace(/\r\n/g, "\n");
  const finalNewline = normalized.endsWith("\n");
  const lines =
    normalized === "" ? [] : normalized.slice(0, finalNewline ? -1 : undefined).split("\n");
  const sorted = [...suggestions].sort((a, b) => a.startLine - b.startLine);
  if (new Set(sorted.map((s) => s.path)).size > 1)
    return { status: "rejected", reason: "mixed-paths", stale: [] };
  const stale = sorted.filter(
    (s) =>
      !Number.isInteger(s.startLine) ||
      !Number.isInteger(s.endLine) ||
      s.startLine < 1 ||
      s.endLine < s.startLine ||
      s.endLine > lines.length ||
      lines.slice(s.startLine - 1, s.endLine).join("\n") !== s.expected,
  );
  if (stale.length) return { status: "rejected", reason: "stale", stale };
  if (sorted.some((s, i) => i > 0 && s.startLine <= sorted[i - 1]!.endLine))
    return { status: "rejected", reason: "overlap", stale: [] };
  for (const suggestion of sorted.reverse()) {
    const replacement = suggestion.replacement.replace(/\r\n/g, "\n").replace(/\n$/, "");
    lines.splice(
      suggestion.startLine - 1,
      suggestion.endLine - suggestion.startLine + 1,
      ...(replacement === "" ? [] : replacement.split("\n")),
    );
  }
  return {
    status: "applied",
    text: lines.length ? lines.join("\n") + (finalNewline ? "\n" : "") : "",
  };
};
