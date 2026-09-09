import { init, Model } from "./native/model";
import { Message } from "./native/message";
import { update } from "./native/update";
import { view } from "./native/view";
import type { EditorImplementation, EditorSnapshot, Operation } from "./contracts";

export { Model, init, type HistoryGroup } from "./native/model";
export { Message, type Action } from "./native/message";
export { update } from "./native/update";
export { view, visibleLines, type ViewConfig } from "./native/view";
export * from "./contracts";

export const execute = (operation: Operation): Message => Message.Execute({ operation });
export const snapshot = (model: Model): EditorSnapshot => ({
  id: model.id, document: model.document, selection: model.selection,
  options: model.options, diagnostics: model.diagnostics, status: model.status, error: model.error,
});
export const implementation = { id: "native", Model, Message, init, execute, update, view, snapshot } satisfies EditorImplementation<Model, Message>;
