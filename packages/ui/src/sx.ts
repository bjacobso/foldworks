import * as stylex from "@stylexjs/stylex";
import type { HtmlBuilder } from "foldkit/html";

type StyleAttributeBuilder = Pick<HtmlBuilder<never>, "Class" | "Style">;

export type StyleAttribute =
  | ReturnType<StyleAttributeBuilder["Class"]>
  | ReturnType<StyleAttributeBuilder["Style"]>;

/**
 * Converts StyleX styles into Foldkit `Class` and `Style` attributes.
 *
 * `h` only needs those two constructors. Accepting them structurally, rather
 * than inferring `Message` from the full `HtmlBuilder`, keeps each call site
 * cheap for the type checker. The result is assignable to any
 * `Attribute<Message>` array. The type parameter is kept for callers that
 * still pass it explicitly.
 */
export const sxAttrs = <_Message = never>(
  h: StyleAttributeBuilder,
  ...styles: ReadonlyArray<stylex.StyleXStyles | stylex.CompiledStyles>
): ReadonlyArray<StyleAttribute> => {
  const { className, style } = stylex.props(...(styles as ReadonlyArray<stylex.StyleXStyles>));
  const attributes: Array<StyleAttribute> = [];
  if (className !== undefined && className !== "") attributes.push(h.Class(className));
  if (style !== undefined && Object.keys(style).length > 0) {
    attributes.push(h.Style(style as Record<string, string>));
  }
  return attributes;
};
