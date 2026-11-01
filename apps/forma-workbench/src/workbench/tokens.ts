// Highlighting comes from the syntax identity, not a second lexer: every
// token is a node, and delimiters are the first and last characters of the
// collections that contain them. A symbol's kind comes from the language
// services when they know it (a definition, a reference, a local, a form)
// and from its spelling otherwise.

import type { SemanticToken } from "@foldworks/text-intelligence";
import type { SyntaxIdentity, SyntaxNode } from "@formalang/ts/syntax";

/** What the analysis knows about a symbol node, for its highlighting. */
export type SymbolKind =
  | "definition"
  | "defined"
  | "declared"
  | "local"
  | "special"
  | "macro"
  | "form"
  | "builtin"
  | "capability"
  | "unresolved";

const CLOSERS: Readonly<Record<string, string>> = { "(": ")", "[": "]", "{": "}" };

/**
 * Tokens for a text and its identity. `kindOf` names the kind of a symbol node
 * the analysis resolved; `shift` moves every token, for a text read on its own.
 */
export const tokensOf = (
  text: string,
  identity: Pick<SyntaxIdentity, "nodes">,
  kindOf: (node: SyntaxNode) => string | undefined = () => undefined,
  shift = 0,
): ReadonlyArray<SemanticToken> => {
  const tokens: SemanticToken[] = [];
  const children = new Map<string, SyntaxNode[]>();
  for (const node of identity.nodes) {
    if (node.parent === null) continue;
    const list = children.get(node.parent);
    if (list === undefined) children.set(node.parent, [node]);
    else list.push(node);
  }
  const push = (from: number, to: number, kind: string) => {
    if (to > from) tokens.push({ from: from + shift, to: to + shift, kind });
  };
  for (const node of identity.nodes) {
    const { start, end } = node.span;
    const word = text.slice(start, end);
    switch (node.kind) {
      case "List":
      case "Vector":
      case "Map":
      case "Set": {
        const open = text[start] ?? "";
        push(start, start + 1, "paren");
        if (end - start >= 2 && text[end - 1] === CLOSERS[open]) push(end - 1, end, "paren");
        break;
      }
      case "ReaderMacro": {
        const inner = children.get(node.id)?.[0];
        push(start, inner?.span.start ?? end, "paren");
        break;
      }
      case "String":
        push(start, end, "string");
        break;
      case "Number":
        push(start, end, "number");
        break;
      case "Boolean":
        push(start, end, "constant");
        break;
      case "Comment":
        push(start, end, "comment");
        break;
      case "Error":
        push(start, end, "error");
        break;
      case "Symbol": {
        if (word.startsWith(":")) push(start, end, "keyword");
        else if (word === "nil") push(start, end, "constant");
        else {
          const kind = kindOf(node);
          if (kind !== undefined) push(start, end, kind);
        }
        break;
      }
    }
  }
  return tokens.sort((left, right) => left.from - right.from || left.to - right.to);
};
