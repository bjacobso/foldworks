import type { Html, HtmlBuilder } from "foldkit/html";

import type { FormField } from "./document";

export type FieldPalette = Readonly<{
  label: string;
  description: string;
  symbol: string;
}>;

export type FieldRenderContext<Field extends FormField, Message> = Readonly<{
  field: Field;
  mode: "Editor" | "Runner";
  value: string;
  onInput: (value: string) => Message;
}>;

export type FieldTypeDefinition<Field extends FormField, Message> = Readonly<{
  palette: FieldPalette;
  create: (id: string) => Field;
  render: (
    context: FieldRenderContext<Field, Message>,
    h: HtmlBuilder<Message>,
  ) => Html;
}>;

export const defineFieldTypes = <const Definitions>(definitions: Definitions): Definitions =>
  definitions;
