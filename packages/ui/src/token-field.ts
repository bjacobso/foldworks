import { GuardComposition } from "./text-interaction";
import { Effect, Option, Schema as S } from "effect";
import { Command, Dom, Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { childAttributes, type HtmlBuilder } from "foldkit/html";
import * as Combobox from "./stateful/combobox";
import * as Tag from "./tag";
import { sxAttrs } from "./sx";
import { desktopStyles as styles } from "./desktop.styles";
const Suggestions = Combobox.Multi.create<string>();
export const Model = S.Struct({
  id: S.String,
  combobox: Combobox.Multi.Model,
  active: S.NullOr(S.String),
  error: S.String,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  GotCombobox: { message: Combobox.Message },
  Pasted: { text: S.String },
  Removed: { value: S.String },
  Navigated: { key: S.String },
  Activated: { value: S.String },
  Focused: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Changed: { values: S.Array(S.String) },
});
export type OutMessage = typeof OutMessage.Type;
export type Config = Readonly<{
  values: ReadonlyArray<string>;
  options: ReadonlyArray<Combobox.OptionItem<string>>;
  delimiters?: ReadonlyArray<string>;
  trim?: boolean;
  deduplicate?: (value: string) => string;
  validate?: (value: string) => string | undefined;
  maxCount?: number;
  allowCustom?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  shouldFilter?: boolean;
}>;
export const init = (id: string): Model => ({
  id,
  combobox: Combobox.Multi.init({ id: `${id}-suggestions` }),
  active: null,
  error: "",
});
export const tokenize = (
  text: string,
  config: Config,
): ReadonlyArray<string> => {
  let parts = [text];
  for (const delimiter of config.delimiters ?? [",", ";", "\n"])
    if (delimiter) parts = parts.flatMap((part) => part.split(delimiter));
  return parts
    .map((value) => (config.trim === false ? value : value.trim()))
    .filter(Boolean);
};
/** Atomic paste: invalid batches do not partially change application data. */
export const add = (
  values: ReadonlyArray<string>,
  candidates: ReadonlyArray<string>,
  config: Config,
): Readonly<{ values: ReadonlyArray<string>; error: string }> => {
  const next = [...values];
  const identity = config.deduplicate ?? ((value: string) => value);
  for (const candidate of candidates) {
    const value = config.trim === false ? candidate : candidate.trim();
    if (
      !value ||
      next.some((existing) => identity(existing) === identity(value))
    )
      continue;
    const option = config.options.find((option) => option.value === value);
    const error = option?.isDisabled
      ? `${value} is unavailable.`
      : !option && !config.allowCustom
        ? `${value} is not an available option.`
        : config.validate?.(value);
    if (error) return { values, error };
    next.push(value);
  }
  return next.length > (config.maxCount ?? Infinity)
    ? { values, error: `Choose at most ${config.maxCount} values.` }
    : { values: next, error: "" };
};
const Focus = Command.define("FocusTokenField", {
  args: { id: S.String, value: S.NullOr(S.String) },
  messages: [Message.Focused],
  execute: ({ id, value }) =>
    (value === null
      ? Dom.focus(`#${CSS.escape(id)} input[role=combobox]`)
      : Dom.focus(
          `#${CSS.escape(id)} [data-token="${encodeURIComponent(value)}"] button`,
        )
    ).pipe(Effect.ignore, Effect.as(Message.Focused())),
});
const focus = (model: Model) => [Focus({ id: model.id, value: model.active })];
export const update = (
  model: Model,
  message: Message,
  config: Config,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> => {
  const blocked = config.isDisabled || config.isReadOnly;
  const changed = (
    candidates: ReadonlyArray<string>,
  ): Update.ReturnWithOutMessage<Model, Message, OutMessage> => {
    const result = add(config.values, candidates, config);
    return {
      model: {
        ...model,
        active: null,
        error: result.error,
        combobox: {
          ...model.combobox,
          inputValue: result.error ? model.combobox.inputValue : "",
        },
      },
      ...(!result.error
        ? { outMessage: OutMessage.Changed({ values: result.values }) }
        : {}),
    };
  };
  switch (message._tag) {
    case "Focused":
      return { model };
    case "GotCombobox": {
      const result = Suggestions.update(model.combobox, message.message);
      const next = {
        ...model,
        combobox: result.model,
        active:
          message.message._tag === "UpdatedInputValue" ||
          message.message._tag === "Opened"
            ? null
            : model.active,
      };
      const commands = (result.commands ?? []).map((command) =>
        Command.mapMessage(command, (message) =>
          Message.GotCombobox({ message }),
        ),
      );
      if (result.outMessage?._tag === "Selected" && !blocked) {
        const value = result.outMessage.value;
        const addition = changed([value]);
        const selected = config.values.includes(value)
          ? {
              model: next,
              outMessage: OutMessage.Changed({
                values: config.values.filter((item) => item !== value),
              }),
            }
          : {
              ...addition,
              model: {
                ...addition.model,
                combobox: {
                  ...next.combobox,
                  inputValue: addition.model.error
                    ? model.combobox.inputValue
                    : "",
                },
              },
            };
        return { ...selected, commands };
      }
      return { model: next, commands };
    }
    case "Pasted":
      return blocked ? { model } : changed(tokenize(message.text, config));
    case "Removed": {
      if (blocked) return { model };
      const next = { ...model, active: null, error: "" };
      return {
        model: next,
        commands: focus(next),
        outMessage: OutMessage.Changed({
          values: config.values.filter((value) => value !== message.value),
        }),
      };
    }
    case "Activated": {
      const next = { ...model, active: message.value };
      return { model: next, commands: focus(next) };
    }
    case "Navigated": {
      if (blocked) return { model };
      if (
        (message.key === "Backspace" || message.key === "Delete") &&
        model.active
      )
        return update(model, Message.Removed({ value: model.active }), config);
      const index =
        model.active === null
          ? config.values.length
          : config.values.indexOf(model.active);
      const active =
        message.key === "ArrowRight"
          ? (config.values[index + 1] ?? null)
          : (config.values[Math.max(0, index - 1)] ?? null);
      const next = { ...model, active };
      return { model: next, commands: focus(next) };
    }
  }
};
export const view = <ParentMessage>(
  config: Config &
    Readonly<{
      model: Model;
      label: string;
      name?: string;
      toParentMessage: (message: Message) => ParentMessage;
    }>,
  h: HtmlBuilder<ParentMessage>,
) => {
  const { model, toParentMessage: send } = config;
  const options = [...config.options];
  const query = model.combobox.inputValue.trim();
  if (
    config.allowCustom &&
    query &&
    !options.some((option) => option.value === query)
  )
    options.push({ value: query, label: `Add “${query}”` });
  const blocked = config.isDisabled || config.isReadOnly;
  return h.div(
    [
      h.OnMount(GuardComposition()),
      h.Id(model.id),
      ...sxAttrs(h, styles.column),
      h.OnPastePreventDefault((text) =>
        blocked ? Option.none() : Option.some(send(Message.Pasted({ text }))),
      ),
      h.OnKeyDownPreventDefault((key) =>
        !blocked &&
        (!model.combobox.inputValue || model.active !== null) &&
        ["ArrowLeft", "ArrowRight", "Backspace", "Delete"].includes(key)
          ? Option.some(send(Message.Navigated({ key })))
          : Option.none(),
      ),
    ],
    [
      h.div(
        [
          h.Role("group"),
          h.AriaLabel(`${config.label} selected values`),
          ...sxAttrs(h, styles.row, styles.wrap),
        ],
        config.values.map((value) =>
          Tag.view(
            {
              label:
                config.options.find((option) => option.value === value)
                  ?.label ?? value,
              isSelected: model.active === value,
              isDisabled: config.isDisabled === true,
              attributes: [h.DataAttribute("token", encodeURIComponent(value))],
              ...(!blocked
                ? {
                    onRemove: send(Message.Removed({ value })),
                    onSelect: send(Message.Activated({ value })),
                  }
                : {}),
            },
            h,
          ),
        ),
      ),
      h.submodel({
        slotId: model.combobox.id,
        model: model.combobox,
        toParentMessage: (message) => send(Message.GotCombobox({ message })),
        view: Suggestions.view,
        viewInputs: {
          ...Combobox.Multi.styledViewInputs(
            {
              ...config,
              options,
              ariaLabel: config.label,
              query: model.combobox.inputValue,
            },
            h,
          ),
          formName: "",
          inputAttributes: childAttributes([
            h.Disabled(config.isDisabled === true),
            h.AriaDescribedBy(`${model.id}-status`),
            h.AriaInvalid(Boolean(model.error)),
          ]),
        },
      }),
      ...(config.name && !config.isDisabled
        ? config.values.map((value) =>
            h.input([h.Type("hidden"), h.Name(config.name!), h.Value(value)]),
          )
        : []),
      h.p(
        [
          h.Id(`${model.id}-status`),
          h.Role("status"),
          ...sxAttrs(h, model.error ? styles.error : styles.muted),
        ],
        [
          model.error ||
            "Choose suggestions or paste values. Use Left or Backspace in an empty field to select a tag.",
        ],
      ),
    ],
  );
};
