import type { LucideIconData, LucideIconNode } from "@lucide/icons";
import type { Attribute, Html, HtmlBuilder, TagName } from "foldkit/html";

export type { LucideIconData as IconData } from "@lucide/icons";

export type ViewConfig<Message> = Readonly<{
  icon: LucideIconData;
  size?: number;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
  label?: string;
  attributes?: ReadonlyArray<Attribute<Message>>;
}>;

const nodeView = <Message>(
  iconName: string,
  node: LucideIconNode,
  path: string,
  absoluteStrokeWidth: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const [tag, properties, children = []] = node;
  const key = properties.key ?? path;
  const attributes = Object.entries(properties)
    .filter(([name]) => name !== "key")
    .map(([name, value]) => h.Attribute(name, value));

  return h.keyed(tag as TagName)(
    `${iconName}-${key}`,
    [
      ...attributes,
      ...(absoluteStrokeWidth
        ? [h.Attribute("vector-effect", "non-scaling-stroke")]
        : []),
    ],
    children.map((child, index) =>
      nodeView(iconName, child, `${path}-${index}`, absoluteStrokeWidth, h),
    ),
  );
};

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const sourceWidth = "size" in config.icon ? config.icon.size : config.icon.width;
  const sourceHeight = "size" in config.icon ? config.icon.size : config.icon.height;
  const size = config.size ?? 16;
  const label = config.label;

  return h.svg(
    [
      h.Style({ display: "block", "flex-shrink": "0" }),
      h.Attribute("xmlns", "http://www.w3.org/2000/svg"),
      h.ViewBox(`0 0 ${sourceWidth} ${sourceHeight}`),
      h.Width(`${size}`),
      h.Height(`${size}`),
      h.Attribute("fill", "none"),
      h.Attribute("stroke", "currentColor"),
      h.Attribute("stroke-width", `${config.strokeWidth ?? 2}`),
      h.Attribute("stroke-linecap", "round"),
      h.Attribute("stroke-linejoin", "round"),
      h.Attribute("focusable", "false"),
      h.DataAttribute("lucide-icon", config.icon.name),
      ...(label === undefined
        ? [h.AriaHidden(true)]
        : [h.Role("img"), h.AriaLabel(label)]),
      ...(config.attributes ?? []),
    ],
    config.icon.node.map((node, index) =>
      nodeView(
        config.icon.name,
        node,
        `${index}`,
        config.absoluteStrokeWidth ?? false,
        h,
      ),
    ),
  );
};
