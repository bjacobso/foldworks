import * as stylex from "@stylexjs/stylex";
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from "foldkit/html";

import {
  rootAttrs,
  type Children,
  type SlotProps,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import type { Gap, ResponsiveTo } from "./layout";
import { sxAttrs } from "./sx";
import { colors, space } from "./tokens.stylex.js";

export type Slot = "root" | "pane";
export type CollapseBelow = "sm" | "md" | "lg" | "xl" | "never";
export type Height = "auto" | "fill";

export type Pane<Message> = SlotProps<Message> &
  Readonly<{
    /** Stable identity for keyed rendering and `collapsedPane`. */
    key?: string;
    /** Accessible region name. Labeled scrolling panes are keyboard focusable. */
    label?: string;
    children: Children;
    /**
     * Column track while split, such as `"320px"`, `"minmax(280px, 1fr)"`, or `"2fr"`.
     * Defaults to `"minmax(0, 1fr)"`. For a resizable pane this is its initial CSS length.
     */
    width?: string;
    /** Stick below `stickyOffset` and scroll independently while split. Applies to `height: "auto"`. */
    sticky?: boolean;
    /** Let people resize the pane natively while split. Constrain it with CSS lengths. */
    resizable?: boolean | Readonly<{ minWidth?: string; maxWidth?: string }>;
  }>;

export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    /** Two or three panes, in reading order. */
    panes: ReadonlyArray<Pane<Message>>;
    /** Stack panes in one column below this breakpoint. Defaults to `"md"`. */
    collapseBelow?: CollapseBelow;
    /** Measure the breakpoint against the viewport (default) or the nearest query container. */
    responsiveTo?: ResponsiveTo;
    /** `"auto"` flows with the page; `"fill"` fills a bounded parent and each pane scrolls itself. */
    height?: Height;
    /** Distance from the top of the scrolling ancestor for sticky panes, such as an app header height. */
    stickyOffset?: string;
    gap?: Gap;
    /** Below the breakpoint, show only the pane with this key. Other panes stay mounted but hidden. */
    collapsedPane?: string;
    ariaLabel?: string;
  }>;

const gapValues: Readonly<Record<Gap, string>> = {
  none: "0px",
  xs: space.xs,
  sm: space.sm,
  md: space.md,
  lg: space.lg,
  xl: space.xl,
};

// Only the root responds to the breakpoint. It publishes the split state to its own panes
// through custom properties, so one media or container query drives every pane.
const collapsed = {
  "--foldworks-split-position": "static",
  "--foldworks-split-max-height": "none",
  "--foldworks-split-overflow": "visible",
  "--foldworks-split-resize": "none",
  "--foldworks-split-fill": "100%",
  "--foldworks-split-offstage": "none",
} as const;

const split = {
  gridTemplateColumns: "var(--foldworks-split-columns)",
  gridTemplateRows: "var(--foldworks-split-rows)",
  "--foldworks-split-position": "sticky",
  "--foldworks-split-max-height": "calc(100dvh - var(--foldworks-split-offset))",
  "--foldworks-split-overflow": "auto",
  "--foldworks-split-resize": "horizontal",
  "--foldworks-split-fill": "0px",
  "--foldworks-split-offstage": "block",
} as const;

const styles = stylex.create({
  root: {
    alignItems: "stretch",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    minHeight: 0,
    minWidth: 0,
    // Reset inherited split state so nested split views start from their own defaults.
    "--foldworks-split-offset": "0px",
    "--foldworks-split-rows": "none",
    ...collapsed,
  },
  always: split,
  viewportSm: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@media (min-width: 640px)": split.gridTemplateColumns,
    },
    gridTemplateRows: { default: "none", "@media (min-width: 640px)": split.gridTemplateRows },
    "--foldworks-split-position": {
      default: collapsed["--foldworks-split-position"],
      "@media (min-width: 640px)": split["--foldworks-split-position"],
    },
    "--foldworks-split-max-height": {
      default: collapsed["--foldworks-split-max-height"],
      "@media (min-width: 640px)": split["--foldworks-split-max-height"],
    },
    "--foldworks-split-overflow": {
      default: collapsed["--foldworks-split-overflow"],
      "@media (min-width: 640px)": split["--foldworks-split-overflow"],
    },
    "--foldworks-split-resize": {
      default: collapsed["--foldworks-split-resize"],
      "@media (min-width: 640px)": split["--foldworks-split-resize"],
    },
    "--foldworks-split-fill": {
      default: collapsed["--foldworks-split-fill"],
      "@media (min-width: 640px)": split["--foldworks-split-fill"],
    },
    "--foldworks-split-offstage": {
      default: collapsed["--foldworks-split-offstage"],
      "@media (min-width: 640px)": split["--foldworks-split-offstage"],
    },
  },
  viewportMd: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@media (min-width: 768px)": split.gridTemplateColumns,
    },
    gridTemplateRows: { default: "none", "@media (min-width: 768px)": split.gridTemplateRows },
    "--foldworks-split-position": {
      default: collapsed["--foldworks-split-position"],
      "@media (min-width: 768px)": split["--foldworks-split-position"],
    },
    "--foldworks-split-max-height": {
      default: collapsed["--foldworks-split-max-height"],
      "@media (min-width: 768px)": split["--foldworks-split-max-height"],
    },
    "--foldworks-split-overflow": {
      default: collapsed["--foldworks-split-overflow"],
      "@media (min-width: 768px)": split["--foldworks-split-overflow"],
    },
    "--foldworks-split-resize": {
      default: collapsed["--foldworks-split-resize"],
      "@media (min-width: 768px)": split["--foldworks-split-resize"],
    },
    "--foldworks-split-fill": {
      default: collapsed["--foldworks-split-fill"],
      "@media (min-width: 768px)": split["--foldworks-split-fill"],
    },
    "--foldworks-split-offstage": {
      default: collapsed["--foldworks-split-offstage"],
      "@media (min-width: 768px)": split["--foldworks-split-offstage"],
    },
  },
  viewportLg: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@media (min-width: 1024px)": split.gridTemplateColumns,
    },
    gridTemplateRows: { default: "none", "@media (min-width: 1024px)": split.gridTemplateRows },
    "--foldworks-split-position": {
      default: collapsed["--foldworks-split-position"],
      "@media (min-width: 1024px)": split["--foldworks-split-position"],
    },
    "--foldworks-split-max-height": {
      default: collapsed["--foldworks-split-max-height"],
      "@media (min-width: 1024px)": split["--foldworks-split-max-height"],
    },
    "--foldworks-split-overflow": {
      default: collapsed["--foldworks-split-overflow"],
      "@media (min-width: 1024px)": split["--foldworks-split-overflow"],
    },
    "--foldworks-split-resize": {
      default: collapsed["--foldworks-split-resize"],
      "@media (min-width: 1024px)": split["--foldworks-split-resize"],
    },
    "--foldworks-split-fill": {
      default: collapsed["--foldworks-split-fill"],
      "@media (min-width: 1024px)": split["--foldworks-split-fill"],
    },
    "--foldworks-split-offstage": {
      default: collapsed["--foldworks-split-offstage"],
      "@media (min-width: 1024px)": split["--foldworks-split-offstage"],
    },
  },
  viewportXl: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@media (min-width: 1280px)": split.gridTemplateColumns,
    },
    gridTemplateRows: { default: "none", "@media (min-width: 1280px)": split.gridTemplateRows },
    "--foldworks-split-position": {
      default: collapsed["--foldworks-split-position"],
      "@media (min-width: 1280px)": split["--foldworks-split-position"],
    },
    "--foldworks-split-max-height": {
      default: collapsed["--foldworks-split-max-height"],
      "@media (min-width: 1280px)": split["--foldworks-split-max-height"],
    },
    "--foldworks-split-overflow": {
      default: collapsed["--foldworks-split-overflow"],
      "@media (min-width: 1280px)": split["--foldworks-split-overflow"],
    },
    "--foldworks-split-resize": {
      default: collapsed["--foldworks-split-resize"],
      "@media (min-width: 1280px)": split["--foldworks-split-resize"],
    },
    "--foldworks-split-fill": {
      default: collapsed["--foldworks-split-fill"],
      "@media (min-width: 1280px)": split["--foldworks-split-fill"],
    },
    "--foldworks-split-offstage": {
      default: collapsed["--foldworks-split-offstage"],
      "@media (min-width: 1280px)": split["--foldworks-split-offstage"],
    },
  },
  containerSm: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@container (min-width: 640px)": split.gridTemplateColumns,
    },
    gridTemplateRows: { default: "none", "@container (min-width: 640px)": split.gridTemplateRows },
    "--foldworks-split-position": {
      default: collapsed["--foldworks-split-position"],
      "@container (min-width: 640px)": split["--foldworks-split-position"],
    },
    "--foldworks-split-max-height": {
      default: collapsed["--foldworks-split-max-height"],
      "@container (min-width: 640px)": split["--foldworks-split-max-height"],
    },
    "--foldworks-split-overflow": {
      default: collapsed["--foldworks-split-overflow"],
      "@container (min-width: 640px)": split["--foldworks-split-overflow"],
    },
    "--foldworks-split-resize": {
      default: collapsed["--foldworks-split-resize"],
      "@container (min-width: 640px)": split["--foldworks-split-resize"],
    },
    "--foldworks-split-fill": {
      default: collapsed["--foldworks-split-fill"],
      "@container (min-width: 640px)": split["--foldworks-split-fill"],
    },
    "--foldworks-split-offstage": {
      default: collapsed["--foldworks-split-offstage"],
      "@container (min-width: 640px)": split["--foldworks-split-offstage"],
    },
  },
  containerMd: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@container (min-width: 768px)": split.gridTemplateColumns,
    },
    gridTemplateRows: { default: "none", "@container (min-width: 768px)": split.gridTemplateRows },
    "--foldworks-split-position": {
      default: collapsed["--foldworks-split-position"],
      "@container (min-width: 768px)": split["--foldworks-split-position"],
    },
    "--foldworks-split-max-height": {
      default: collapsed["--foldworks-split-max-height"],
      "@container (min-width: 768px)": split["--foldworks-split-max-height"],
    },
    "--foldworks-split-overflow": {
      default: collapsed["--foldworks-split-overflow"],
      "@container (min-width: 768px)": split["--foldworks-split-overflow"],
    },
    "--foldworks-split-resize": {
      default: collapsed["--foldworks-split-resize"],
      "@container (min-width: 768px)": split["--foldworks-split-resize"],
    },
    "--foldworks-split-fill": {
      default: collapsed["--foldworks-split-fill"],
      "@container (min-width: 768px)": split["--foldworks-split-fill"],
    },
    "--foldworks-split-offstage": {
      default: collapsed["--foldworks-split-offstage"],
      "@container (min-width: 768px)": split["--foldworks-split-offstage"],
    },
  },
  containerLg: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@container (min-width: 1024px)": split.gridTemplateColumns,
    },
    gridTemplateRows: { default: "none", "@container (min-width: 1024px)": split.gridTemplateRows },
    "--foldworks-split-position": {
      default: collapsed["--foldworks-split-position"],
      "@container (min-width: 1024px)": split["--foldworks-split-position"],
    },
    "--foldworks-split-max-height": {
      default: collapsed["--foldworks-split-max-height"],
      "@container (min-width: 1024px)": split["--foldworks-split-max-height"],
    },
    "--foldworks-split-overflow": {
      default: collapsed["--foldworks-split-overflow"],
      "@container (min-width: 1024px)": split["--foldworks-split-overflow"],
    },
    "--foldworks-split-resize": {
      default: collapsed["--foldworks-split-resize"],
      "@container (min-width: 1024px)": split["--foldworks-split-resize"],
    },
    "--foldworks-split-fill": {
      default: collapsed["--foldworks-split-fill"],
      "@container (min-width: 1024px)": split["--foldworks-split-fill"],
    },
    "--foldworks-split-offstage": {
      default: collapsed["--foldworks-split-offstage"],
      "@container (min-width: 1024px)": split["--foldworks-split-offstage"],
    },
  },
  containerXl: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@container (min-width: 1280px)": split.gridTemplateColumns,
    },
    gridTemplateRows: { default: "none", "@container (min-width: 1280px)": split.gridTemplateRows },
    "--foldworks-split-position": {
      default: collapsed["--foldworks-split-position"],
      "@container (min-width: 1280px)": split["--foldworks-split-position"],
    },
    "--foldworks-split-max-height": {
      default: collapsed["--foldworks-split-max-height"],
      "@container (min-width: 1280px)": split["--foldworks-split-max-height"],
    },
    "--foldworks-split-overflow": {
      default: collapsed["--foldworks-split-overflow"],
      "@container (min-width: 1280px)": split["--foldworks-split-overflow"],
    },
    "--foldworks-split-resize": {
      default: collapsed["--foldworks-split-resize"],
      "@container (min-width: 1280px)": split["--foldworks-split-resize"],
    },
    "--foldworks-split-fill": {
      default: collapsed["--foldworks-split-fill"],
      "@container (min-width: 1280px)": split["--foldworks-split-fill"],
    },
    "--foldworks-split-offstage": {
      default: collapsed["--foldworks-split-offstage"],
      "@container (min-width: 1280px)": split["--foldworks-split-offstage"],
    },
  },
  // Stacked fill layouts scroll as one region; split fill layouts give each pane a bounded row.
  fill: {
    height: "100%",
    overflow: "auto",
    overscrollBehavior: "contain",
    "--foldworks-split-rows": "minmax(0, 1fr)",
  },
  pane: { minHeight: 0, minWidth: 0 },
  scrolls: {
    overflow: "var(--foldworks-split-overflow)",
    overscrollBehavior: "contain",
    scrollbarColor: `${colors.borderStrong} transparent`,
    scrollbarWidth: "thin",
  },
  sticky: {
    alignSelf: "start",
    maxHeight: "var(--foldworks-split-max-height)",
    position: "var(--foldworks-split-position)",
    top: "var(--foldworks-split-offset)",
  },
  // A native resize writes an inline width. The fill floor keeps a stacked pane full width anyway.
  resizable: {
    maxWidth: "max(var(--foldworks-split-pane-max), var(--foldworks-split-fill))",
    minWidth: "max(var(--foldworks-split-pane-min), var(--foldworks-split-fill))",
    resize: "var(--foldworks-split-resize)",
    width: "max(var(--foldworks-split-pane-width), var(--foldworks-split-fill))",
  },
  offstage: { display: "var(--foldworks-split-offstage)" },
});

const breakpointStyles = {
  viewport: {
    sm: styles.viewportSm,
    md: styles.viewportMd,
    lg: styles.viewportLg,
    xl: styles.viewportXl,
  },
  container: {
    sm: styles.containerSm,
    md: styles.containerMd,
    lg: styles.containerLg,
    xl: styles.containerXl,
  },
} as const;

const defaultTrack = "minmax(0, 1fr)";
const defaultResizableWidth = "320px";

/** The split grid template: resizable panes size their own `auto` track. */
export const columnTemplate = <Message>(panes: ReadonlyArray<Pane<Message>>): string =>
  panes.map((pane) => (isResizable(pane) ? "auto" : (pane.width ?? defaultTrack))).join(" ");

const isResizable = <Message>(pane: Pane<Message>): boolean =>
  pane.resizable !== undefined && pane.resizable !== false;

const validate = <Message>(config: ViewConfig<Message>): void => {
  if (config.panes.length < 2 || config.panes.length > 3) {
    throw new Error("SplitView requires two or three panes.");
  }
  const keys = config.panes.flatMap((pane) => (pane.key === undefined ? [] : [pane.key]));
  if (new Set(keys).size !== keys.length) throw new Error("SplitView pane keys must be unique.");
  if (config.collapsedPane !== undefined && !keys.includes(config.collapsedPane)) {
    throw new Error("SplitView collapsedPane must match a pane key.");
  }
};

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  validate(config);
  const collapseBelow = config.collapseBelow ?? "md";
  const fill = config.height === "fill";
  const pane = (value: Pane<Message>, index: number): Html => {
    const resizable = isResizable(value);
    const scrolls = fill || value.sticky === true || resizable;
    const limits = typeof value.resizable === "object" ? value.resizable : {};
    const tag = value.label === undefined ? "div" : "section";
    // Foldkit keeps one class attribute per element, so the shared slot and the pane merge here.
    // Offstage hiding is applied last: it owns `display` for panes that are hidden when stacked.
    const attributes: ReadonlyArray<Attribute<Message> | ChildAttribute> = [
      ...(config.slotProps?.pane?.attributes ?? []),
      ...(value.attributes ?? []),
      ...sxAttrs(
        h,
        styles.pane,
        scrolls && styles.scrolls,
        !fill && value.sticky === true && styles.sticky,
        resizable && styles.resizable,
        config.slotProps?.pane?.sx,
        value.sx,
        config.collapsedPane !== undefined && value.key !== config.collapsedPane && styles.offstage,
      ),
      h.DataAttribute("split-pane", value.key ?? String(index + 1)),
      ...(value.label === undefined
        ? []
        : [h.AriaLabel(value.label), ...(scrolls ? [h.Tabindex(0)] : [])]),
      ...(resizable
        ? [
            h.Style({
              "--foldworks-split-pane-width": value.width ?? defaultResizableWidth,
              "--foldworks-split-pane-min": limits.minWidth ?? "0px",
              "--foldworks-split-pane-max": limits.maxWidth ?? "100%",
            }),
          ]
        : []),
    ];
    if (value.key !== undefined) return h.keyed(tag)(value.key, attributes, value.children);
    return tag === "section"
      ? h.section(attributes, value.children)
      : h.div(attributes, value.children);
  };
  return h.div(
    [
      ...rootAttrs(
        config,
        h,
        styles.root,
        collapseBelow === "never"
          ? styles.always
          : breakpointStyles[config.responsiveTo ?? "viewport"][collapseBelow],
        fill && styles.fill,
      ),
      h.DataAttribute("split-view", String(config.panes.length)),
      ...(config.ariaLabel === undefined ? [] : [h.Role("group"), h.AriaLabel(config.ariaLabel)]),
      h.Style({
        "--foldworks-split-columns": columnTemplate(config.panes),
        columnGap: gapValues[config.gap ?? "lg"],
        rowGap: gapValues[config.gap ?? "lg"],
        ...(config.stickyOffset === undefined
          ? {}
          : { "--foldworks-split-offset": config.stickyOffset }),
      }),
    ],
    config.panes.map(pane),
  );
};
