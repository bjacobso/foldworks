import type { LexState, Line, Token, TokenKind } from "./tokenize";

/** Approximate YAML coloring, with state for quoted and indented block scalars. */
export const tokenizeYamlLine = (text: string, incoming: LexState): Line => {
  const tokens: Token[] = [];
  const indent = /^ */.exec(text)![0].length;
  if (incoming.startsWith("yaml-block:") && (!text.trim() || indent > Number(incoming.slice(11)))) {
    return { text, incoming, outgoing: incoming, tokens: [{ from: 0, to: text.length, kind: "string" }] };
  }
  let state: LexState = incoming === "yaml-single" || incoming === "yaml-double" ? incoming : "code";
  let i = 0;
  const emit = (from: number, kind: TokenKind) => { if (i > from) tokens.push({ from, to: i, kind }); };
  const quoted = (quote: string) => {
    while (i < text.length) {
      if ((quote === '"' && text[i] === "\\") || (quote === "'" && text.slice(i, i + 2) === "''")) { i = Math.min(text.length, i + 2); continue; }
      if (text[i++] === quote) { state = "code"; return; }
    }
    state = quote === "'" ? "yaml-single" : "yaml-double";
  };
  while (i < text.length) {
    const from = i;
    if (state === "yaml-single" || state === "yaml-double") {
      quoted(state === "yaml-single" ? "'" : '"'); emit(from, "string");
    } else if (/\s/.test(text[i]!)) {
      while (i < text.length && /\s/.test(text[i]!)) i++;
      emit(from, "plain");
    } else if (text[i] === "#" && (i === 0 || /\s/.test(text[i - 1]!))) {
      i = text.length; emit(from, "comment");
    } else if (["'", '"'].includes(text[i]!)) {
      const quote = text[i++]!; quoted(quote);
      emit(from, /^\s*:(?:\s|$|[\[\]{},])/.test(text.slice(i)) ? "property" : "string");
    } else if (/^[|>][1-9+-]{0,2}(?:\s+#.*)?\s*$/.test(text.slice(i))) {
      const indicator = /[1-9]/.exec(text.slice(i))?.[0];
      const base = indent + (/^\s*-\s/.test(text) ? 2 : 0);
      state = `yaml-block:${base + (indicator ? Number(indicator) - 1 : 0)}`;
      while (i < text.length && !/\s/.test(text[i]!)) i++;
      emit(from, "punctuation");
    } else if (/^(?:---|\.\.\.)(?:\s|$)/.test(text.slice(i))) {
      i += 3; emit(from, "punctuation");
    } else if (/[\[\]{},]/.test(text[i]!) || /^[-?:](?:\s|$)/.test(text.slice(i))) {
      i++; emit(from, "punctuation");
    } else if (/^[&*!]/.test(text.slice(i))) {
      i += /^[^\s,\[\]{}]+/.exec(text.slice(i))![0].length; emit(from, "type");
    } else {
      const key = /^[^\s'"\[\]{},#][^\[\]{},#]*?(?=:(?:\s|$|[\[\]{},]))/.exec(text.slice(i));
      if (key) { i += key[0].length; emit(from, "property"); i++; emit(i - 1, "punctuation"); }
      else {
        const word = /^[^\s,\[\]{}]+/.exec(text.slice(i))![0];
        i += word.length;
        emit(from, /^(?:true|false|null|~)$/i.test(word) ? "keyword"
          : /^[-+]?(?:0x[\da-f]+|0o[0-7]+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?|\.inf|\.nan)$/i.test(word) ? "number" : "string");
      }
    }
  }
  return { text, incoming, outgoing: state, tokens };
};
