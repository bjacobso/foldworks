import * as DatePicker from "@foldkit/ui/datePicker";
import type * as UiCalendar from "@foldkit/ui/calendar";
import { Option } from "effect";
import type { Calendar } from "foldkit";
import type { Attribute, ChildAttribute, HtmlBuilder } from "foldkit/html";
import * as stylex from "@stylexjs/stylex";
import { sxAttrs } from "../sx";
import { desktopStyles as styles } from "../desktop.styles";
import * as Layer from "./layer";
export * from "@foldkit/ui/datePicker";
export const calendarView = <Message>(
  attributes: UiCalendar.CalendarAttributes,
  h: HtmlBuilder<Message>,
) => {
  const heading = h.h3(
    [h.Id(attributes.heading.id)],
    [attributes.heading.text],
  );
  const button = (
    attrs: ReadonlyArray<Attribute<Message> | ChildAttribute>,
    text: string,
  ) => h.button([...attrs, ...sxAttrs(h, styles.button)], [text]);
  return h.div(
    [...attributes.root, ...sxAttrs(h, styles.calendar)],
    [
      h.header(
        sxAttrs(h, styles.row),
        attributes._tag === "Days"
          ? [
              button(attributes.previousMonthButton, "‹"),
              button(
                [...attributes.headingButton, h.Id(attributes.heading.id)],
                attributes.heading.text,
              ),
              button(attributes.nextMonthButton, "›"),
            ]
          : attributes._tag === "Months"
            ? [
                button(
                  [...attributes.headingButton, h.Id(attributes.heading.id)],
                  attributes.heading.text,
                ),
              ]
            : [
                button(attributes.previousPageButton, "‹"),
                heading,
                button(attributes.nextPageButton, "›"),
              ],
      ),
      attributes._tag === "Days"
        ? h.div(attributes.grid, [
            h.div(
              [
                ...attributes.headerRow,
                ...sxAttrs(h, styles.week, styles.muted),
              ],
              attributes.columnHeaders.map((header) =>
                h.div(header.attributes, [header.name]),
              ),
            ),
            ...attributes.weeks.map((week) =>
              h.div(
                [...week.attributes, ...sxAttrs(h, styles.week)],
                week.cells.map((cell) =>
                  h.div(
                    [...cell.cellAttributes],
                    [
                      h.button(
                        [
                          ...cell.buttonAttributes,
                          ...sxAttrs(
                            h,
                            styles.button,
                            styles.calendarCell,
                            cell.isFocused && styles.focused,
                            cell.isSelected && styles.selected,
                          ),
                          h.Style({
                            opacity: cell.isDisabled
                              ? "0.35"
                              : cell.isInViewMonth
                                ? "1"
                                : "0.6",
                          }),
                        ],
                        [cell.label],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ])
        : h.div(
            [...attributes.grid, h.AriaRowcount(4), h.AriaColcount(3)],
            Array.from({ length: 4 }, (_, row) =>
              h.div(
                [h.Role("row"), ...sxAttrs(h, styles.months)],
                attributes.cells
                  .slice(row * 3, row * 3 + 3)
                  .map((cell) =>
                    h.div(cell.cellAttributes, [
                      h.button(
                        [
                          ...cell.buttonAttributes,
                          ...sxAttrs(
                            h,
                            styles.button,
                            styles.calendarCell,
                            cell.isSelected && styles.selected,
                            cell.isFocused && styles.focused,
                          ),
                        ],
                        [cell.label],
                      ),
                    ]),
                  ),
              ),
            ),
          ),
    ],
  );
};
export type StyledViewInputs = Readonly<{
  value: Calendar.CalendarDate | null;
  label: string;
  format?: (date: Calendar.CalendarDate) => string;
  name?: string;
  isDisabled?: boolean;
  anchor?: Layer.AnchorConfig;
}>;
export const styledViewInputs = <Message>(
  config: StyledViewInputs,
  h: HtmlBuilder<Message>,
): DatePicker.ViewInputs => ({
  maybeSelectedDate: Option.fromNullishOr(config.value),
  anchor: Layer.anchor(config.anchor),
  ariaLabel: config.label,
  triggerContent: (value) =>
    h.span(
      [],
      [
        Option.isSome(value)
          ? (config.format?.(value.value) ??
            `${value.value.year}-${String(value.value.month).padStart(2, "0")}-${String(value.value.day).padStart(2, "0")}`)
          : "Choose date",
      ],
    ),
  toCalendarView: (attrs) => calendarView(attrs, h),
  triggerClassName: Layer.classNames.trigger,
  panelClassName: `${Layer.classNames.panel} ${stylex.props(styles.calendar).className ?? ""}`,
  backdropClassName: Layer.classNames.backdrop,
  ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
  ...(config.name === undefined || config.isDisabled
    ? {}
    : { name: config.name }),
});
