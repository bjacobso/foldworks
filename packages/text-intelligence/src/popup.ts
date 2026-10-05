import { Effect, Schema as S, Stream } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { MountAction } from "foldkit/mount";

import { rectAtOffset } from "./geometry";
import { SEVERITIES, type CompletionItem, type Diagnostic } from "./vocabulary";

/**
 * Where a popup points: an offset in the text painted under the element that
 * `selector` finds. The offset is relative to that element's text.
 */
export const Anchor = S.Struct({ selector: S.String, offset: S.Number });
export type Anchor = typeof Anchor.Type;

/** Content a host shows for a range of text, built with the host's own `h`. */
export type Hover = Readonly<{ from: number; to: number; content: Html | null }>;

const GAP = 4;

/** The part of the viewport an element can show in, inside every ancestor that clips. */
const visibleBounds = (
  element: HTMLElement,
): Readonly<{ top: number; bottom: number; left: number; right: number }> => {
  const view = element.ownerDocument.defaultView;
  let top = 0;
  let left = 0;
  let bottom = view?.innerHeight ?? Infinity;
  let right = view?.innerWidth ?? Infinity;
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    const style = view?.getComputedStyle(node);
    if (style === undefined || `${style.overflowX}${style.overflowY}` === "visiblevisible")
      continue;
    const rect = node.getBoundingClientRect();
    top = Math.max(top, rect.top);
    left = Math.max(left, rect.left);
    bottom = Math.min(bottom, rect.bottom);
    right = Math.min(right, rect.right);
  }
  return { top, bottom, left, right };
};

/**
 * Positions a popup under its anchor, or above it when there is no room
 * below, and keeps it there as the page scrolls or the popup resizes. The
 * popup's offset parent is the coordinate space. A completion popup also keeps
 * focus in the text: pressing on it never moves focus, so the caret stays put.
 */
const anchorPopup = (
  args: Readonly<{ selector: string; offset: number; keepFocus: boolean }>,
): MountAction<never> => ({
  name: "AnchorTextPopup",
  args,
  f: (element) =>
    Stream.callback<never>(() =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const { selector, offset, keepFocus } = args;
          const popup = element as HTMLElement;
          const doc = popup.ownerDocument;
          const view = doc.defaultView;
          let pending = 0;
          const place = () => {
            const root = doc.querySelector(selector);
            const parent = popup.offsetParent ?? doc.body;
            const at = root === null ? undefined : rectAtOffset(root, offset);
            if (at === undefined) return;
            const bounds = visibleBounds(popup);
            const frame = parent.getBoundingClientRect();
            const height = popup.offsetHeight;
            const width = popup.offsetWidth;
            const below = at.bottom + GAP;
            const flip = below + height > bounds.bottom && at.top - GAP - height >= bounds.top;
            const top = flip ? at.top - GAP - height : below;
            const left = Math.max(bounds.left + 4, Math.min(at.left, bounds.right - width - 4));
            popup.style.left = `${left - frame.left - parent.clientLeft + parent.scrollLeft}px`;
            popup.style.top = `${top - frame.top - parent.clientTop + parent.scrollTop}px`;
            popup.dataset.placement = flip ? "Above" : "Below";
            const active = popup.querySelector<HTMLElement>('[aria-selected="true"]');
            active?.scrollIntoView({ block: "nearest" });
          };
          const schedule = () => {
            cancelAnimationFrame(pending);
            pending = requestAnimationFrame(place);
          };
          const press = (event: Event) => {
            if (keepFocus) event.preventDefault();
          };
          place();
          const resize = new ResizeObserver(schedule);
          resize.observe(popup);
          const mutations = new MutationObserver(schedule);
          mutations.observe(popup, {
            subtree: true,
            attributes: true,
            attributeFilter: ["aria-selected"],
          });
          doc.addEventListener("scroll", schedule, { capture: true, passive: true });
          view?.addEventListener("resize", schedule);
          popup.addEventListener("pointerdown", press);
          popup.addEventListener("mousedown", press);
          return () => {
            cancelAnimationFrame(pending);
            resize.disconnect();
            mutations.disconnect();
            doc.removeEventListener("scroll", schedule, { capture: true });
            view?.removeEventListener("resize", schedule);
            popup.removeEventListener("pointerdown", press);
            popup.removeEventListener("mousedown", press);
          };
        }),
        (dispose) => Effect.sync(dispose),
      ).pipe(Effect.andThen(Effect.never)),
    ),
});

/** The element id of a completion option, for `aria-activedescendant`. */
export const optionId = (listId: string, index: number): string => `${listId}-option-${index}`;

/** Splits a label around the first match of the typed text, for emphasis. */
const emphasize = <Message>(
  label: string,
  query: string,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html | string> => {
  const at = query === "" ? -1 : label.toLowerCase().indexOf(query.toLowerCase());
  return at < 0
    ? [label]
    : [
        label.slice(0, at),
        h.mark([h.Class("fw-completion__match")], [label.slice(at, at + query.length)]),
        label.slice(at + query.length),
      ];
};

export type CompletionPopupConfig<Message> = Readonly<{
  /** The listbox id; options are `optionId(id, index)`. */
  id: string;
  /** The items to show, already narrowed by what was typed. */
  items: ReadonlyArray<CompletionItem>;
  index: number;
  anchor: Anchor;
  /** The typed text, emphasized in each label. */
  query?: string;
  /** Accessible name. Defaults to "Suggestions". */
  label?: string;
  onChoose: (index: number) => Message;
}>;

/**
 * A completion list anchored in text. The surface that owns the text keeps
 * focus, handles the keys, and points `aria-activedescendant` at the active
 * option.
 */
export const CompletionPopup = {
  view: <Message>(config: CompletionPopupConfig<Message>, h: HtmlBuilder<Message>): Html =>
    h.keyed("div")(
      `${config.id}:${config.anchor.selector}:${config.anchor.offset}`,
      [
        h.Class("fw-text-popup fw-completion"),
        h.DataAttribute("text-popup", "completion"),
        h.OnMount(anchorPopup({ ...config.anchor, keepFocus: true })),
      ],
      [
        h.ul(
          [h.Id(config.id), h.Role("listbox"), h.AriaLabel(config.label ?? "Suggestions")],
          config.items.map((item, index) =>
            h.li(
              [
                h.Id(optionId(config.id, index)),
                h.Class("fw-completion__option"),
                h.Role("option"),
                h.AriaSelected(index === config.index),
                ...(item.kind === undefined ? [] : [h.DataAttribute("kind", item.kind)]),
                h.OnClick(config.onChoose(index)),
              ],
              [
                h.span([h.Class("fw-completion__kind"), h.AriaHidden(true)], []),
                h.span(
                  [h.Class("fw-completion__label")],
                  emphasize(item.label, config.query ?? "", h),
                ),
                ...(item.detail === undefined
                  ? []
                  : [h.span([h.Class("fw-completion__detail")], [item.detail])]),
              ],
            ),
          ),
        ),
      ],
    ),
};

export type HoverPopupConfig = Readonly<{
  /** Referenced by the text's `aria-describedby` while the popup shows. */
  id: string;
  anchor: Anchor;
  /** Problems at the hovered offset, shown first. */
  diagnostics?: ReadonlyArray<Diagnostic>;
  content: Html | null;
}>;

const severityLabel: Readonly<Record<Diagnostic["severity"], string>> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
  hint: "Hint",
};

/** Information about a range of text: its problems, then the host's content. */
export const HoverPopup = {
  view: <Message>(config: HoverPopupConfig, h: HtmlBuilder<Message>): Html => {
    const diagnostics = [...(config.diagnostics ?? [])].sort(
      (a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity),
    );
    return h.keyed("div")(
      `${config.id}:${config.anchor.selector}:${config.anchor.offset}`,
      [
        h.Id(config.id),
        h.Class("fw-text-popup fw-hover"),
        h.Role("tooltip"),
        h.DataAttribute("text-popup", "hover"),
        h.OnMount(anchorPopup({ ...config.anchor, keepFocus: false })),
      ],
      [
        ...(diagnostics.length === 0
          ? []
          : [
              h.ul(
                [h.Class("fw-hover__diagnostics")],
                diagnostics.map((diagnostic) =>
                  h.li(
                    [
                      h.Class("fw-hover__diagnostic"),
                      h.DataAttribute("severity", diagnostic.severity),
                    ],
                    [
                      h.span([h.Class("fw-hover__severity")], [severityLabel[diagnostic.severity]]),
                      " ",
                      diagnostic.message,
                      ...(diagnostic.code === undefined
                        ? []
                        : [" ", h.code([h.Class("fw-hover__code")], [diagnostic.code])]),
                    ],
                  ),
                ),
              ),
            ]),
        ...(config.content === null
          ? []
          : [h.div([h.Class("fw-hover__content")], [config.content])]),
      ],
    );
  },
};
