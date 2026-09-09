import type * as Tabs from "@foldkit/ui/tabs";
import type { HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "../catalog.styles";
import { styledAttrs, type Children, type StyledConfig } from "../catalog.shared";
import { sxAttrs } from "../sx";
import { statefulStyles } from "../stateful.styles";

export * from "@foldkit/ui/tabs";

export type Tab<Value extends string> = Readonly<{
  value: Value;
  label: string;
  content: Children;
  isDisabled?: boolean;
}>;

export type StyledViewInputs<Message, Value extends string> = StyledConfig<Message> & Readonly<{
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
  toView: ({ tablist, tabs }) => h.div(styledAttrs(config, h, styles.tabs), [
    h.div([
      ...tablist,
      ...sxAttrs(h, styles.tabsList, config.orientation === "Vertical" && statefulStyles.verticalTabs),
    ], tabs.map((tab) => h.button([
      ...tab.tab,
      ...sxAttrs(h, styles.tabsTrigger, styles.focusable,
        tab.isActive && styles.tabsTriggerActive, tab.isDisabled && statefulStyles.disabled),
    ], [config.tabs[tab.index]?.label ?? tab.value]))),
    ...tabs.map((tab) => h.div([
      ...tab.panel,
      h.Hidden(!tab.isActive),
    ], config.tabs[tab.index]?.content ?? [])),
  ]),
});
