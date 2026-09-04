import type { Html, HtmlBuilder } from "foldkit/html";

import type { Children, StyledConfig } from "./catalog.shared";
import { styledAttrs } from "./catalog.shared";

const view = <Message>(
  config: StyledConfig<Message> & Readonly<{ direction: "ltr" | "rtl" | "auto"; children: Children }>,
  h: HtmlBuilder<Message>,
): Html => h.div([...styledAttrs(config, h), h.Dir(config.direction)], config.children);

export const Direction = { view } as const;
