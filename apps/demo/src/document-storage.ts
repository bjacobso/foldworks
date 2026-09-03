import { Schema as S } from "effect";

import {
  FormDocument,
  FormDocuments,
  type FormDocument as FormDocumentType,
} from "./form-builder/model";
import {
  WorkflowDocument,
  type WorkflowDocument as WorkflowDocumentType,
} from "./workflow/model";
export { nextFormId, nextWorkflowId } from "./document-ids";

export const WORKSPACE_STORAGE_KEY = "foldworks-demo-documents-v1";

export const PersistedWorkspace = S.Struct({
  version: S.Literal(1),
  workflow: WorkflowDocument,
  forms: FormDocuments,
});
export type PersistedWorkspace = typeof PersistedWorkspace.Type;

const WorkflowExport = S.Struct({
  version: S.Literal(1),
  kind: S.Literal("workflow"),
  document: WorkflowDocument,
});

const FormExport = S.Struct({
  version: S.Literal(1),
  kind: S.Literal("form"),
  document: FormDocument,
});

const parse = <Value>(schema: S.Codec<Value, unknown, never>, json: string): Value | undefined => {
  try {
    return S.decodeUnknownSync(schema)(JSON.parse(json));
  } catch {
    return undefined;
  }
};

export const readPersistedWorkspace = (): PersistedWorkspace | undefined => {
  try {
    const json = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return json === null ? undefined : parse(PersistedWorkspace, json);
  } catch {
    return undefined;
  }
};

export const serializeWorkspace = (workspace: PersistedWorkspace): string =>
  JSON.stringify(S.encodeSync(PersistedWorkspace)(workspace));

export const writePersistedWorkspace = (json: string): boolean => {
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, json);
    return true;
  } catch {
    return false;
  }
};

export const serializeWorkflowExport = (document: WorkflowDocumentType): string =>
  JSON.stringify(S.encodeSync(WorkflowExport)({ version: 1, kind: "workflow", document }), null, 2);

export const serializeFormExport = (document: FormDocumentType): string =>
  JSON.stringify(S.encodeSync(FormExport)({ version: 1, kind: "form", document }), null, 2);

export const parseWorkflowExport = (json: string): WorkflowDocumentType | undefined =>
  parse(WorkflowExport, json)?.document;

export const parseFormExport = (json: string): FormDocumentType | undefined =>
  parse(FormExport, json)?.document;

export const downloadJson = (filename: string, json: string): void => {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
