import { Mount } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import * as Measurement from "./measurement";
import { sxAttrs } from "./sx";
import { desktopStyles as styles } from "./desktop.styles";
export const Model = Measurement.Model;
export type Model = Measurement.Model;
export const Message = Measurement.Message;
export type Message = Measurement.Message;
export const init = Measurement.init;
export const update = Measurement.update;
export type Item = Readonly<{ id: string }>;
export type Policy = Readonly<{
  direction?: "start" | "end";
  minVisible?: number;
  gap?: number;
}>;
/** Missing measurements show all items. Minimum visibility wins over fitting. */
export const partition = <T extends Item>(
  items: ReadonlyArray<T>,
  widths: Readonly<Record<string, number>>,
  available: number | undefined,
  triggerWidth: number | undefined,
  policy: Policy = {},
) => {
  const ids = new Set(items.map((item) => item.id));
  if (
    ids.size !== items.length ||
    items.some((item) => !item.id || item.id.startsWith("$"))
  )
    throw new Error(
      "Overflow IDs must be unique, nonempty, and not start with $. ",
    );
  if (
    [
      available,
      triggerWidth,
      policy.gap,
      policy.minVisible,
      ...Object.values(widths),
    ].some(
      (value) => value !== undefined && (!Number.isFinite(value) || value < 0),
    )
  )
    throw new Error(
      "Overflow sizes and limits must be finite and nonnegative.",
    );
  const gap = Math.max(0, policy.gap ?? 8);
  let visible = [...items];
  const overflow: T[] = [];
  if (
    available === undefined ||
    triggerWidth === undefined ||
    items.some((item) => widths[item.id] === undefined)
  )
    return { visible, overflow };
  const size = () =>
    visible.reduce((sum, item) => sum + Math.max(0, widths[item.id]!), 0) +
    gap * Math.max(0, visible.length - 1) +
    (overflow.length ? triggerWidth + (visible.length ? gap : 0) : 0);
  const minimum = Math.max(
    0,
    Math.min(items.length, Math.floor(policy.minVisible ?? 0)),
  );
  while (visible.length > minimum && size() > available) {
    if (policy.direction === "start") overflow.push(visible.shift()!);
    else overflow.unshift(visible.pop()!);
  }
  return { visible, overflow };
};
export const view = <Message, T extends Item>(
  config: Policy &
    Readonly<{
      model: Model;
      items: ReadonlyArray<T>;
      label: string;
      toParentMessage: (message: Measurement.Message) => Message;
      renderItem: (item: T) => Html;
      measureItem: (item: T) => Html;
      measureOverflow?: Html;
      renderOverflow?: (items: ReadonlyArray<T>) => Html;
    }>,
  h: HtmlBuilder<Message>,
): Html => {
  const widths = Object.fromEntries(
    Object.entries(config.model).map(([key, box]) => [key, box.width]),
  );
  const { visible, overflow } = partition(
    config.items,
    widths,
    widths.$root,
    widths.$trigger,
    config,
  );
  const trigger = h.details(
    [],
    [
      h.summary(sxAttrs(h, styles.button), ["More"]),
      h.ul(
        sxAttrs(h, styles.menu),
        overflow.map((item) => h.li([], [config.renderItem(item)])),
      ),
    ],
  );
  const more = overflow.length
    ? [config.renderOverflow?.(overflow) ?? trigger]
    : [];
  return h.div(
    [
      ...sxAttrs(h, styles.overflow),
      h.OnMount(
        Mount.mapMessage(Measurement.Observe(), config.toParentMessage),
      ),
    ],
    [
      h.div(
        [
          ...sxAttrs(h, styles.scroller),
          h.Style({ gap: `${config.gap ?? 8}px` }),
          h.Role("group"),
          h.AriaLabel(config.label),
        ],
        [
          ...(config.direction === "start" ? more : []),
          ...visible.map((item) =>
            h.div(
              [h.Key(item.id), ...sxAttrs(h, styles.item)],
              [config.renderItem(item)],
            ),
          ),
          ...(config.direction === "start" ? [] : more),
        ],
      ),
      h.div(
        [
          ...sxAttrs(h, styles.probes),
          h.AriaHidden(true),
          h.Attribute("inert", ""),
        ],
        [
          ...config.items.map((item) =>
            h.div(
              [
                h.Key(item.id),
                h.DataAttribute("measure", item.id),
                ...sxAttrs(h, styles.item),
              ],
              [config.measureItem(item)],
            ),
          ),
          h.div(
            [
              h.DataAttribute("measure", "$trigger"),
              ...sxAttrs(h, styles.item),
            ],
            [
              config.measureOverflow ??
                h.details([], [h.summary(sxAttrs(h, styles.button), ["More"])]),
            ],
          ),
        ],
      ),
    ],
  );
};
