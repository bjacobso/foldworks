import { Message as MessageSchema, type Message as MessageValue } from "./viewer-message";
import { Model as ModelSchema, type Model as ModelValue } from "./viewer-model";

export const Message = MessageSchema;
export type Message = MessageValue;
export const Model = ModelSchema;
export type Model = ModelValue;
export {
  effectiveZoomPercent,
  init,
  PageImage,
  ViewerDocument,
  ViewerPage,
  Zoom,
  type InitConfig,
} from "./viewer-model";
export { goToPage, loadBytes, loadUrl, scrollTo, update } from "./viewer-update";
export { view, type PdfOverlay, type PdfOverlayTone, type ViewConfig } from "./viewer-view";
