import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import * as UI from "./index";

const officialComponentNames = [
  "Accordion", "Alert", "AlertDialog", "AspectRatio", "Attachment", "Avatar",
  "Badge", "Breadcrumb", "Bubble", "Button", "ButtonGroup", "Calendar", "Card",
  "Carousel", "Chart", "Checkbox", "Collapsible", "Combobox", "Command",
  "ContextMenu", "Dialog", "Direction", "Drawer", "DropdownMenu", "Empty", "Field",
  "Form", "HoverCard", "Input", "InputGroup", "InputOtp", "Item", "Kbd", "Label",
  "Marker", "Menubar", "Message", "MessageScroller", "NativeSelect", "NavigationMenu",
  "Pagination", "Popover", "Progress", "RadioGroup", "Resizable", "ScrollArea", "Select",
  "Separator", "Sheet", "Sidebar", "Skeleton", "Slider", "Sonner", "Spinner", "Switch",
  "Table", "Tabs", "Textarea", "Toggle", "ToggleGroup", "Tooltip",
] as const;

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

const attr = (html: Html, selector: string, name: string) =>
  Option.getOrUndefined(Scene.attr(find(html, selector), name));

describe("shadcn-equivalent component catalog", () => {
  it("exports every current shadcn UI component as a Foldworks view", () => {
    const exports = UI as unknown as Record<string, Readonly<{ view?: unknown }>>;

    for (const name of officialComponentNames) {
      expect(exports[name], name).toBeDefined();
      expect(exports[name]?.view, `${name}.view`).toBeTypeOf("function");
    }
  });

  it("exposes Foldkit state machines for behavior-rich component families", () => {
    for (const component of [
      UI.Headless.Calendar,
      UI.Headless.Combobox,
      UI.Headless.Dialog,
      UI.Headless.Disclosure,
      UI.Headless.Menu,
      UI.Headless.Popover,
      UI.Headless.RadioGroup,
      UI.Headless.Select,
      UI.Headless.Slider,
      UI.Headless.Tabs,
      UI.Headless.Toast,
      UI.Headless.Tooltip,
    ]) {
      expect(Object.values(component).some((value) => typeof value === "function")).toBe(true);
    }
  });

  it("renders semantic feedback and progress", () => {
    const alert = UI.Alert.view({ title: "Heads up", description: "Review this change." }, h);
    const progress = UI.Progress.view({ value: 42, ariaLabel: "Upload progress" }, h);

    expect(attr(alert, "div", "role")).toBe("status");
    expect(attr(progress, "div", "role")).toBe("progressbar");
    expect(attr(progress, "div", "aria-valuenow")).toBe("42");
  });

  it("renders labelled tabs and dialog surfaces", () => {
    const tabs = UI.Tabs.view({
      id: "settings",
      value: "profile",
      onChange: () => undefined as never,
      tabs: [
        { value: "profile", label: "Profile", content: ["Profile content"] },
        { value: "billing", label: "Billing", content: ["Billing content"] },
      ],
    }, h);
    const dialog = UI.Dialog.view({
      id: "edit-profile",
      title: "Edit profile",
      description: "Change your public details.",
      children: ["Form"],
      isOpen: true,
      onOpenChange: () => undefined as never,
    }, h);

    expect(attr(tabs, '[role="tablist"]', "aria-label")).toBe("Tabs");
    expect(attr(tabs, '[role="tab"]', "aria-selected")).toBe("true");
    expect(attr(dialog, "dialog", "aria-labelledby")).toBe("edit-profile-title");
    expect(attr(dialog, "dialog", "aria-describedby")).toBe("edit-profile-description");
  });

  it("renders grouped menu and calendar semantics", () => {
    const menu = UI.DropdownMenu.view({
      id: "actions",
      trigger: ["Actions"],
      isOpen: true,
      onOpenChange: () => undefined as never,
      groups: [{ items: [{ id: "edit", label: "Edit", onSelect: undefined as never }] }],
    }, h);
    const calendar = UI.Calendar.view({
      year: 2026,
      month: 9,
      selected: { year: 2026, month: 9, day: 4 },
      onSelect: () => undefined as never,
    }, h);

    expect(attr(menu, '[role="menu"]', "role")).toBe("menu");
    expect(attr(menu, '[role="menuitem"]', "data-menu-item-id")).toBe("edit");
    expect(attr(calendar, '[role="grid"]', "role")).toBe("grid");
    expect(attr(calendar, '[aria-selected="true"]', "aria-selected")).toBe("true");
  });
});

export { officialComponentNames };
