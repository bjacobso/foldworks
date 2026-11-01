import type * as stylex from "@stylexjs/stylex";
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from "foldkit/html";

import { sxAttrs } from "./sx";

export type Children = ReadonlyArray<Html | string>;

export type Sx = stylex.StyleXStyles;

/** Styling and attributes accepted by every public component slot. */
export type SlotProps<Message> = Readonly<{
  attributes?: ReadonlyArray<Attribute<Message> | ChildAttribute>;
  /** StyleX styles applied after the component's built-in recipe. */
  sx?: Sx;
}>;

/** Root-slot shorthand shared by styled component configs. */
export type StyledConfig<Message> = SlotProps<Message>;

export type WithSlotProps<Message, Slot extends string> = Readonly<{
  slotProps?: Readonly<Partial<Record<Slot, SlotProps<Message>>>>;
}>;

export const slotAttrs = <Message>(
  slot: SlotProps<Message> | undefined,
  h: HtmlBuilder<Message>,
  ...styles: ReadonlyArray<stylex.StyleXStyles | stylex.CompiledStyles>
): ReadonlyArray<Attribute<Message> | ChildAttribute> => [
  ...(slot?.attributes ?? []),
  ...sxAttrs(h, ...styles, slot?.sx),
];

export const styledAttrs = <Message>(
  config: StyledConfig<Message>,
  h: HtmlBuilder<Message>,
  ...styles: ReadonlyArray<stylex.StyleXStyles | stylex.CompiledStyles>
): ReadonlyArray<Attribute<Message> | ChildAttribute> => [
  ...(config.attributes ?? []),
  ...sxAttrs(h, ...styles, config.sx),
];

/** Merge root shorthand with `slotProps.root`; the explicit root slot wins. */
export const rootAttrs = <Message>(
  config: StyledConfig<Message> & WithSlotProps<Message, "root">,
  h: HtmlBuilder<Message>,
  ...styles: ReadonlyArray<stylex.StyleXStyles | stylex.CompiledStyles>
): ReadonlyArray<Attribute<Message> | ChildAttribute> => {
  const root = config.slotProps?.root;
  return [
    ...(config.attributes ?? []),
    ...(root?.attributes ?? []),
    ...sxAttrs(h, ...styles, config.sx, root?.sx),
  ];
};

export const optional = <Value>(value: Value | undefined): ReadonlyArray<Value> =>
  value === undefined ? [] : [value];

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
