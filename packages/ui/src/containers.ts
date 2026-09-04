import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import { styledAttrs, type Children, type StyledConfig } from "./catalog.shared";
import { sxAttrs } from "./sx";

const scrollArea = <Message>(
  config: StyledConfig<Message> & Readonly<{
    children: Children;
    maxHeight?: string;
    ariaLabel?: string;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [
    ...styledAttrs(config, h, styles.scrollArea),
    ...(config.maxHeight === undefined ? [] : [h.Style({ maxHeight: config.maxHeight })]),
    ...(config.ariaLabel === undefined ? [] : [h.Role("region"), h.AriaLabel(config.ariaLabel), h.Tabindex(0)]),
  ],
  config.children,
);

const resizable = <Message>(
  config: StyledConfig<Message> & Readonly<{
    children: Children;
    ariaLabel?: string;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [
    ...styledAttrs(config, h, styles.surface, styles.resizable),
    ...(config.ariaLabel === undefined ? [] : [h.Role("region"), h.AriaLabel(config.ariaLabel)]),
  ],
  config.children,
);

const carousel = <Message>(
  config: StyledConfig<Message> & Readonly<{
    id: string;
    slides: ReadonlyArray<Readonly<{ label: string; content: Children }>>;
    ariaLabel?: string;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [
    ...styledAttrs(config, h, styles.carousel),
    h.Role("region"),
    h.AriaRoleDescription("carousel"),
    h.AriaLabel(config.ariaLabel ?? "Carousel"),
    h.Tabindex(0),
  ],
  config.slides.map((slide, index) => h.section([
    ...sxAttrs(h, styles.surface, styles.carouselItem),
    h.Id(`${config.id}-slide-${index + 1}`),
    h.Role("group"),
    h.AriaRoleDescription("slide"),
    h.AriaLabel(`${index + 1} of ${config.slides.length}: ${slide.label}`),
  ], slide.content)),
);

export const Carousel = { view: carousel } as const;
export const Resizable = { view: resizable } as const;
export const ScrollArea = { view: scrollArea } as const;
