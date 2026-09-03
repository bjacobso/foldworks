import type { DragAndDrop } from "@foldkit/ui";

import {
  dragItemFromId,
  dropLocationFromId,
  type DropLocation,
  type FieldLocation,
  type FormDocument,
  type FormField,
  type ItemKind,
} from "./document";
import { paletteTypeFromId } from "./registry";

export type ReorderOperations<Field extends FormField> = Readonly<{
  insertField: (
    document: FormDocument<Field>,
    location: FieldLocation,
    field: Field,
  ) => FormDocument<Field> | undefined;
  moveItem: (
    document: FormDocument<Field>,
    kind: ItemKind,
    itemId: string,
    location: DropLocation,
  ) => FormDocument<Field> | undefined;
}>;

export type ReorderResult<Field extends FormField> =
  | Readonly<{
      _tag: "Inserted";
      document: FormDocument<Field>;
      field: Field;
      location: FieldLocation;
    }>
  | Readonly<{
      _tag: "Moved";
      document: FormDocument<Field>;
      item: Readonly<{ kind: ItemKind; id: string }>;
      location: DropLocation;
    }>;

export type ApplyReorderConfig<Field extends FormField> = Readonly<{
  document: FormDocument<Field>;
  reordered: Extract<DragAndDrop.OutMessage, { readonly _tag: "Reordered" }>;
  operations: ReorderOperations<Field>;
  createFromPalette: (type: string, location: FieldLocation) => Field | undefined;
}>;

export const applyReorder = <Field extends FormField>(
  config: ApplyReorderConfig<Field>,
): ReorderResult<Field> | undefined => {
  const location = dropLocationFromId(config.reordered.toContainerId);
  if (location === undefined) return undefined;
  const paletteType = paletteTypeFromId(config.reordered.itemId);
  if (paletteType !== undefined) {
    if (location.kind !== "Field") return undefined;
    const field = config.createFromPalette(paletteType, location);
    if (field === undefined) return undefined;
    const document = config.operations.insertField(config.document, location, field);
    return document === undefined
      ? undefined
      : { _tag: "Inserted", document, field, location };
  }
  const item = dragItemFromId(config.reordered.itemId);
  if (item === undefined || item.kind !== location.kind) return undefined;
  const document = config.operations.moveItem(
    config.document,
    item.kind,
    item.id,
    location,
  );
  return document === undefined
    ? undefined
    : { _tag: "Moved", document, item, location };
};
