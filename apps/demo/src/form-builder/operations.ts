import { findField, findPage, findSection } from "@foldworks/form-builder";

import { fieldTypes, isFieldKind } from "./field-types";
import type { FieldKind, FormDocument, FormSelection } from "./model";

export const selectedFormItem = (
  document: FormDocument,
  selection: FormSelection,
) => {
  if (selection.kind === "Section") return findSection(document, selection.id);
  if (selection.kind === "Page") return findPage(document, selection.id);
  return findField(document, selection.id);
};

export const createField = (kind: FieldKind, nextId: number) =>
  fieldTypes[kind].create(`form-field-${nextId}`);
