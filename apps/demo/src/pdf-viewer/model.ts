import { Option, Schema as S } from "effect";
import { PdfViewer } from "@foldworks/pdf-annotator";

export const StatusFilter = S.Literals(["all", "filled", "blank", "omitted", "missing"]);
export type StatusFilter = typeof StatusFilter.Type;

export const Model = S.Struct({
  viewer: PdfViewer.Model,
  selectedKey: S.Option(S.String),
  statusFilter: StatusFilter,
  showOverlays: S.Boolean,
  generateError: S.String,
});
export type Model = typeof Model.Type;

export const initialModel: Model = {
  viewer: PdfViewer.init({ id: "foldworks-pdf-viewer" }),
  selectedKey: Option.none(),
  statusFilter: "all",
  showOverlays: true,
  generateError: "",
};
