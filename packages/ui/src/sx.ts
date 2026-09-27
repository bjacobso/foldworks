import * as stylex from "@stylexjs/stylex";

type StyleAttribute =
  | Readonly<{ _tag: "Class"; value: string }>
  | Readonly<{ _tag: "Style"; value: Record<string, string> }>;

type StyleBuilder = Readonly<{
  Class: (value: string) => StyleAttribute;
  Style: (value: Record<string, string>) => StyleAttribute;
}>;

/** StyleX produces only message-free class and inline-style attributes. */
export const sxAttrs = <Message>(
  h: StyleBuilder,
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
