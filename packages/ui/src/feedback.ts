import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import {
  clamp,
  rootAttrs,
  slotAttrs,
  styledAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { sxAttrs } from "./sx";

export type ProgressTone = "default" | "success" | "warning" | "danger" | "info";
export type ProgressSlot = "root" | "track" | "indicator" | "caption";

export type ProgressConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, ProgressSlot> &
  Readonly<{
    value?: number;
    max?: number;
    ariaLabel: string;
    size?: "sm" | "md";
    tone?: ProgressTone;
    /** Visible text beside the bar, such as `"2 / 9"`; also announced as `aria-valuetext`. */
    caption?: string;
  }>;

const progressTones = {
  default: undefined,
  success: styles.progressSuccess,
  warning: styles.progressWarning,
  danger: styles.progressDanger,
  info: styles.progressInfo,
} as const;

const progress = <Message>(config: ProgressConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const max = config.max ?? 100;
  const value = config.value === undefined ? undefined : clamp(config.value, 0, max);
  const slots = config.slotProps;
  const trackStyles = [styles.progress, config.size === "sm" && styles.progressSm] as const;
  const indicator =
    value === undefined
      ? []
      : [
          h.div([
            ...slotAttrs(
              slots?.indicator,
              h,
              styles.progressIndicator,
              progressTones[config.tone ?? "default"],
            ),
            h.Style({ width: `${(value / max) * 100}%` }),
          ]),
        ];
  const semantics = [
    h.Role("progressbar"),
    h.AriaLabel(config.ariaLabel),
    h.AriaValuemin(0),
    h.AriaValuemax(max),
    ...(value === undefined ? [] : [h.AriaValuenow(value)]),
    ...(config.caption === undefined ? [] : [h.AriaValuetext(config.caption)]),
  ];
  if (config.caption === undefined) {
    return h.div(
      [
        ...rootAttrs(config, h, ...trackStyles, slots?.track?.sx),
        ...(slots?.track?.attributes ?? []),
        ...semantics,
      ],
      indicator,
    );
  }
  return h.div(
    [...rootAttrs(config, h, styles.progressMeter), ...semantics],
    [
      h.div(slotAttrs(slots?.track, h, ...trackStyles, styles.progressTrack), indicator),
      h.span(
        [...slotAttrs(slots?.caption, h, styles.progressCaption), h.AriaHidden(true)],
        [config.caption],
      ),
    ],
  );
};

const skeleton = <Message>(
  config: StyledConfig<Message> & Readonly<{ label?: string; width?: string; height?: string }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div([
    ...styledAttrs(config, h, styles.skeleton),
    h.AriaHidden(config.label === undefined),
    ...(config.label === undefined ? [] : [h.Role("status"), h.AriaLabel(config.label)]),
    ...(config.width === undefined && config.height === undefined
      ? []
      : [
          h.Style({
            ...(config.width === undefined ? {} : { width: config.width }),
            ...(config.height === undefined ? {} : { height: config.height }),
          }),
        ]),
  ]);

const spinner = <Message>(
  config: StyledConfig<Message> & Readonly<{ label?: string }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.span([
    ...styledAttrs(config, h, styles.spinner),
    h.Role("status"),
    h.AriaLabel(config.label ?? "Loading"),
  ]);

export type Toast = Readonly<{
  id: string;
  title: string;
  description?: string;
  tone?: "default" | "danger";
  action?: Readonly<{ label: string; onClick: unknown }>;
}>;

const sonner = <Message>(
  config: StyledConfig<Message> &
    Readonly<{
      toasts: ReadonlyArray<
        Omit<Toast, "action"> & Readonly<{ action?: Readonly<{ label: string; onClick: Message }> }>
      >;
      onDismiss?: (id: string) => Message;
    }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [...styledAttrs(config, h), h.AriaLive("polite"), h.AriaRelevant("additions removals")],
    config.toasts.map((toast) =>
      h.div(
        [
          ...sxAttrs(
            h,
            styles.surface,
            styles.alert,
            toast.tone === "danger" && styles.alertDanger,
          ),
          h.DataAttribute("toast-id", toast.id),
        ],
        [
          h.div(sxAttrs(h, styles.title), [toast.title]),
          ...(toast.description === undefined
            ? []
            : [h.p(sxAttrs(h, styles.description), [toast.description])]),
          ...(toast.action === undefined
            ? []
            : [
                h.button(
                  [...sxAttrs(h, styles.menuItem), h.OnClick(toast.action.onClick)],
                  [toast.action.label],
                ),
              ]),
          ...(config.onDismiss === undefined
            ? []
            : [
                h.button(
                  [
                    ...sxAttrs(h, styles.menuItem),
                    h.OnClick(config.onDismiss(toast.id)),
                    h.AriaLabel(`Dismiss ${toast.title}`),
                  ],
                  ["Dismiss"],
                ),
              ]),
        ],
      ),
    ),
  );

const message = <Message>(
  config: StyledConfig<Message> &
    Readonly<{
      title?: string;
      children: Children;
      isBusy?: boolean;
    }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      ...styledAttrs(config, h, styles.inset, styles.alert),
      h.Role("status"),
      h.AriaBusy(config.isBusy === true),
    ],
    [
      ...(config.title === undefined ? [] : [h.div(sxAttrs(h, styles.title), [config.title])]),
      ...config.children,
    ],
  );

export const Progress = { view: progress } as const;
export const Skeleton = { view: skeleton } as const;
export const Spinner = { view: spinner } as const;
export const Sonner = { view: sonner } as const;
export const StatusMessage = { view: message } as const;
