import type { LexState, Line, Token, TokenKind } from "./tokenize";

export const lispSpecialForms = new Set(
  "def defn defn- defmacro defonce defmulti defmethod defprotocol defrecord deftype fn fn* let letfn loop recur if if-let if-not when when-not when-let cond condp case do quote var throw try catch finally ns comment and or -> ->> as-> some-> some->> doseq dotimes for binding lambda define set!".split(
    " ",
  ),
);
const delimiter = /[\s,()[\]{}";]/;

/** Lisp strings may span lines; everything else is line-local. */
export const tokenizeLispLine = (text: string, incoming: LexState): Line => {
  const tokens: Token[] = [];
  let state: LexState = incoming;
  let i = 0;
  let headNext = false;
  const emit = (from: number, kind: TokenKind) => {
    if (i > from) tokens.push({ from, to: i, kind });
  };
  const string = () => {
    while (i < text.length) {
      if (text[i] === "\\") i = Math.min(text.length, i + 2);
      else if (text[i++] === '"') return true;
    }
    return false;
  };
  while (i < text.length) {
    const from = i;
    const character = text[i]!;
    if (state === "lisp-string") {
      if (string()) state = "code";
      emit(from, "string");
    } else if (character === ";") {
      i = text.length;
      emit(from, "comment");
    } else if (character === '"' || text.startsWith('#"', i)) {
      i += character === '"' ? 1 : 2;
      if (!string()) state = "lisp-string";
      emit(from, "string");
    } else if (/[\s,]/.test(character)) {
      while (i < text.length && /[\s,]/.test(text[i]!)) i++;
      emit(from, "plain");
      continue;
    } else if (
      "()[]{}".includes(character) ||
      text.startsWith("#{", i) ||
      text.startsWith("#(", i)
    ) {
      i += character === "#" ? 2 : 1;
      emit(from, "punctuation");
      headNext = character === "(" || text.startsWith("#(", from);
      continue;
    } else if (
      "'`~@^".includes(character) ||
      text.startsWith("#'", i) ||
      text.startsWith("#_", i)
    ) {
      i += character === "#" || text.startsWith("~@", i) ? 2 : 1;
      emit(from, "punctuation");
      continue;
    } else {
      if (character === "\\") i += 2;
      while (i < text.length && !delimiter.test(text[i]!)) i++;
      const word = text.slice(from, i);
      emit(
        from,
        word.startsWith("\\")
          ? "string"
          : word.startsWith(":")
            ? "type"
            : /^[+-]?\d/.test(word) || ["true", "false", "nil"].includes(word)
              ? "number"
              : lispSpecialForms.has(word)
                ? "keyword"
                : headNext
                  ? "property"
                  : "plain",
      );
    }
    headNext = false;
  }
  return { text, incoming, outgoing: state, tokens };
};
