import * as stylex from "@stylexjs/stylex";
import type { Attribute, HtmlBuilder } from "foldkit/html";

export const sxAttrs = <Message>(
  h: HtmlBuilder<Message>,
  ...styles: ReadonlyArray<stylex.StyleXStyles | stylex.CompiledStyles>
): ReadonlyArray<Attribute<Message>> => {
  const { className, style } = stylex.props(
    ...(styles as ReadonlyArray<stylex.StyleXStyles>),
  );
  const attributes: Array<Attribute<Message>> = [];
  if (className !== undefined && className !== "") attributes.push(h.Class(className));
  if (style !== undefined && Object.keys(style).length > 0) {
    attributes.push(h.Style(style as Record<string, string>));
  }
  return attributes;
};
