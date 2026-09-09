import { Stateful } from "@foldworks/ui";
import type { Department, View } from "./model";

export const AccountTabs = Stateful.Tabs.create<View>();
export const DepartmentSelect = Stateful.Select.create<Department>();
