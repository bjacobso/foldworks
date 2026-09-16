import type { Html, HtmlBuilder } from "foldkit/html";

import { styledAttrs, type Children, type StyledConfig } from "./catalog.shared";
import { contentStyles as styles } from "./primitive.styles";

export type TextSize = "xs" | "sm" | "md" | "lg" | "xl";
export type TextTone = "default" | "muted" | "success" | "warning" | "danger";
export type TextWeight = "regular" | "medium" | "semibold" | "bold";

const textSize = (size: TextSize) => ({
  xs: styles.textXs,
  sm: styles.textSm,
  md: styles.textMd,
  lg: styles.textLg,
  xl: styles.textXl,
})[size];

const textTone = (tone: TextTone) => ({
  default: styles.toneDefault,
  muted: styles.toneMuted,
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
})[tone];

const textWeight = (weight: TextWeight) => ({
  regular: styles.weightRegular,
  medium: styles.weightMedium,
  semibold: styles.weightSemibold,
  bold: styles.weightBold,
})[weight];

type TextConfig<Message> = StyledConfig<Message> & Readonly<{
  children: Children;
  as?: "p" | "span" | "div";
  size?: TextSize;
  tone?: TextTone;
  weight?: TextWeight;
  align?: "start" | "center" | "end";
  truncate?: boolean;
}>;

const text = <Message>(config: TextConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const attributes = styledAttrs(config, h, styles.text, textSize(config.size ?? "md"),
    textTone(config.tone ?? "default"), textWeight(config.weight ?? "regular"),
    config.align === "center" && styles.alignCenter, config.align === "end" && styles.alignEnd,
    config.truncate === true && styles.truncate);
  switch (config.as ?? "p") {
    case "span": return h.span(attributes, config.children);
    case "div": return h.div(attributes, config.children);
    case "p": return h.p(attributes, config.children);
  }
};

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingConfig<Message> = StyledConfig<Message> & Readonly<{
  children: Children;
  level?: HeadingLevel;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: TextTone;
}>;

const heading = <Message>(config: HeadingConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const size = config.size ?? ({ 1: "xl", 2: "lg", 3: "md", 4: "sm", 5: "sm", 6: "sm" } as const)[config.level ?? 2];
  const attributes = styledAttrs(config, h, styles.heading, textTone(config.tone ?? "default"), {
    sm: styles.headingSm, md: styles.headingMd, lg: styles.headingLg, xl: styles.headingXl,
  }[size]);
  switch (config.level ?? 2) {
    case 1: return h.h1(attributes, config.children);
    case 2: return h.h2(attributes, config.children);
    case 3: return h.h3(attributes, config.children);
    case 4: return h.h4(attributes, config.children);
    case 5: return h.h5(attributes, config.children);
    case 6: return h.h6(attributes, config.children);
  }
};

type LinkConfig<Message> = StyledConfig<Message> & Readonly<{
  href: string;
  children: Children;
  target?: string;
  rel?: string;
  current?: "page" | "step" | "location" | "date" | "time";
  external?: boolean;
}>;

const link = <Message>(config: LinkConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const target = config.target ?? (config.external === true ? "_blank" : undefined);
  const rel = config.rel ?? (target === "_blank" ? "noreferrer noopener" : undefined);
  return h.a([
    ...styledAttrs(config, h, styles.link), h.Href(config.href),
    ...(target === undefined ? [] : [h.Target(target)]),
    ...(rel === undefined ? [] : [h.Rel(rel)]),
    ...(config.current === undefined ? [] : [h.AriaCurrent(config.current)]),
  ], config.children);
};

const visuallyHidden = <Message>(
  config: StyledConfig<Message> & Readonly<{ children: Children; focusable?: boolean }>,
  h: HtmlBuilder<Message>,
): Html => h.span([
  ...styledAttrs(config, h, config.focusable === true ? styles.visuallyHiddenFocusable : styles.visuallyHidden),
  ...(config.focusable === true ? [h.Tabindex(0)] : []),
], config.children);

export const Text = { view: text } as const;
export const Heading = { view: heading } as const;
export const Link = { view: link } as const;
export const VisuallyHidden = { view: visuallyHidden } as const;
