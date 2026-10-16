export * from "./core";
export {
  view,
  lineGutterId,
  type ViewConfig,
  type Highlight,
  type DiffAnnotation,
  type DiffLineRef,
} from "./view";
export * as DiffViewer from "./view";
export {
  diffText,
  ProseDiff,
  type DiffTextOptions,
  type ProseDiffConfig,
  type TextDiffPart,
} from "./prose";

export * from "./file";
export * from "./anchors";
export * from "./values";
