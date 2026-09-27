import { Minus, Plus } from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Icon from "./icon";
import { rootAttrs, slotAttrs, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { catalogStyles } from "./catalog.styles";
import { primitiveStyles as styles } from "./primitive.styles";
import * as ReadOnlyValue from "./read-only-value";

const decimalPlaces = (value: number): number => {
  const text = String(value).toLocaleLowerCase();
  if (text.includes("e-")) return Number(text.split("e-")[1] ?? 0);
  return text.includes(".") ? (text.split(".")[1]?.length ?? 0) : 0;
};

export const normalize = (
  value: number,
  config: Readonly<{ min?: number; max?: number; step?: number }> = {},
): number => {
  const bounded = Math.min(config.max ?? Infinity, Math.max(config.min ?? -Infinity, value));
  const precision = Math.max(decimalPlaces(config.step ?? 1), decimalPlaces(config.min ?? 0));
  return Number(bounded.toFixed(Math.min(12, precision)));
};

export const stepValue = (
  value: number | undefined,
  direction: -1 | 1,
  config: Readonly<{ min?: number; max?: number; step?: number }> = {},
): number => {
  const step = Number.isFinite(config.step) && (config.step ?? 0) > 0 ? (config.step ?? 1) : 1;
  const origin = value ?? (direction > 0 ? (config.min ?? 0) : (config.max ?? 0));
  return normalize(origin + direction * step, config);
};

export type Slot =
  | "root"
  | "label"
  | "control"
  | "decrement"
  | "input"
  | "increment"
  | "description";

export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    id: string;
    value?: number;
    onChange: (value: number | undefined) => Message;
    label?: string;
    ariaLabel?: string;
    description?: string;
    min?: number;
    max?: number;
    step?: number;
    name?: string;
    placeholder?: string;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    isRequired?: boolean;
    isInvalid?: boolean;
    /** `"value"` shows the number as a read-only answer, without stepper buttons. */
    presentation?: ReadOnlyValue.Presentation;
    /** Formats the read-only answer, for example with `Intl.NumberFormat`. Defaults to `String`. */
    formatValue?: (value: number) => string;
  }>;

const valueView = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const labelId = `${config.id}-label`;
  const descriptionId = `${config.id}-description`;
  return h.div(rootAttrs(config, h, styles.numberRoot), [
    ...(config.label === undefined
      ? []
      : [
          h.span(
            [h.Id(labelId), ...slotAttrs(config.slotProps?.label, h, catalogStyles.label)],
            [config.label, ...(config.isRequired === true ? [" *"] : [])],
          ),
        ]),
    ReadOnlyValue.view(
      {
        ...(config.value === undefined
          ? {}
          : {
              value: (config.formatValue ?? String)(config.value),
              formValue: String(config.value),
            }),
        ...(config.label !== undefined || config.ariaLabel === undefined
          ? {}
          : { ariaLabel: config.ariaLabel }),
        ...(config.label === undefined ? {} : { ariaLabelledBy: labelId }),
        ...(config.description === undefined ? {} : { ariaDescribedBy: descriptionId }),
        ...(config.name === undefined || config.isDisabled === true ? {} : { name: config.name }),
        ...(config.isInvalid === undefined ? {} : { isInvalid: config.isInvalid }),
        ...(config.slotProps?.input === undefined
          ? {}
          : { slotProps: { root: config.slotProps.input } }),
        id: config.id,
      },
      h,
    ),
    ...(config.description === undefined
      ? []
      : [
          h.p(
            [
              h.Id(descriptionId),
              ...slotAttrs(config.slotProps?.description, h, catalogStyles.description),
            ],
            [config.description],
          ),
        ]),
  ]);
};

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  if (config.label === undefined && config.ariaLabel === undefined) {
    throw new Error("NumberField requires label or ariaLabel.");
  }
  if (config.presentation === "value") return valueView(config, h);
  const descriptionId = `${config.id}-description`;
  const canDecrease =
    config.value === undefined || config.min === undefined || config.value > config.min;
  const canIncrease =
    config.value === undefined || config.max === undefined || config.value < config.max;
  return h.div(rootAttrs(config, h, styles.numberRoot), [
    ...(config.label === undefined
      ? []
      : [
          h.label(
            [h.For(config.id), ...slotAttrs(config.slotProps?.label, h, catalogStyles.label)],
            [config.label, ...(config.isRequired === true ? [" *"] : [])],
          ),
        ]),
    h.div(slotAttrs(config.slotProps?.control, h, styles.numberControl), [
      h.button(
        [
          ...slotAttrs(
            config.slotProps?.decrement,
            h,
            styles.numberButton,
            styles.numberButtonStart,
            catalogStyles.focusable,
          ),
          h.Type("button"),
          h.AriaLabel(`Decrease ${config.label ?? config.ariaLabel}`),
          h.Disabled(config.isDisabled === true || config.isReadOnly === true || !canDecrease),
          h.OnClick(config.onChange(stepValue(config.value, -1, config))),
        ],
        [Icon.view({ icon: Minus, size: 14 }, h)],
      ),
      h.input([
        ...slotAttrs(
          config.slotProps?.input,
          h,
          catalogStyles.control,
          catalogStyles.focusable,
          styles.numberInput,
        ),
        h.Id(config.id),
        h.Type("number"),
        h.InputMode("decimal"),
        ...(config.value === undefined ? [] : [h.Value(String(config.value))]),
        ...(config.label === undefined ? [h.AriaLabel(config.ariaLabel ?? "Number")] : []),
        ...(config.description === undefined ? [] : [h.AriaDescribedBy(descriptionId)]),
        ...(config.name === undefined ? [] : [h.Name(config.name)]),
        ...(config.placeholder === undefined ? [] : [h.Placeholder(config.placeholder)]),
        ...(config.min === undefined ? [] : [h.Min(String(config.min))]),
        ...(config.max === undefined ? [] : [h.Max(String(config.max))]),
        h.Step(String(config.step ?? 1)),
        h.Disabled(config.isDisabled === true),
        h.Readonly(config.isReadOnly === true),
        h.Required(config.isRequired === true),
        h.AriaInvalid(config.isInvalid === true),
        h.OnInput((raw) => {
          const parsed = raw.trim() === "" ? undefined : Number(raw);
          return config.onChange(
            parsed === undefined || !Number.isFinite(parsed)
              ? undefined
              : normalize(parsed, config),
          );
        }),
      ]),
      h.button(
        [
          ...slotAttrs(
            config.slotProps?.increment,
            h,
            styles.numberButton,
            styles.numberButtonEnd,
            catalogStyles.focusable,
          ),
          h.Type("button"),
          h.AriaLabel(`Increase ${config.label ?? config.ariaLabel}`),
          h.Disabled(config.isDisabled === true || config.isReadOnly === true || !canIncrease),
          h.OnClick(config.onChange(stepValue(config.value, 1, config))),
        ],
        [Icon.view({ icon: Plus, size: 14 }, h)],
      ),
    ]),
    ...(config.description === undefined
      ? []
      : [
          h.p(
            [
              h.Id(descriptionId),
              ...slotAttrs(config.slotProps?.description, h, catalogStyles.description),
            ],
            [config.description],
          ),
        ]),
  ]);
};

export const NumberField = { view, normalize, stepValue } as const;
