import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { FormBuilder } from "@foldworks/form-builder";

import { FormExampleId, FormMode } from "./model";

export const Message = defineMessageUnion({
  CompletedExportDocument: {},
  CompletedImportDocument: { json: S.String },
  CancelledImportDocument: {},
  FailedImportDocument: { reason: S.String },
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedExportDocument: {},
  ClickedImportDocument: {},
  GotInteractionMessage: { message: FormBuilder.Message },
  SelectedExample: { exampleId: FormExampleId },
  SelectedMode: { mode: FormMode },
  SelectedItem: { kind: S.Literals(["Section", "Page", "Field"]), id: S.String },
  SelectedPreviewActor: { actorId: S.String },
  ClickedAddSection: {},
  ClickedAddPage: { sectionId: S.String },
  ClickedAddField: { pageId: S.String, fieldType: S.String },
  ChangedItemTitle: { value: S.String },
  ChangedItemDescription: { value: S.String },
  ChangedSectionActor: { actorId: S.String },
  ChangedFieldRequired: { required: S.Boolean },
  ChangedFieldContent: { value: S.String },
  ChangedFieldOptions: { value: S.String },
  ClickedDeleteItem: {},
  ClickedReset: {},
  ChangedAnswer: { fieldId: S.String, value: S.String },
  ClickedPreviewPrevious: {},
  ClickedPreviewNext: {},
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  Changed: {},
  RequestedRoute: { exampleId: FormExampleId, mode: FormMode },
});
export type OutMessage = typeof OutMessage.Type;
