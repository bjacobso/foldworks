import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import { styledAttrs, type Children, type StyledConfig } from "./catalog.shared";
import { sxAttrs } from "./sx";

const attachment = <Message>(
  config: StyledConfig<Message> & Readonly<{
    name: string;
    metadata?: string;
    media?: Html;
    action?: Html;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(styledAttrs(config, h, styles.inset, styles.attachment), [
  ...(config.media === undefined ? [] : [config.media]),
  h.div(sxAttrs(h, styles.itemContent), [
    h.div(sxAttrs(h, styles.title), [config.name]),
    ...(config.metadata === undefined ? [] : [h.div(sxAttrs(h, styles.description), [config.metadata])]),
  ]),
  ...(config.action === undefined ? [] : [config.action]),
]);

const bubble = <Message>(
  config: StyledConfig<Message> & Readonly<{ children: Children; isOwn?: boolean }>,
  h: HtmlBuilder<Message>,
): Html => h.div(styledAttrs(config, h, styles.bubble, config.isOwn === true && styles.bubbleOwn), config.children);

const marker = <Message>(
  config: StyledConfig<Message> & Readonly<{ children: Children }>,
  h: HtmlBuilder<Message>,
): Html => h.mark(styledAttrs(config, h, styles.marker), config.children);

const message = <Message>(
  config: StyledConfig<Message> & Readonly<{
    author: string;
    children: Children;
    avatar?: Html;
    isOwn?: boolean;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.article(
  [...styledAttrs(config, h, styles.message, config.isOwn === true && styles.messageOwn), h.AriaLabel(`${config.author} message`)],
  [
    ...(config.avatar === undefined ? [] : [config.avatar]),
    bubble({ children: config.children, ...(config.isOwn === undefined ? {} : { isOwn: config.isOwn }) }, h),
  ],
);

const messageScroller = <Message>(
  config: StyledConfig<Message> & Readonly<{ children: Children; ariaLabel?: string }>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [...styledAttrs(config, h, styles.messageScroller), h.Role("log"), h.AriaLive("polite"), h.AriaLabel(config.ariaLabel ?? "Messages"), h.Tabindex(0)],
  config.children,
);

export const Attachment = { view: attachment } as const;
export const Bubble = { view: bubble } as const;
export const Marker = { view: marker } as const;
export const Message = { view: message } as const;
export const MessageScroller = { view: messageScroller } as const;
