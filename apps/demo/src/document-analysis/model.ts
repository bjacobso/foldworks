import { Schema as S } from "effect";
import { PdfViewer } from "@foldworks/pdf-viewer";
import { PdfTextRegion } from "@foldworks/pdf";
import * as Graph from "@foldworks/diagram/graph";
import { Citation } from "@foldworks/ui";

export const Model = S.Struct({
  viewer: PdfViewer.Model,
  graph: Graph.Model,
  citation: Citation.Model,
  regions: S.Array(PdfTextRegion),
  selectedKey: S.String,
  selectedText: S.String,
  diffMode: S.Literals(["inline", "split"]),
  announcement: S.String,
  error: S.String,
});
export type Model = typeof Model.Type;
export const init = (): Model => ({
  viewer: PdfViewer.init({ id: "analysis-pdf", maxCachedPages: 3 }),
  graph: Graph.init({ id: "analysis-graph" }),
  citation: Citation.init({ id: "analysis-citation", showDelay: 100 }),
  regions: [],
  selectedKey: "",
  selectedText: "",
  diffMode: "inline",
  announcement: "",
  error: "",
});
