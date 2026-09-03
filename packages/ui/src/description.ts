import type { Attribute, Html, HtmlBuilder } from "foldkit/html";

export const view = <Message>(
  description: string | undefined,
  attributes: ReadonlyArray<Attribute<Message>>,
  visibleAttributes: ReadonlyArray<Attribute<Message>>,
  h: HtmlBuilder<Message>,
): Html => description === undefined
  ? h.span([
      ...attributes,
      h.Style({
        clip: "rect(0 0 0 0)",
        clipPath: "inset(50%)",
        height: "1px",
        overflow: "hidden",
        position: "absolute",
        whiteSpace: "nowrap",
        width: "1px",
      }),
    ], [])
  : h.p([...attributes, ...visibleAttributes], [description]);
