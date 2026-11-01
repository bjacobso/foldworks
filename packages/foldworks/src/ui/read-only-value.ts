import type { Html, HtmlBuilder } from "foldkit/html";

import {
  rootAttrs,
  slotAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { contentStyles } from "./primitive.styles";
import { readOnlyValueStyles as styles } from "./styles";
import { sxAttrs } from "./sx";

/**
 * How a form control renders. `"control"` is the editable (or natively
 * `isReadOnly`) control; `"value"` shows the current answer as legible,
 * read-only text through `ReadOnlyValue`.
 */
export type Presentation = "control" | "value";

export type Slot = "root" | "empty" | "hiddenInput";

export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    /** Plain-text answer. Line breaks are preserved. */
    value?: string;
    /** Rich answer content, such as address lines. Takes precedence over `value`. */
    children?: Children;
    id?: string;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    ariaDescribedBy?: string;
    /** Visible text when there is no answer. Defaults to an em dash announced as "No value". */
    emptyLabel?: string;
    isMultiline?: boolean;
    isInvalid?: boolean;
    density?: "default" | "compact";
    /** Submit the answer with a surrounding form, as a native read-only control would. */
    name?: string;
    /** Submitted value when it differs from the displayed text, for example an option value. */
    formValue?: string;
  }>;

const isEmpty = <Message>(config: ViewConfig<Message>): boolean =>
  config.children === undefined
    ? config.value === undefined || config.value === ""
    : config.children.length === 0;

const emptyContent = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Children =>
  config.emptyLabel === undefined
    ? [
        h.span([h.AriaHidden(true)], ["—"]),
        h.span(sxAttrs(h, contentStyles.visuallyHidden), ["No value"]),
      ]
    : [config.emptyLabel];

/**
 * A read-only answer: the value stays at full contrast, remains focusable and
 * selectable, and is exposed as a read-only textbox rather than a disabled one.
 */
export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const empty = isEmpty(config);
  const submitted = config.formValue ?? config.value ?? "";
  return h.div(
    [
      ...rootAttrs(
        config,
        h,
        styles.root,
        config.density === "compact" && styles.compact,
        config.isInvalid === true && styles.invalid,
      ),
      h.Role("textbox"),
      h.AriaReadonly(true),
      h.Tabindex(0),
      h.DataAttribute("readonly", "true"),
      h.DataAttribute("empty", empty ? "true" : "false"),
      ...(config.id === undefined ? [] : [h.Id(config.id)]),
      ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)]),
      ...(config.ariaLabelledBy === undefined ? [] : [h.AriaLabelledBy(config.ariaLabelledBy)]),
      ...(config.ariaDescribedBy === undefined ? [] : [h.AriaDescribedBy(config.ariaDescribedBy)]),
      ...(config.isMultiline === true ? [h.Attribute("aria-multiline", "true")] : []),
      ...(config.isInvalid === true ? [h.AriaInvalid(true)] : []),
    ],
    [
      ...(empty
        ? [h.span(slotAttrs(config.slotProps?.empty, h, styles.empty), emptyContent(config, h))]
        : (config.children ?? [config.value ?? ""])),
      ...(config.name === undefined
        ? []
        : [
            h.input([
              ...slotAttrs(config.slotProps?.hiddenInput, h),
              h.Type("hidden"),
              h.Name(config.name),
              h.Value(submitted),
            ]),
          ]),
    ],
  );
};

/** Label of the option whose value matches, or the value itself when unmatched. Empty values have no answer. */
export const optionLabel = (
  value: string | undefined,
  options: ReadonlyArray<Readonly<{ value: string; label: string }>>,
): string | undefined =>
  value === undefined || value === ""
    ? undefined
    : (options.find((option) => option.value === value)?.label ?? value);
