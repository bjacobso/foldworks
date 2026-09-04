import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import { styledAttrs, type StyledConfig } from "./catalog.shared";
import { sxAttrs } from "./sx";

export type DateValue = Readonly<{ year: number; month: number; day: number }>;

const key = (date: DateValue): string =>
  `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;

const calendar = <Message>(
  config: StyledConfig<Message> & Readonly<{
    year: number;
    month: number;
    selected?: DateValue;
    locale?: string;
    onSelect: (date: DateValue) => Message;
    onPreviousMonth?: Message;
    onNextMonth?: Message;
    isDateDisabled?: (date: DateValue) => boolean;
  }>,
  h: HtmlBuilder<Message>,
): Html => {
  const locale = config.locale ?? "en-US";
  const date = new Date(Date.UTC(config.year, config.month - 1, 1));
  const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  const dayCount = new Date(Date.UTC(config.year, config.month, 0)).getUTCDate();
  const offset = date.getUTCDay();
  const cells = [
    ...Array.from({ length: offset }, () => undefined),
    ...Array.from({ length: dayCount }, (_, index) => index + 1),
  ];
  return h.div(styledAttrs(config, h, styles.surface, styles.calendar), [
    h.header(sxAttrs(h, styles.calendarHeader), [
      h.button([
        ...sxAttrs(h, styles.pageButton, styles.focusable),
        h.Type("button"),
        h.AriaLabel("Previous month"),
        ...(config.onPreviousMonth === undefined ? [h.Disabled(true)] : [h.OnClick(config.onPreviousMonth)]),
      ], ["‹"]),
      h.div([...sxAttrs(h, styles.title), h.AriaLive("polite")], [label]),
      h.button([
        ...sxAttrs(h, styles.pageButton, styles.focusable),
        h.Type("button"),
        h.AriaLabel("Next month"),
        ...(config.onNextMonth === undefined ? [h.Disabled(true)] : [h.OnClick(config.onNextMonth)]),
      ], ["›"]),
    ]),
    h.div([...sxAttrs(h, styles.calendarGrid), h.Role("grid"), h.AriaLabel(label)], [
      ...["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) =>
        h.div([...sxAttrs(h, styles.description), h.Role("columnheader"), h.AriaLabel(day)], [day])),
      ...cells.map((day, index) => {
        if (day === undefined) return h.div([h.Key(`empty-${index}`), h.Role("gridcell")]);
        const value = { year: config.year, month: config.month, day };
        const isSelected = config.selected !== undefined && key(config.selected) === key(value);
        const isDisabled = config.isDateDisabled?.(value) === true;
        return h.button([
          ...sxAttrs(h, styles.calendarCell, styles.focusable, isSelected && styles.calendarCellSelected),
          h.Key(key(value)),
          h.Type("button"),
          h.Role("gridcell"),
          h.AriaSelected(isSelected),
          h.Disabled(isDisabled),
          h.OnClick(config.onSelect(value)),
        ], [String(day)]);
      }),
    ]),
  ]);
};

export const Calendar = { view: calendar, key } as const;
