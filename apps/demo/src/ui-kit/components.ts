import { Stateful } from "@foldworks/ui";
import type { DemoAction, Department, Tool, View } from "./model";

export const AccountTabs = Stateful.Tabs.create<View>();
export const DepartmentSelect = Stateful.Select.create<Department>();
export const ActionMenu = Stateful.Menu.create<DemoAction>();
export const DepartmentCombobox = Stateful.Combobox.create<Department>();
export const ToolCombobox = Stateful.Combobox.Multi.create<Tool>();
