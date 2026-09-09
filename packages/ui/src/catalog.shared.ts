import type * as stylex from "@stylexjs/stylex";
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from "foldkit/html";

import { sxAttrs } from "./sx";

export type Children = ReadonlyArray<Html | string>;

export type StyledConfig<Message> = Readonly<{
  attributes?: ReadonlyArray<Attribute<Message> | ChildAttribute>;
  style?: stylex.StyleXStyles;
}>;

export const styledAttrs = <Message>(
  config: StyledConfig<Message>,
  h: HtmlBuilder<Message>,
  ...styles: ReadonlyArray<stylex.StyleXStyles | stylex.CompiledStyles>
): ReadonlyArray<Attribute<Message> | ChildAttribute> => [
  ...(config.attributes ?? []),
  ...sxAttrs(h, ...styles, config.style),
];

export const optional = <Value>(value: Value | undefined): ReadonlyArray<Value> =>
  value === undefined ? [] : [value];

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
