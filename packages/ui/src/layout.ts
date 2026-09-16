import * as stylex from "@stylexjs/stylex";
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from "foldkit/html";

import { sxAttrs } from "./sx";
import { contentWidths, space } from "./tokens.stylex.js";

export type Breakpoint = "base" | "sm" | "md" | "lg" | "xl";
export type Responsive<Value extends string | number> = Value | Readonly<Partial<Record<Breakpoint, Value>>>;
export type ResponsiveTo = "viewport" | "container";
export type Gap = "none" | "xs" | "sm" | "md" | "lg" | "xl";
export type Align = "stretch" | "start" | "center" | "end" | "baseline";
export type Justify = "start" | "center" | "end" | "between" | "around" | "evenly";

const gapValues: Readonly<Record<Gap, string>> = {
  none: "0px", xs: space.xs, sm: space.sm, md: space.md, lg: space.lg, xl: space.xl,
};
const alignValues: Readonly<Record<Align, string>> = {
  stretch: "stretch", start: "flex-start", center: "center", end: "flex-end", baseline: "baseline",
};
const justifyValues: Readonly<Record<Justify, string>> = {
  start: "flex-start", center: "center", end: "flex-end", between: "space-between", around: "space-around", evenly: "space-evenly",
};

const responsive = <Value extends string | number>(value: Responsive<Value> | undefined, fallback: Value): Readonly<Partial<Record<Breakpoint, Value>>> =>
  value === undefined ? { base: fallback } : typeof value === "object" ? { base: fallback, ...value } : { base: value };

const variables = <Value extends string | number>(name: string, value: Responsive<Value> | undefined, fallback: Value, serialize: (value: Value) => string): Record<string, string> =>
  Object.fromEntries(Object.entries(responsive(value, fallback)).map(([breakpoint, entry]) => [`--foldworks-${name}-${breakpoint}`, serialize(entry)]));

const styles = stylex.create({
  responsiveFlex: {
    display: "flex",
    flexDirection: {
      default: "var(--foldworks-direction-base)",
      "@media (min-width: 640px)": "var(--foldworks-direction-sm, var(--foldworks-direction-base))",
      "@media (min-width: 768px)": "var(--foldworks-direction-md, var(--foldworks-direction-sm, var(--foldworks-direction-base)))",
      "@media (min-width: 1024px)": "var(--foldworks-direction-lg, var(--foldworks-direction-md, var(--foldworks-direction-sm, var(--foldworks-direction-base))))",
      "@media (min-width: 1280px)": "var(--foldworks-direction-xl, var(--foldworks-direction-lg, var(--foldworks-direction-md, var(--foldworks-direction-sm, var(--foldworks-direction-base)))))",
    },
    gap: {
      default: "var(--foldworks-gap-base)",
      "@media (min-width: 640px)": "var(--foldworks-gap-sm, var(--foldworks-gap-base))",
      "@media (min-width: 768px)": "var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base)))",
      "@media (min-width: 1024px)": "var(--foldworks-gap-lg, var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base))))",
      "@media (min-width: 1280px)": "var(--foldworks-gap-xl, var(--foldworks-gap-lg, var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base)))))",
    },
  },
  responsiveFlexContainer: {
    display: "flex",
    flexDirection: {
      default: "var(--foldworks-direction-base)",
      "@container (min-width: 640px)": "var(--foldworks-direction-sm, var(--foldworks-direction-base))",
      "@container (min-width: 768px)": "var(--foldworks-direction-md, var(--foldworks-direction-sm, var(--foldworks-direction-base)))",
      "@container (min-width: 1024px)": "var(--foldworks-direction-lg, var(--foldworks-direction-md, var(--foldworks-direction-sm, var(--foldworks-direction-base))))",
      "@container (min-width: 1280px)": "var(--foldworks-direction-xl, var(--foldworks-direction-lg, var(--foldworks-direction-md, var(--foldworks-direction-sm, var(--foldworks-direction-base)))))",
    },
    gap: {
      default: "var(--foldworks-gap-base)",
      "@container (min-width: 640px)": "var(--foldworks-gap-sm, var(--foldworks-gap-base))",
      "@container (min-width: 768px)": "var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base)))",
      "@container (min-width: 1024px)": "var(--foldworks-gap-lg, var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base))))",
      "@container (min-width: 1280px)": "var(--foldworks-gap-xl, var(--foldworks-gap-lg, var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base)))))",
    },
  },
  wrap: { flexWrap: "wrap" },
  container: {
    marginInline: "auto", maxWidth: "var(--foldworks-container-width)", width: "100%",
    paddingInline: {
      default: "var(--foldworks-padding-base)",
      "@media (min-width: 640px)": "var(--foldworks-padding-sm, var(--foldworks-padding-base))",
      "@media (min-width: 768px)": "var(--foldworks-padding-md, var(--foldworks-padding-sm, var(--foldworks-padding-base)))",
      "@media (min-width: 1024px)": "var(--foldworks-padding-lg, var(--foldworks-padding-md, var(--foldworks-padding-sm, var(--foldworks-padding-base))))",
      "@media (min-width: 1280px)": "var(--foldworks-padding-xl, var(--foldworks-padding-lg, var(--foldworks-padding-md, var(--foldworks-padding-sm, var(--foldworks-padding-base)))))",
    },
  },
  queryContainer: { containerType: "inline-size" },
  grid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(var(--foldworks-columns-base), minmax(0, 1fr))",
      "@media (min-width: 640px)": "repeat(var(--foldworks-columns-sm, var(--foldworks-columns-base)), minmax(0, 1fr))",
      "@media (min-width: 768px)": "repeat(var(--foldworks-columns-md, var(--foldworks-columns-sm, var(--foldworks-columns-base))), minmax(0, 1fr))",
      "@media (min-width: 1024px)": "repeat(var(--foldworks-columns-lg, var(--foldworks-columns-md, var(--foldworks-columns-sm, var(--foldworks-columns-base)))), minmax(0, 1fr))",
      "@media (min-width: 1280px)": "repeat(var(--foldworks-columns-xl, var(--foldworks-columns-lg, var(--foldworks-columns-md, var(--foldworks-columns-sm, var(--foldworks-columns-base))))), minmax(0, 1fr))",
    },
    gap: {
      default: "var(--foldworks-gap-base)",
      "@media (min-width: 640px)": "var(--foldworks-gap-sm, var(--foldworks-gap-base))",
      "@media (min-width: 768px)": "var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base)))",
      "@media (min-width: 1024px)": "var(--foldworks-gap-lg, var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base))))",
      "@media (min-width: 1280px)": "var(--foldworks-gap-xl, var(--foldworks-gap-lg, var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base)))))",
    },
  },
  gridContainer: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(var(--foldworks-columns-base), minmax(0, 1fr))",
      "@container (min-width: 640px)": "repeat(var(--foldworks-columns-sm, var(--foldworks-columns-base)), minmax(0, 1fr))",
      "@container (min-width: 768px)": "repeat(var(--foldworks-columns-md, var(--foldworks-columns-sm, var(--foldworks-columns-base))), minmax(0, 1fr))",
      "@container (min-width: 1024px)": "repeat(var(--foldworks-columns-lg, var(--foldworks-columns-md, var(--foldworks-columns-sm, var(--foldworks-columns-base)))), minmax(0, 1fr))",
      "@container (min-width: 1280px)": "repeat(var(--foldworks-columns-xl, var(--foldworks-columns-lg, var(--foldworks-columns-md, var(--foldworks-columns-sm, var(--foldworks-columns-base))))), minmax(0, 1fr))",
    },
    gap: {
      default: "var(--foldworks-gap-base)",
      "@container (min-width: 640px)": "var(--foldworks-gap-sm, var(--foldworks-gap-base))",
      "@container (min-width: 768px)": "var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base)))",
      "@container (min-width: 1024px)": "var(--foldworks-gap-lg, var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base))))",
      "@container (min-width: 1280px)": "var(--foldworks-gap-xl, var(--foldworks-gap-lg, var(--foldworks-gap-md, var(--foldworks-gap-sm, var(--foldworks-gap-base)))))",
    },
  },
  autoGrid: { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, var(--foldworks-column-min)), 1fr))" },
});

type Common<Message> = Readonly<{
  children: ReadonlyArray<Html | string>;
  attributes?: ReadonlyArray<Attribute<Message> | ChildAttribute>;
  style?: stylex.StyleXStyles;
}>;

const flex = <Message>(config: Common<Message> & Readonly<{
  direction: Responsive<"row" | "column">; gap?: Responsive<Gap>; align?: Align; justify?: Justify; wrap?: boolean; responsiveTo?: ResponsiveTo;
}>, h: HtmlBuilder<Message>): Html => h.div([
  ...(config.attributes ?? []), ...sxAttrs(h, config.responsiveTo === "container" ? styles.responsiveFlexContainer : styles.responsiveFlex, config.wrap === true && styles.wrap, config.style),
  h.Style({
    ...variables<"row" | "column">("direction", config.direction, "column", String), ...variables<Gap>("gap", config.gap, "md", (gap) => gapValues[gap]),
    alignItems: alignValues[config.align ?? "stretch"], justifyContent: justifyValues[config.justify ?? "start"],
  }),
], config.children);

export const stack = <Message>(config: Common<Message> & Readonly<{
  direction?: Responsive<"row" | "column">; gap?: Responsive<Gap>; align?: Align; justify?: Justify; wrap?: boolean; responsiveTo?: ResponsiveTo;
}>, h: HtmlBuilder<Message>): Html => flex({ ...config, direction: config.direction ?? "column" }, h);

export const row = <Message>(config: Common<Message> & Readonly<{
  direction?: Responsive<"row" | "column">; gap?: Responsive<Gap>; align?: Align; justify?: Justify; wrap?: boolean; responsiveTo?: ResponsiveTo;
}>, h: HtmlBuilder<Message>): Html => flex({ ...config, direction: config.direction ?? "row", align: config.align ?? "center" }, h);

export const container = <Message>(config: Common<Message> & Readonly<{
  size?: "sm" | "md" | "lg" | "xl" | "full"; padding?: Responsive<Gap>; query?: boolean;
}>, h: HtmlBuilder<Message>): Html => h.div([
  ...(config.attributes ?? []), ...sxAttrs(h, styles.container, config.query === true && styles.queryContainer, config.style),
  h.Style({ "--foldworks-container-width": contentWidths[config.size ?? "xl"], ...variables<Gap>("padding", config.padding, "lg", (gap) => gapValues[gap]) }),
], config.children);

export const grid = <Message>(config: Common<Message> & Readonly<{
  columns?: Responsive<number>; minColumnWidth?: string; gap?: Responsive<Gap>; align?: "start" | "center" | "end" | "stretch"; responsiveTo?: ResponsiveTo;
}>, h: HtmlBuilder<Message>): Html => {
  const columnValues = responsive(config.columns, 1);
  for (const count of Object.values(columnValues)) {
    if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error("Layout.grid columns must be integers from 1 through 12.");
  }
  return h.div([
    ...(config.attributes ?? []), ...sxAttrs(h, config.responsiveTo === "container" ? styles.gridContainer : styles.grid, config.minColumnWidth !== undefined && styles.autoGrid, config.style),
    h.Style({
      ...variables<number>("columns", config.columns, 1, String), ...variables<Gap>("gap", config.gap, "md", (gap) => gapValues[gap]),
      ...(config.minColumnWidth === undefined ? {} : { "--foldworks-column-min": config.minColumnWidth }), alignItems: config.align ?? "stretch",
    }),
  ], config.children);
};

export const Container = { view: container } as const;
export const Grid = { view: grid } as const;
export const Stack = { view: stack } as const;
export const Row = { view: row } as const;
