import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { PageInfo } from "./viewer-model";

export const Message = defineMessageUnion({
  RequestedLoadUrl: { url: S.String, name: S.String },
  RequestedLoadBytes: { name: S.String, bytesBase64: S.String },
  CompletedLoad: {
    revision: S.Number,
    name: S.String,
    bytesBase64: S.String,
    pages: S.Array(PageInfo),
  },
  FailedLoad: { revision: S.Number, name: S.String, reason: S.String },
  CompletedRenderPage: { revision: S.Number, pageIndex: S.Number, url: S.String },
  FailedRenderPage: { revision: S.Number, pageIndex: S.Number, reason: S.String },
  RequestedPage: { pageIndex: S.Number },
  CompletedScrollToPage: {},
  ScrolledToPage: { pageIndex: S.Number },
  MeasuredViewport: { width: S.Number },
  ChangedZoom: { percent: S.Number },
  SelectedFitWidth: {},
  RequestedScrollToOverlay: { overlayKey: S.String },
  CompletedScrollToOverlay: { overlayKey: S.String, found: S.Boolean },
  ClickedDownload: {},
  CompletedDownload: {},
});
export type Message = typeof Message.Type;
