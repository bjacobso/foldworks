import type {
  Completion,
  Diagnostic,
  Hover,
  HoverSource,
  SemanticToken,
} from "@foldworks/text-intelligence";
import type { HtmlBuilder } from "foldkit/html";
import type { Block, Document } from "./document";
import type { Message } from "./model";

/** Pure, synchronous providers. Coordinates are UTF-16 offsets in plainText(node). */
export type TextIntelligence = Readonly<{
  analyze?: (
    node: Block,
    document: Document,
  ) => Readonly<{ tokens?: ReadonlyArray<SemanticToken>; diagnostics?: ReadonlyArray<Diagnostic> }>;
  complete?: (node: Block, document: Document, caret: number) => Completion.List | undefined;
  hover?: (
    node: Block,
    document: Document,
    offset: number,
    source: HoverSource,
    h: HtmlBuilder<Message>,
  ) => Hover | null;
}>;
