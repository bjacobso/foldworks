import { Effect, Queue, Schema as S, Stream } from "effect";
import { Command, Dom, Mount, type Update } from "foldkit";
import * as Keyboard from "@foldworks/keyboard";
import { defineMessageUnion } from "foldkit/message";
import type { Html, HtmlBuilder } from "foldkit/html";
import { sxAttrs } from "./sx";
import { desktopStyles as styles } from "./desktop.styles";
export const Panel = S.Struct({ id: S.String, returnFocusId: S.String });
export type Panel = typeof Panel.Type;
export const Model = S.Struct({ id: S.String, panels: S.Array(Panel) });
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  RequestedPush: { id: S.String, returnFocusId: S.String },
  RequestedPop: {},
  Focused: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Push: { id: S.String, returnFocusId: S.String },
  Pop: {},
});
export type OutMessage = typeof OutMessage.Type;
export const init = (id: string, rootId: string): Model => {
  if (!id || !rootId)
    throw new Error("PanelStack requires nonempty stack and root IDs.");
  return { id, panels: [{ id: rootId, returnFocusId: "" }] };
};
const Focus = Command.define("FocusPanelStack", {
  args: { id: S.String, fallback: S.String },
  messages: [Message.Focused],
  execute: ({ id, fallback }) =>
    Dom.focus(`#${CSS.escape(id || fallback)}`).pipe(
      Effect.catch(() => Dom.focus(`#${CSS.escape(fallback)}`)),
      Effect.ignore,
      Effect.as(Message.Focused()),
    ),
});
/** Requests do not change history. The host accepts them with push/pop after permission checks. */
export const update = (
  model: Model,
  message: Message,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> => ({
  model,
  ...(message._tag === "RequestedPush"
    ? {
        outMessage: OutMessage.Push({
          id: message.id,
          returnFocusId: message.returnFocusId,
        }),
      }
    : message._tag === "RequestedPop" && model.panels.length > 1
      ? { outMessage: OutMessage.Pop() }
      : {}),
});
export const push = (
  model: Model,
  panel: Panel,
): Update.Return<Model, Message> => {
  if (!panel.id || model.panels.some((item) => item.id === panel.id))
    throw new Error("Panel IDs must be nonempty and unique in the stack.");
  return {
    model: { ...model, panels: [...model.panels, panel] },
    commands: [
      Focus({ id: `${model.id}-heading`, fallback: `${model.id}-heading` }),
    ],
  };
};
export const pop = (model: Model): Update.Return<Model, Message> =>
  model.panels.length <= 1
    ? { model }
    : {
        model: { ...model, panels: model.panels.slice(0, -1) },
        commands: [
          Focus({
            id: model.panels.at(-1)!.returnFocusId,
            fallback: `${model.id}-heading`,
          }),
        ],
      };
const BackKey = Mount.defineStream("PanelStackBackKey", {
  messages: [Message.RequestedPop],
  execute: ({ element }) =>
    Stream.callback<typeof Message.RequestedPop.Type>((queue) =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            const key = (event: Event) => {
              const keyboard = event as KeyboardEvent;
              const editable = event
                .composedPath()
                .some(
                  (node) =>
                    node instanceof HTMLElement &&
                    (node.matches("input,textarea,select") ||
                      node.isContentEditable),
                );
              if (
                element.getAttribute("data-can-pop") !== "true" ||
                !Keyboard.resolve(
                  [
                    {
                      id: "back",
                      label: "Back",
                      shortcut: Keyboard.shortcut("ArrowLeft", "Alt"),
                    },
                  ],
                  keyboard,
                  "other",
                  [],
                  editable,
                )
              )
                return;
              keyboard.preventDefault();
              keyboard.stopPropagation();
              Queue.offerUnsafe(queue, Message.RequestedPop());
            };
            element.addEventListener("keydown", key);
            return () => element.removeEventListener("keydown", key);
          }),
          (dispose) => Effect.sync(dispose),
        );
        return yield* Effect.never;
      }),
    ),
});
export const view = <ParentMessage>(
  config: Readonly<{
    model: Model;
    title: (id: string) => string;
    render: (id: string) => Html;
    toParentMessage: (message: Message) => ParentMessage;
  }>,
  h: HtmlBuilder<ParentMessage>,
) => {
  const active = config.model.panels.at(-1);
  if (!active) throw new Error("PanelStack requires a root panel.");
  return h.section(
    [
      h.AriaLabelledBy(`${config.model.id}-heading`),
      h.DataAttribute("can-pop", String(config.model.panels.length > 1)),
      ...sxAttrs(h, styles.column, styles.surface),
      h.OnMount(Mount.mapMessage(BackKey(), config.toParentMessage)),
    ],
    [
      h.header(sxAttrs(h, styles.row), [
        ...(config.model.panels.length > 1
          ? [
              h.button(
                [
                  h.Type("button"),
                  h.OnClick(config.toParentMessage(Message.RequestedPop())),
                  h.AriaLabel("Back to previous panel"),
                  ...sxAttrs(h, styles.button),
                ],
                ["← Back"],
              ),
            ]
          : []),
        h.h3(
          [h.Id(`${config.model.id}-heading`), h.Tabindex(-1)],
          [config.title(active.id)],
        ),
      ]),
      h.div(
        [
          h.Key(active.id),
          h.DataAttribute("panel-id", active.id),
          ...sxAttrs(h, styles.panel),
        ],
        [config.render(active.id)],
      ),
    ],
  );
};
