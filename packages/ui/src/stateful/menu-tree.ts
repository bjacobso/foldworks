import { Effect, Option, Queue, Schema as S, Stream } from "effect";
import { Command, Dom, Mount, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { Html, HtmlBuilder } from "foldkit/html";
import * as Keyboard from "@foldworks/keyboard";
import { sxAttrs } from "../sx";
import { desktopStyles as styles } from "../desktop.styles";
export type Item<Id extends string = string> = Readonly<{
  id: Id;
  label: string;
  children?: ReadonlyArray<Item<Id>>;
  isDisabled?: boolean;
  kind?: "checkbox" | "radio";
  isChecked?: boolean;
  command?: Keyboard.Binding<Id>;
}>;
export const Model = S.Struct({
  id: S.String,
  isOpen: S.Boolean,
  x: S.NullOr(S.Number),
  y: S.NullOr(S.Number),
  path: S.Array(S.String),
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Opened: { x: S.NullOr(S.Number), y: S.NullOr(S.Number) },
  Closed: { restore: S.Boolean },
  Key: { key: S.String },
  Hovered: { path: S.Array(S.String) },
  Selected: { path: S.Array(S.String) },
  Focused: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Selected: { id: S.String, isChecked: S.Boolean },
});
export type OutMessage = typeof OutMessage.Type;
export const init = (id: string): Model => ({
  id,
  isOpen: false,
  x: null,
  y: null,
  path: [],
});
export const itemsAt = (
  items: ReadonlyArray<Item>,
  ancestors: ReadonlyArray<string>,
): ReadonlyArray<Item> =>
  ancestors.reduce<ReadonlyArray<Item>>(
    (list, id) => list.find((item) => item.id === id)?.children ?? [],
    items,
  );
const disabled = (item: Item) =>
  item.isDisabled === true || item.command?.isDisabled === true;
/** Reconcile host item removal without exposing a dangling active descendant. */
export const reconcile = (model: Model, items: ReadonlyArray<Item>): Model => {
  const validate = (entries: ReadonlyArray<Item>) => {
    if (
      entries.some((item) => !item.id) ||
      new Set(entries.map((item) => item.id)).size !== entries.length
    )
      throw new Error("Menu sibling IDs must be nonempty and unique.");
    for (const item of entries) if (item.children) validate(item.children);
  };
  validate(items);
  if (!model.isOpen) return model;
  const path: string[] = [];
  let siblings = items;
  for (const id of model.path.length ? model.path : [""]) {
    const active =
      siblings.find((item) => item.id === id && !disabled(item)) ??
      siblings.find((item) => !disabled(item));
    if (!active) break;
    path.push(active.id);
    if (active.id !== id || !active.children) break;
    siblings = active.children;
  }
  return { ...model, path };
};
const Focus = Command.define("FocusCascadingMenu", {
  args: { id: S.String },
  messages: [Message.Focused],
  execute: ({ id }) =>
    Dom.focus(`#${CSS.escape(id)}`).pipe(
      Effect.ignore,
      Effect.as(Message.Focused()),
    ),
});
export const update = (
  previous: Model,
  message: Message,
  items: ReadonlyArray<Item>,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> => {
  const model = reconcile(previous, items);
  const close = (restore: boolean) => ({
    model: { ...model, isOpen: false, path: [] },
    commands: restore ? [Focus({ id: `${model.id}-trigger` })] : [],
  });
  switch (message._tag) {
    case "Focused":
      return { model };
    case "Opened":
      return {
        model: {
          ...model,
          isOpen: true,
          x: message.x,
          y: message.y,
          path: items.find((item) => !disabled(item))
            ? [items.find((item) => !disabled(item))!.id]
            : [],
        },
      };
    case "Closed":
      return close(message.restore);
    case "Hovered": {
      const item = itemsAt(items, message.path.slice(0, -1)).find(
        (item) => item.id === message.path.at(-1),
      );
      return {
        model:
          model.isOpen && item && !disabled(item)
            ? {
                ...model,
                path: item.children
                  ? [
                      ...message.path,
                      ...item.children
                        .filter((child) => !disabled(child))
                        .slice(0, 1)
                        .map((child) => child.id),
                    ]
                  : message.path,
              }
            : model,
      };
    }
    case "Selected": {
      if (!model.isOpen) return { model };
      const item = itemsAt(items, message.path.slice(0, -1)).find(
        (item) => item.id === message.path.at(-1),
      );
      if (!item || disabled(item)) return { model };
      if (item.children)
        return {
          model: {
            ...model,
            path: [
              ...message.path,
              ...item.children
                .filter((child) => !disabled(child))
                .slice(0, 1)
                .map((child) => child.id),
            ],
          },
        };
      return {
        ...(item.kind ? { model } : close(true)),
        outMessage: OutMessage.Selected({
          id: item.command?.id ?? item.id,
          isChecked: item.kind === "radio" || !item.isChecked,
        }),
      };
    }
    case "Key": {
      if (!model.isOpen) return { model };
      if (message.key === "Escape")
        return model.path.length > 1
          ? { model: { ...model, path: model.path.slice(0, -1) } }
          : close(true);
      if (message.key === "Tab") return close(false);
      const ancestors = model.path.slice(0, -1);
      const siblings = itemsAt(items, ancestors).filter(
        (item) => !disabled(item),
      );
      const index = siblings.findIndex((item) => item.id === model.path.at(-1));
      if (message.key === "ArrowLeft")
        return {
          model: {
            ...model,
            path: model.path.length > 1 ? ancestors : model.path,
          },
        };
      if (["ArrowRight", "Enter", " "].includes(message.key)) {
        const item = siblings[index];
        return item && (message.key !== "ArrowRight" || item.children)
          ? update(model, Message.Selected({ path: model.path }), items)
          : { model };
      }
      const next =
        message.key === "Home"
          ? siblings[0]
          : message.key === "End"
            ? siblings.at(-1)
            : message.key === "ArrowDown"
              ? siblings[(index + 1) % siblings.length]
              : message.key === "ArrowUp"
                ? siblings[(index - 1 + siblings.length) % siblings.length]
                : message.key.length === 1
                  ? [
                      ...siblings.slice(index + 1),
                      ...siblings.slice(0, index + 1),
                    ].find((item) =>
                      item.label
                        .toLocaleLowerCase()
                        .startsWith(message.key.toLocaleLowerCase()),
                    )
                  : undefined;
      return {
        model: next ? { ...model, path: [...ancestors, next.id] } : model,
      };
    }
  }
};
const Context = Mount.defineStream("ContextMenuTrigger", {
  messages: [Message.Opened],
  execute: ({ element }) =>
    Stream.callback<typeof Message.Opened.Type>((queue) =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            const open = (event: MouseEvent | KeyboardEvent) => {
              if (
                event instanceof KeyboardEvent &&
                event.key !== "ContextMenu" &&
                !(event.shiftKey && event.key === "F10")
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              Queue.offerUnsafe(
                queue,
                Message.Opened({
                  x: event instanceof MouseEvent ? event.clientX : null,
                  y: event instanceof MouseEvent ? event.clientY : null,
                }),
              );
            };
            element.addEventListener("contextmenu", open as EventListener);
            element.addEventListener("keydown", open as EventListener);
            return () => {
              element.removeEventListener("contextmenu", open as EventListener);
              element.removeEventListener("keydown", open as EventListener);
            };
          }),
          (dispose) => Effect.sync(dispose),
        );
        return yield* Effect.never;
      }),
    ),
});
const stacks = new WeakMap<Document, HTMLElement[]>();
/** Native manual popover escapes clipping; a scoped bridge owns outside dismissal and pointer intent. */
const Layer = Mount.defineStream("CascadingMenuLayer", {
  args: { trigger: S.String, x: S.NullOr(S.Number), y: S.NullOr(S.Number) },
  messages: [Message.Closed, Message.Key, Message.Hovered],
  execute: ({ element, trigger, x, y }) =>
    Stream.callback<Extract<Message, { _tag: "Closed" | "Key" | "Hovered" }>>(
      (queue) =>
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.sync(() => {
              const panel = element as HTMLElement;
              const doc = panel.ownerDocument;
              const stack = stacks.get(doc) ?? [];
              stacks.set(doc, stack);
              stack.push(panel);
              let timer: ReturnType<typeof setTimeout> | undefined;
              const emit = (
                message: Extract<
                  Message,
                  { _tag: "Closed" | "Key" | "Hovered" }
                >,
              ) => Queue.offerUnsafe(queue, message);
              panel.showPopover();
              const anchor = doc
                .getElementById(trigger)
                ?.getBoundingClientRect();
              const box = panel.getBoundingClientRect();
              const position = (width: number, height: number) => {
                panel.style.left = `${Math.max(8, Math.min(x ?? anchor?.left ?? 8, innerWidth - width - 8))}px`;
                panel.style.top = `${Math.max(8, Math.min(y ?? anchor?.bottom ?? 8, innerHeight - height - 8))}px`;
              };
              position(box.width, box.height);
              let frame = 0;
              const observer = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (!entry) return;
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(() =>
                  position(entry.contentRect.width, entry.contentRect.height),
                );
              });
              observer.observe(panel);
              const activeObserver = new MutationObserver(() => {
                const active = doc.getElementById(
                  panel.getAttribute("aria-activedescendant") ?? "",
                );
                active?.scrollIntoView({ block: "nearest", inline: "nearest" });
              });
              activeObserver.observe(panel, {
                attributes: true,
                attributeFilter: ["aria-activedescendant"],
              });
              panel.focus();
              const top = () => stack.at(-1) === panel;
              const down = (event: PointerEvent) => {
                if (
                  top() &&
                  !event.composedPath().includes(panel) &&
                  !(
                    event.target instanceof Element &&
                    doc.getElementById(trigger)?.contains(event.target)
                  )
                )
                  emit(Message.Closed({ restore: false }));
              };
              const key = (event: KeyboardEvent) => {
                if (!top() || event.isComposing || event.defaultPrevented)
                  return;
                if (
                  [
                    "ArrowUp",
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End",
                    "Enter",
                    " ",
                    "Escape",
                    "Tab",
                  ].includes(event.key) ||
                  (event.key.length === 1 &&
                    !event.ctrlKey &&
                    !event.metaKey &&
                    !event.altKey)
                ) {
                  if (event.key !== "Tab") event.preventDefault();
                  event.stopPropagation();
                  emit(Message.Key({ key: event.key }));
                }
              };
              const over = (event: PointerEvent) => {
                const item = (event.target as Element).closest<HTMLElement>(
                  "[data-menu-path]",
                );
                clearTimeout(timer);
                if (item && !item.contains(event.relatedTarget as Node | null))
                  timer = setTimeout(
                    () =>
                      emit(
                        Message.Hovered({
                          path: JSON.parse(item.dataset.menuPath!),
                        }),
                      ),
                    160,
                  );
              };
              const leave = () => clearTimeout(timer);
              const resize = () => emit(Message.Closed({ restore: true }));
              doc.addEventListener("pointerdown", down, true);
              panel.addEventListener("keydown", key);
              panel.addEventListener("pointerover", over);
              panel.addEventListener("pointerleave", leave);
              window.addEventListener("resize", resize);
              return () => {
                clearTimeout(timer);
                cancelAnimationFrame(frame);
                observer.disconnect();
                activeObserver.disconnect();
                doc.removeEventListener("pointerdown", down, true);
                panel.removeEventListener("keydown", key);
                panel.removeEventListener("pointerover", over);
                panel.removeEventListener("pointerleave", leave);
                window.removeEventListener("resize", resize);
                const index = stack.indexOf(panel);
                if (index >= 0) stack.splice(index, 1);
                if (panel.matches(":popover-open")) panel.hidePopover();
              };
            }),
            (dispose) => Effect.sync(dispose),
          );
          return yield* Effect.never;
        }),
    ),
});
const rowId = (id: string, path: ReadonlyArray<string>) =>
  `${id}-item-${path.map(encodeURIComponent).join("/")}`;
export const view = <ParentMessage>(
  config: Readonly<{
    model: Model;
    items: ReadonlyArray<Item>;
    label: string;
    context?: boolean;
    trigger?: ReadonlyArray<Html | string>;
    platform?: Keyboard.Platform;
    toParentMessage: (message: Message) => ParentMessage;
  }>,
  h: HtmlBuilder<ParentMessage>,
) => {
  const model = reconcile(config.model, config.items);
  const send = config.toParentMessage;
  const render = (
    items: ReadonlyArray<Item>,
    ancestors: ReadonlyArray<string>,
  ): Html =>
    h.div(
      [
        h.Role(ancestors.length ? "menu" : "group"),
        h.AriaLabel(
          ancestors.length
            ? (itemsAt(config.items, ancestors.slice(0, -1)).find(
                (item) => item.id === ancestors.at(-1),
              )?.label ?? config.label)
            : config.label,
        ),
        ...sxAttrs(h, styles.menu, styles.column),
      ],
      items.map((item) => {
        const path = [...ancestors, item.id];
        const active = model.path[ancestors.length] === item.id;
        return h.div(
          [h.Key(item.id)],
          [
            h.div(
              [
                h.Id(rowId(model.id, path)),
                h.Role(item.kind ? `menuitem${item.kind}` : "menuitem"),
                h.Tabindex(-1),
                h.AriaDisabled(disabled(item)),
                h.DataAttribute("menu-path", JSON.stringify(path)),
                ...sxAttrs(
                  h,
                  styles.button,
                  styles.row,
                  active && styles.selected,
                ),
                ...(item.kind ? [h.AriaChecked(item.isChecked === true)] : []),
                ...(item.children
                  ? [
                      h.Attribute("aria-haspopup", "menu"),
                      h.AriaExpanded(active && model.path.length > path.length),
                    ]
                  : []),
                ...(item.command
                  ? [
                      h.AriaKeyshortcuts(
                        Keyboard.aria(
                          item.command.shortcut,
                          config.platform ?? "other",
                        ),
                      ),
                    ]
                  : []),
                h.OnClick(send(Message.Selected({ path }))),
              ],
              [
                h.span(
                  [h.AriaHidden(true)],
                  [item.kind ? (item.isChecked ? "✓" : "○") : ""],
                ),
                item.label,
                ...(item.command
                  ? [
                      h.kbd(sxAttrs(h, styles.muted), [
                        Keyboard.display(
                          item.command.shortcut,
                          config.platform ?? "other",
                        ),
                      ]),
                    ]
                  : []),
                h.span([h.AriaHidden(true)], [item.children ? "›" : ""]),
              ],
            ),
            ...(active && item.children && model.path.length > path.length
              ? [
                  h.div(
                    [h.Style({ marginInlineStart: "16px" })],
                    [render(item.children, path)],
                  ),
                ]
              : []),
          ],
        );
      }),
    );
  return h.div(sxAttrs(h, styles.column), [
    h.div(
      [
        h.Id(`${model.id}-trigger`),
        h.Tabindex(0),
        h.Role(config.context ? "group" : "button"),
        h.AriaLabel(config.label),
        h.Attribute("aria-haspopup", "menu"),
        h.AriaExpanded(model.isOpen),
        ...(config.context
          ? [h.OnMount(Mount.mapMessage(Context(), send))]
          : [
              h.OnClick(
                send(
                  model.isOpen
                    ? Message.Closed({ restore: true })
                    : Message.Opened({ x: null, y: null }),
                ),
              ),
              h.OnKeyDownPreventDefault((key) =>
                model.isOpen &&
                [
                  "ArrowUp",
                  "ArrowDown",
                  "ArrowLeft",
                  "ArrowRight",
                  "Home",
                  "End",
                  "Enter",
                  " ",
                  "Escape",
                ].includes(key)
                  ? Option.some(send(Message.Key({ key })))
                  : ["Enter", " ", "ArrowDown"].includes(key)
                    ? Option.some(send(Message.Opened({ x: null, y: null })))
                    : Option.none(),
              ),
            ]),
        ...sxAttrs(h, styles.button),
      ],
      config.trigger ?? [config.label],
    ),
    ...(model.isOpen
      ? [
          h.div(
            [
              h.Id(`${model.id}-layer`),
              h.Key(JSON.stringify([model.id, model.x, model.y])),
              h.Attribute("popover", "manual"),
              h.Tabindex(-1),
              h.Role("menu"),
              h.AriaLabel(config.label),
              ...(model.path.length
                ? [h.AriaActiveDescendant(rowId(model.id, model.path))]
                : []),
              h.Style({
                position: "fixed",
                margin: "0",
                inset: "auto",
                border: "none",
                padding: "0",
                background: "transparent",
                maxHeight: "calc(100vh - 16px)",
                overflow: "auto",
              }),
              h.OnMount(
                Mount.mapMessage(
                  Layer({
                    trigger: `${model.id}-trigger`,
                    x: model.x,
                    y: model.y,
                  }),
                  send,
                ),
              ),
            ],
            [render(config.items, [])],
          ),
        ]
      : []),
  ]);
};
