import { GuardComposition } from "./text-interaction";
import { Effect, Option, Schema as S } from "effect";
import { Command, Dom, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { HtmlBuilder } from "foldkit/html";
import { sxAttrs } from "./sx";
import { desktopStyles as styles } from "./desktop.styles";
export const Model = S.Struct({
  id: S.String,
  mode: S.Literals(["view", "edit"]),
  draft: S.String,
  error: S.String,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Started: {},
  Changed: { value: S.String },
  Committed: { returnFocus: S.Boolean },
  Cancelled: { returnFocus: S.Boolean },
  Blurred: {},
  Focused: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Committed: { value: S.String },
  Cancelled: {},
});
export type OutMessage = typeof OutMessage.Type;
export type Policy = Readonly<{
  value: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isPending?: boolean;
  validate?: (value: string) => string | undefined;
  blur?: "commit" | "cancel" | "keep";
  enter?: "commit" | "newline" | "mod-enter";
  escape?: "cancel" | "keep";
  multiline?: boolean;
}>;
export const init = (id: string): Model => ({
  id,
  mode: "view",
  draft: "",
  error: "",
});
export const Focus = Command.define("FocusEditableText", {
  args: { id: S.String, select: S.Boolean },
  messages: [Message.Focused],
  execute: ({ id, select }) =>
    Dom.focus(`#${CSS.escape(id)}`).pipe(
      Effect.andThen(
        Effect.sync(() => {
          if (select)
            (document.getElementById(id) as HTMLInputElement | null)?.select();
        }),
      ),
      Effect.ignore,
      Effect.as(Message.Focused()),
    ),
});
const focus = (model: Model, enabled: boolean) =>
  enabled
    ? [
        Focus({
          id: `${model.id}-${model.mode}`,
          select: model.mode === "edit",
        }),
      ]
    : [];
export const update = (
  model: Model,
  message: Message,
  policy: Policy,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> => {
  if (message._tag === "Focused") return { model };
  if (policy.isDisabled || policy.isReadOnly || policy.isPending)
    return { model };
  switch (message._tag) {
    case "Started": {
      const next: Model = {
        ...model,
        mode: "edit",
        draft: policy.value,
        error: "",
      };
      return { model: next, commands: focus(next, true) };
    }
    case "Changed":
      return {
        model:
          model.mode === "edit"
            ? { ...model, draft: message.value, error: "" }
            : model,
      };
    case "Blurred":
      return policy.blur === "keep"
        ? { model }
        : update(
            model,
            policy.blur === "cancel"
              ? Message.Cancelled({ returnFocus: false })
              : Message.Committed({ returnFocus: false }),
            policy,
          );
    case "Cancelled": {
      if (model.mode !== "edit") return { model };
      const next: Model = {
        ...model,
        mode: "view",
        draft: policy.value,
        error: "",
      };
      return {
        model: next,
        commands: focus(next, message.returnFocus),
        outMessage: OutMessage.Cancelled(),
      };
    }
    case "Committed": {
      if (model.mode !== "edit") return { model };
      const error = policy.validate?.(model.draft);
      if (error)
        return {
          model: { ...model, error },
          commands: focus(model, message.returnFocus),
        };
      const next: Model = { ...model, mode: "view", error: "" };
      return {
        model: next,
        commands: focus(next, message.returnFocus),
        outMessage: OutMessage.Committed({ value: model.draft }),
      };
    }
  }
};
/** Controlled rendering can also adapt specialized editing engines (Tree rename). */
export const control = <Message>(
  config: Readonly<{
    id: string;
    value: string;
    label: string;
    multiline?: boolean;
    error?: string;
    status?: string;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    isPending?: boolean;
    enter?: Policy["enter"];
    escape?: Policy["escape"];
    onChange: (value: string) => Message;
    onCommit: Message;
    onCancel: Message;
    onBlur?: Message;
  }>,
  h: HtmlBuilder<Message>,
) => {
  const blocked = config.isDisabled || config.isReadOnly || config.isPending;
  const attrs = [
    h.OnMount(GuardComposition()),
    h.Id(config.id),
    h.Value(config.value),
    h.AriaLabel(config.label),
    h.Disabled(config.isDisabled === true),
    h.Readonly(config.isReadOnly === true || config.isPending === true),
    h.AriaBusy(config.isPending === true),
    h.AriaInvalid(Boolean(config.error)),
    h.AriaDescribedBy(`${config.id}-status`),
    ...sxAttrs(h, styles.control),
    h.OnInput(config.onChange),
    ...(config.onBlur === undefined ? [] : [h.OnBlur(config.onBlur)]),
    h.OnKeyDownPreventDefault((key, mods) => {
      if (blocked) return Option.none();
      if (key === "Escape" && config.escape !== "keep")
        return Option.some(config.onCancel);
      const policy =
        config.enter ?? (config.multiline ? "mod-enter" : "commit");
      return key === "Enter" &&
        (policy === "commit" ||
          (policy === "mod-enter" && (mods.metaKey || mods.ctrlKey)))
        ? Option.some(config.onCommit)
        : Option.none();
    }),
  ];
  return h.div(sxAttrs(h, styles.column), [
    config.multiline
      ? h.textarea([...attrs, h.Rows(3)], [])
      : h.input([...attrs, h.Type("text")]),
    h.span(
      [
        h.Id(`${config.id}-status`),
        h.Role("status"),
        ...sxAttrs(h, config.error ? styles.error : styles.muted),
      ],
      [
        config.error ||
          (config.isPending
            ? "Saving…"
            : (config.status ??
              (config.multiline
                ? "Ctrl/⌘+Enter to save · Escape to cancel"
                : "Enter to save · Escape to cancel"))),
      ],
    ),
  ]);
};
export const view = <ParentMessage>(
  config: Policy &
    Readonly<{
      model: Model;
      label: string;
      status?: string;
      toParentMessage: (message: Message) => ParentMessage;
    }>,
  h: HtmlBuilder<ParentMessage>,
) => {
  const send = config.toParentMessage;
  return config.model.mode === "view"
    ? h.div(sxAttrs(h, styles.column), [
        h.button(
          [
            h.Id(`${config.model.id}-view`),
            h.Type("button"),
            h.AriaBusy(config.isPending === true),
            h.AriaLabel(`Edit ${config.label}`),
            h.Disabled(
              config.isDisabled === true ||
                config.isReadOnly === true ||
                config.isPending === true,
            ),
            h.OnClick(send(Message.Started())),
            ...sxAttrs(h, styles.button),
          ],
          [config.value || "Click to edit"],
        ),
        ...(config.isPending
          ? [
              h.span(
                [h.Role("status"), ...sxAttrs(h, styles.muted)],
                ["Saving…"],
              ),
            ]
          : []),
      ])
    : control(
        {
          ...config,
          id: `${config.model.id}-edit`,
          value: config.model.draft,
          error: config.model.error,
          onChange: (value) => send(Message.Changed({ value })),
          onCommit: send(Message.Committed({ returnFocus: true })),
          onCancel: send(Message.Cancelled({ returnFocus: true })),
          onBlur: send(Message.Blurred()),
        },
        h,
      );
};
