// Paints rows: tokens become styled runs of the row's text.

import { segments, type SemanticToken } from "@foldworks/text-intelligence";
import type { TextSpan } from "@foldworks/outliner";
import { identifySyntax } from "@formalang/ts/syntax";

import { tokensOf } from "./tokens.js";

/** Runs of a text, each with the kind of the token that covers it. */
export const spansOf = (
  text: string,
  tokens: ReadonlyArray<SemanticToken>,
): ReadonlyArray<TextSpan> =>
  segments(text, { tokens }).map((segment) => {
    const kind = segment.covering.tokens.at(-1)?.kind;
    return kind === undefined ? { text: segment.text } : { text: segment.text, kind };
  });

/** Highlighting a row's text from its syntax alone, before the analysis knows it. */
export const lexicalTokens = (text: string): ReadonlyArray<SemanticToken> =>
  tokensOf(text, identifySyntax(text));
