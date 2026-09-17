import type * as Tabs from "@foldkit/ui/tabs";
import type { HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "../catalog.styles";
import {
  rootAttrs,
  slotAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "../catalog.shared";
import { statefulStyles } from "../stateful.styles";

export * from "@foldkit/ui/tabs";

export type Tab<Value extends string> = Readonly<{
  value: Value;
  label: string;
  content: Children;
  isDisabled?: boolean;
}>;

export type Slot = "root" | "list" | "trigger" | "panel";

export type StyledViewInputs<Message, Value extends string> =
  StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  tabs: ReadonlyArray<Tab<Value>>;
  selectedValue: Value;
  ariaLabel: string;
  orientation?: Tabs.Orientation;
}>;

/** Preserves Foldkit's keyboard handlers, focus commands, and controlled selection. */
export const styledViewInputs = <Message, Value extends string>(
  config: StyledViewInputs<Message, Value>,
  h: HtmlBuilder<Message>,
): Tabs.ViewInputs<Value> => ({
  tabs: config.tabs.map((tab) => tab.value),
  selectedValue: config.selectedValue,
  ariaLabel: config.ariaLabel,
  ...(config.orientation === undefined ? {} : { orientation: config.orientation }),
  isTabDisabled: (_value, index) => config.tabs[index]?.isDisabled === true,
  toView: ({ tablist, tabs }) => h.div(rootAttrs(config, h, styles.tabs), [
    h.div([
      ...slotAttrs(config.slotProps?.list, h, styles.tabsList,
        config.orientation === "Vertical" && statefulStyles.verticalTabs),
      ...tablist,
    ], tabs.map((tab) => h.button([
      ...slotAttrs(config.slotProps?.trigger, h, styles.tabsTrigger, styles.focusable,
        tab.isActive && styles.tabsTriggerActive, tab.isDisabled && statefulStyles.disabled),
      ...tab.tab,
    ], [config.tabs[tab.index]?.label ?? tab.value]))),
    ...tabs.map((tab) => h.div([
      ...slotAttrs(config.slotProps?.panel, h),
      ...tab.panel,
      h.Hidden(!tab.isActive),
    ], config.tabs[tab.index]?.content ?? [])),
  ]),
});
