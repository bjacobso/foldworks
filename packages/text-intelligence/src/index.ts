export {
  CompletionItem,
  Diagnostic,
  HoverSource,
  SEVERITIES,
  SemanticToken,
  Severity,
  TextRange,
  diagnosticsAt,
  mostSevere,
} from "./vocabulary";
export * as Completion from "./completion";
export { segments, type Segment } from "./segments";
export { isOver, offsetAtPoint, rangeRects, rectAtOffset } from "./geometry";
export {
  Anchor,
  CompletionPopup,
  HoverPopup,
  optionId,
  type CompletionPopupConfig,
  type Hover,
  type HoverPopupConfig,
} from "./popup";
