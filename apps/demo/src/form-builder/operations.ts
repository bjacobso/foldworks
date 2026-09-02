import {
  findField,
  findPage,
  findSection,
  type DropLocation,
} from "@foldworks/form-builder";

import { fieldTypes, isFieldKind } from "./field-types";
import type { FieldKind, FormDocument, FormSelection } from "./model";

const PALETTE_PREFIX = "form-palette:";

export const paletteFieldId = (kind: FieldKind) => `${PALETTE_PREFIX}${kind}`;

export const paletteKindFromId = (id: string): FieldKind | undefined => {
  if (!id.startsWith(PALETTE_PREFIX)) return undefined;
  const kind = id.slice(PALETTE_PREFIX.length);
  return isFieldKind(kind) ? kind : undefined;
};

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

export const isCompatibleDrop = (
  itemKind: "Section" | "Page" | "Field",
  location: DropLocation,
) => itemKind === location.kind;
