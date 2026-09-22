import { GuardComposition } from "./text-interaction";
import { Option, Schema as S } from "effect";
import { Calendar, Command, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { HtmlBuilder } from "foldkit/html";
import * as DatePicker from "./stateful/date-picker";
import { sxAttrs } from "./sx";
import { desktopStyles as styles } from "./desktop.styles";
export type Date = Calendar.CalendarDate;
export type Codec = Readonly<{
  format: (date: Date) => string;
  parse: (text: string) => Date | undefined;
  hint: string;
}>;
export const iso: Codec = {
  format: (date) =>
    `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`,
  parse: (text) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return;
    const date = { year: +match[1]!, month: +match[2]!, day: +match[3]! };
    return Calendar.isCalendarDate(date) ? date : undefined;
  },
  hint: "YYYY-MM-DD",
};
/** Gregorian numeric dates with Latin digits; no guessed Date.parse or timezone conversion. */
export const numericLocale = (locale: string): Codec => {
  const formatter = new Intl.DateTimeFormat(locale, {
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const sample = formatter.formatToParts(
    new globalThis.Date("2006-11-22T12:00:00Z"),
  );
  const fields: string[] = [];
  const pattern = sample
    .map((part) => {
      if (["year", "month", "day"].includes(part.type)) {
        fields.push(part.type);
        return part.type === "year" ? "(\\d{4})" : "(\\d{1,2})";
      }
      return part.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return {
    hint: sample
      .map((part) =>
        part.type === "year"
          ? "YYYY"
          : part.type === "month"
            ? "MM"
            : part.type === "day"
              ? "DD"
              : part.value,
      )
      .join(""),
    format: (date) => {
      const value = new globalThis.Date(0);
      value.setUTCFullYear(date.year, date.month - 1, date.day);
      return formatter.format(value);
    },
    parse: (text) => {
      const match = new RegExp(`^${pattern}$`).exec(text);
      if (!match) return;
      const parts = Object.fromEntries(
        fields.map((field, i) => [field, Number(match[i + 1])]),
      );
      const date = { year: parts.year!, month: parts.month!, day: parts.day! };
      return Calendar.isCalendarDate(date) ? date : undefined;
    },
  };
};
/** Locale names and explicit week start for the existing Foldkit calendar engine. */
export const calendarLocale = (
  locale: string,
  firstDayOfWeek: Calendar.DayOfWeek,
): Calendar.LocaleConfig => {
  const format = (
    options: Intl.DateTimeFormatOptions,
    month: number,
    day: number,
  ) =>
    new Intl.DateTimeFormat(locale, {
      ...options,
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "UTC",
    }).format(new globalThis.Date(globalThis.Date.UTC(2026, month, day)));
  return S.decodeUnknownSync(Calendar.LocaleConfig)({
    firstDayOfWeek,
    monthNames: Array.from({ length: 12 }, (_, month) =>
      format({ month: "long" }, month, 1),
    ),
    shortMonthNames: Array.from({ length: 12 }, (_, month) =>
      format({ month: "short" }, month, 1),
    ),
    // March 1, 2026 is a Sunday. Foldkit stores day names Sunday-first.
    dayNames: Array.from({ length: 7 }, (_, day) =>
      format({ weekday: "long" }, 2, day + 1),
    ),
    shortDayNames: Array.from({ length: 7 }, (_, day) =>
      format({ weekday: "short" }, 2, day + 1),
    ),
  });
};
export const Model = S.Struct({
  id: S.String,
  picker: DatePicker.Model,
  draft: S.NullOr(S.String),
  error: S.String,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  GotPicker: { message: DatePicker.Message },
  Changed: { text: S.String },
  Committed: {},
  Cancelled: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Changed: { value: S.NullOr(Calendar.CalendarDate) },
});
export type OutMessage = typeof OutMessage.Type;
export type Config = Readonly<{
  value: Date | null;
  codec?: Codec;
  min?: Date;
  max?: Date;
  disabledDates?: ReadonlyArray<Date>;
  disabledDaysOfWeek?: ReadonlyArray<Calendar.DayOfWeek>;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  required?: boolean;
}>;
export const init = (config: DatePicker.InitConfig): Model => ({
  id: config.id,
  picker: DatePicker.init({ ...config, id: `${config.id}-picker` }),
  draft: null,
  error: "",
});
const constrained = (
  model: DatePicker.Model,
  config: Config,
): DatePicker.Model => ({
  ...model,
  calendar: {
    ...model.calendar,
    maybeMinDate: Option.fromNullishOr(config.min),
    maybeMaxDate: Option.fromNullishOr(config.max),
    disabledDates: config.disabledDates ?? [],
    disabledDaysOfWeek: config.disabledDaysOfWeek ?? [],
  },
});
export const isAllowed = (date: Date, config: Config) =>
  Calendar.isCalendarDate(date) &&
  (!config.min || !Calendar.isBefore(date, config.min)) &&
  (!config.max || !Calendar.isAfter(date, config.max)) &&
  !config.disabledDates?.some((disabled) => Calendar.isEqual(date, disabled)) &&
  !config.disabledDaysOfWeek?.includes(Calendar.dayOfWeek(date));
export const update = (
  model: Model,
  message: Message,
  config: Config,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> => {
  if (message._tag === "GotPicker") {
    const result = DatePicker.update(
      constrained(model.picker, config),
      message.message,
    );
    const value =
      result.outMessage?._tag === "SelectedDate"
        ? result.outMessage.date
        : null;
    const changed =
      result.outMessage?._tag === "SelectedDate" ||
      result.outMessage?._tag === "ClearedDate";
    return {
      model: {
        ...model,
        picker: result.model,
        ...(changed ? { draft: null, error: "" } : {}),
      },
      commands: (result.commands ?? []).map((command) =>
        Command.mapMessage(command, (message) =>
          Message.GotPicker({ message }),
        ),
      ),
      ...(changed &&
      !config.isDisabled &&
      !config.isReadOnly &&
      (value === null ? !config.required : isAllowed(value, config))
        ? { outMessage: OutMessage.Changed({ value }) }
        : {}),
    };
  }
  if (config.isDisabled || config.isReadOnly) return { model };
  if (message._tag === "Changed")
    return { model: { ...model, draft: message.text, error: "" } };
  if (message._tag === "Cancelled")
    return { model: { ...model, draft: null, error: "" } };
  if (model.draft === null) return { model };
  const text = model.draft.trim();
  const value = text === "" ? null : (config.codec ?? iso).parse(text);
  const error =
    value === undefined
      ? `Enter a date as ${(config.codec ?? iso).hint}.`
      : value === null
        ? config.required
          ? "Choose a date."
          : ""
        : !isAllowed(value, config)
          ? "This date is unavailable."
          : "";
  if (error) return { model: { ...model, error } };
  return {
    model: {
      ...model,
      draft: null,
      error: "",
      picker: value
        ? {
            ...model.picker,
            calendar: {
              ...model.picker.calendar,
              viewYear: value.year,
              viewMonth: value.month,
              maybeFocusedDate: Option.some(value),
            },
          }
        : model.picker,
    },
    outMessage: OutMessage.Changed({ value: value ?? null }),
  };
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
  const codec = config.codec ?? iso;
  return h.div(sxAttrs(h, styles.column), [
    h.label([h.For(`${model.id}-input`)], [config.label]),
    h.div(sxAttrs(h, styles.row), [
      h.input([
        h.OnMount(GuardComposition()),
        h.Id(`${model.id}-input`),
        h.Type("text"),
        h.Value(
          model.draft ?? (config.value ? codec.format(config.value) : ""),
        ),
        h.Placeholder(codec.hint),
        h.Disabled(config.isDisabled === true),
        h.Readonly(config.isReadOnly === true),
        h.AriaInvalid(Boolean(model.error)),
        h.AriaDescribedBy(`${model.id}-status`),
        h.OnInput((text) => send(Message.Changed({ text }))),
        h.OnBlur(send(Message.Committed())),
        h.OnKeyDownPreventDefault((key) =>
          key === "Enter"
            ? Option.some(send(Message.Committed()))
            : key === "Escape" && model.draft !== null
              ? Option.some(send(Message.Cancelled()))
              : Option.none(),
        ),
        ...sxAttrs(h, styles.control),
      ]),
      h.submodel({
        slotId: model.picker.id,
        model: constrained(model.picker, config),
        toParentMessage: (message) => send(Message.GotPicker({ message })),
        view: DatePicker.view,
        viewInputs: DatePicker.styledViewInputs(
          {
            value: config.value,
            label: `Choose ${config.label}`,
            format: codec.format,
            isDisabled:
              config.isDisabled === true || config.isReadOnly === true,
          },
          h,
        ),
      }),
    ]),
    ...(config.name && !config.isDisabled
      ? [
          h.input([
            h.Type("hidden"),
            h.Name(config.name),
            h.Value(config.value ? iso.format(config.value) : ""),
          ]),
        ]
      : []),
    h.p(
      [
        h.Id(`${model.id}-status`),
        h.Role("status"),
        ...sxAttrs(h, model.error ? styles.error : styles.muted),
      ],
      [model.error || codec.hint],
    ),
  ]);
};
