import { Schema as S } from "effect";
import { tokenizeYamlLine } from "./yaml-tokenize";

export const TokenKind = S.Literals(["plain", "keyword", "string", "number", "comment", "type", "property", "punctuation"]);
export type TokenKind = typeof TokenKind.Type;
export const LexState = S.Union([S.Literals(["code", "comment", "template", "yaml-single", "yaml-double"]), S.TemplateLiteral(["yaml-block:", S.Number])]);
export type LexState = typeof LexState.Type;
export const Token = S.Struct({ from: S.Number, to: S.Number, kind: TokenKind });
export type Token = typeof Token.Type;
export const Line = S.Struct({ text: S.String, incoming: LexState, outgoing: LexState, tokens: S.Array(Token) });
export type Line = typeof Line.Type;
export const keywords = new Set("as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function if implements import in instanceof interface let new null of private protected public readonly return satisfies static super switch this throw true try type typeof undefined var void while yield".split(" "));

/** A deliberately small stateful lexer, not a JavaScript/TypeScript parser. */
export const tokenizeLine = (text: string, language: string, incoming: LexState): Line => {
  if (language === "yaml" || language === "yml") return tokenizeYamlLine(text, incoming);
  if (language === "text" || !["json", "javascript", "typescript", "jsx", "tsx"].includes(language)) {
    return { text, incoming: "code", outgoing: "code", tokens: [{ from: 0, to: text.length, kind: "plain" }] };
  }
  const tokens: Token[] = [];
  let state = incoming;
  let i = 0;
  const emit = (from: number, kind: TokenKind) => { if (i > from) tokens.push({ from, to: i, kind }); };
  const quoted = (quote: string) => {
    while (i < text.length) {
      if (text[i] === "\\") { i = Math.min(text.length, i + 2); continue; }
      if (text[i++] === quote) return true;
    }
    return false;
  };
  while (i < text.length) {
    const from = i;
    if (state === "comment") {
      const end = text.indexOf("*/", i);
      i = end < 0 ? text.length : end + 2;
      if (end >= 0) state = "code";
      emit(from, "comment");
    } else if (state === "template") {
      if (quoted("`")) state = "code";
      emit(from, "string");
    } else if (language !== "json" && text.startsWith("//", i)) {
      i = text.length; emit(from, "comment");
    } else if (language !== "json" && text.startsWith("/*", i)) {
      i += 2;
      const end = text.indexOf("*/", i);
      i = end < 0 ? text.length : end + 2;
      state = end < 0 ? "comment" : "code";
      emit(from, "comment");
    } else if (text[i] === '"' || (language !== "json" && ["'", "`"].includes(text[i]!))) {
      const quote = text[i++]!;
      const closed = quoted(quote);
      if (!closed && quote === "`") state = "template";
      emit(from, /^\s*:/.test(text.slice(i)) ? "property" : "string");
    } else if (/[\d]/.test(text[i]!) || (text[i] === "-" && /\d/.test(text[i + 1] ?? ""))) {
      const match = /^-?(?:0[xX][\da-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?n?)/.exec(text.slice(i));
      i += match?.[0].length ?? 1; emit(from, "number");
    } else if (/[\p{L}_$]/u.test(text[i]!)) {
      const match = /^[\p{L}\p{M}\p{N}_$]+/u.exec(text.slice(i))!;
      i += match[0].length;
      const word = match[0];
      emit(from, ["true", "false", "null", "undefined"].includes(word) ? "number"
        : keywords.has(word) ? "keyword"
        : /^\s*:/.test(text.slice(i)) ? "property"
        : /^[A-Z]/.test(word) || ["string", "number", "boolean", "never", "unknown"].includes(word) ? "type" : "plain");
    } else if (/\s/.test(text[i]!)) {
      while (i < text.length && /\s/.test(text[i]!)) i++;
      emit(from, "plain");
    } else { i += text.codePointAt(i)! > 0xffff ? 2 : 1; emit(from, "punctuation"); }
  }
  return { text, incoming, outgoing: state, tokens };
};

/** Reuses unchanged lines when lexical state converges, including shifted suffixes. */
export const tokenize = (text: string, language: string, previous: readonly Line[] = []): readonly Line[] => {
  const lines = text.split("\n");
  let suffix = 0;
  while (suffix < Math.min(lines.length, previous.length) && lines[lines.length - 1 - suffix] === previous[previous.length - 1 - suffix]!.text) suffix++;
  let state: LexState = "code";
  return lines.map((line, index) => {
    const old = index >= lines.length - suffix ? previous[previous.length - (lines.length - index)] : previous[index];
    const result = old?.text === line && old.incoming === state ? old : tokenizeLine(line, language, state);
    state = result.outgoing;
    return result;
  });
};

export const lineStarts = (lines: readonly Line[]): readonly number[] => {
  let from = 0;
  return lines.map((line) => { const start = from; from += line.text.length + 1; return start; });
};

export const lineAt = (starts: readonly number[], offset: number): number => {
  let low = 0, high = starts.length;
  while (low + 1 < high) { const middle = (low + high) >> 1; if (starts[middle]! <= offset) low = middle; else high = middle; }
  return low;
};
