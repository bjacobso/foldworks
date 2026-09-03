import { Option, Schema as S } from "effect";

import { FormBuilder } from "@foldworks/form-builder";
import { History } from "@foldworks/history";

import { nextFormId } from "../document-ids";
import {
  ContentView,
  FormAnswer,
  FormDocument,
  FormDocuments,
  FormExampleId,
  FormMode,
  FormSelection,
  exampleForms,
} from "./model";

export const FormHistory = History.Schema(FormDocument);

export const Model = S.Struct({
  document: FormDocument,
  documents: FormDocuments,
  history: FormHistory,
  interaction: FormBuilder.Model,
  exampleId: FormExampleId,
  mode: FormMode,
  selectedItem: S.Option(FormSelection),
  activePageId: S.String,
  previewActorId: S.String,
  answers: S.Array(FormAnswer),
  contentViews: S.Array(ContentView),
  nextId: S.Number,
  revision: S.Number,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export const init = (
  documents: FormDocuments = exampleForms,
  exampleId: FormExampleId = "Handoff",
  mode: FormMode = "Editor",
): Model => {
  const document = documents[exampleId];
  return {
    document,
    documents,
    history: History.init<FormDocument>(),
    interaction: FormBuilder.init(),
    exampleId,
    mode,
    selectedItem: Option.none(),
    activePageId: document.sections[0]?.pages[0]?.id ?? "",
    previewActorId: document.actors[0]?.id ?? "__journey__",
    answers: [],
    contentViews: [],
    nextId: nextFormId(document),
    revision: 0,
    announcement: `${document.title} form builder ready.`,
  };
};

export const initialModel: Model = init();
