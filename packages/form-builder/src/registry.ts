import type { Html, HtmlBuilder } from "foldkit/html";

import type { FormField } from "./document";

export type FieldPalette = Readonly<{
  label: string;
  description: string;
}>;

export type FieldRenderContext<
  Field extends FormField,
  Message,
  Value = string,
> = Readonly<{
  field: Field;
  mode: "Editor" | "Runner";
  value: Value;
  onInput: (value: Value) => Message;
}>;

export type FieldTypeDefinition<
  Field extends FormField,
  Message,
  Value = string,
> = Readonly<{
  palette: FieldPalette;
  create: (id: string) => Field;
  render: (
    context: FieldRenderContext<Field, Message, Value>,
    h: HtmlBuilder<Message>,
  ) => Html;
}>;

export const defineFieldTypes = <const Definitions>(definitions: Definitions): Definitions =>
  definitions;

const PALETTE_PREFIX = "form-palette:";

export const paletteItemId = (type: string): string =>
  `${PALETTE_PREFIX}${encodeURIComponent(type)}`;

export const paletteTypeFromId = (id: string): string | undefined => {
  if (!id.startsWith(PALETTE_PREFIX)) return undefined;
  const encodedType = id.slice(PALETTE_PREFIX.length);
  if (encodedType.length === 0) return undefined;
  try {
    return decodeURIComponent(encodedType);
  } catch {
    return undefined;
  }
};
