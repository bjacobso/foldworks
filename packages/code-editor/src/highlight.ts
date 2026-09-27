import { tokenize, type TokenKind } from "./native/tokenize";

export type { TokenKind };
export type HighlightToken = Readonly<{ text: string; kind: TokenKind }>;

/**
 * Highlights read-only source with the editor's lexer, without an editor model.
 * The result matches `@foldworks/ui`'s `CodeBlock.Highlighter`.
 */
export const highlight = (
  code: string,
  language = "text",
): ReadonlyArray<ReadonlyArray<HighlightToken>> =>
  tokenize(code, language).map(({ text, tokens }) => {
    const result: HighlightToken[] = [];
    let offset = 0;
    for (const token of tokens) {
      if (token.from > offset) result.push({ text: text.slice(offset, token.from), kind: "plain" });
      result.push({ text: text.slice(token.from, token.to), kind: token.kind });
      offset = token.to;
    }
    if (offset < text.length) result.push({ text: text.slice(offset), kind: "plain" });
    return result;
  });
