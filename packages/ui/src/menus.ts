import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import {
  rootAttrs,
  slotAttrs,
  styledAttrs,
  type Children,
  type SlotProps,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { sxAttrs } from "./sx";

export type MenuItem<Message> = Readonly<{
  id: string;
  label: string;
  media?: Html;
  shortcut?: string;
  isDisabled?: boolean;
  isDestructive?: boolean;
  onSelect: Message;
}>;

export type MenuGroup<Message> = Readonly<{
  label?: string;
  items: ReadonlyArray<MenuItem<Message>>;
}>;

type MenuContentSlot = "menu" | "group" | "groupLabel" | "item" | "shortcut";
type MenuContentSlotProps<Message> = Readonly<Partial<Record<MenuContentSlot, SlotProps<Message>>>>;

const menuContent = <Message>(
  groups: ReadonlyArray<MenuGroup<Message>>,
  h: HtmlBuilder<Message>,
  slotProps: MenuContentSlotProps<Message> | undefined,
): Html => h.div([...slotAttrs(slotProps?.menu, h, styles.floating), h.Role("menu")], groups.flatMap((group) => [
  ...(group.label === undefined ? [] : [h.div([...slotAttrs(slotProps?.groupLabel, h, styles.menuLabel), h.Role("presentation")], [group.label])]),
  h.div([...slotAttrs(slotProps?.group, h), h.Role("group")], group.items.map((item) => h.button([
    ...slotAttrs(slotProps?.item, h, styles.menuItem, styles.focusable),
    h.Type("button"),
    h.Role("menuitem"),
    h.Disabled(item.isDisabled === true),
    h.OnClick(item.onSelect),
    h.DataAttribute("menu-item-id", item.id),
    ...(item.isDestructive === true ? [h.Style({ color: "var(--destructive)" })] : []),
  ], [
    ...(item.media === undefined ? [] : [item.media]),
    item.label,
    ...(item.shortcut === undefined ? [] : [h.span([
      ...slotAttrs(slotProps?.shortcut, h),
      h.Style({ marginLeft: "auto", opacity: "0.65" }),
    ], [item.shortcut])]),
  ]))),
]));

export type DropdownMenuSlot = "root" | "trigger" | MenuContentSlot;
export type DropdownMenuConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, DropdownMenuSlot> & Readonly<{
  id: string;
  trigger: Children;
  groups: ReadonlyArray<MenuGroup<Message>>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => Message;
  ariaLabel?: string;
}>;

const dropdownMenu = <Message>(
  config: DropdownMenuConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.div(rootAttrs(config, h), [
  h.button([
    ...slotAttrs(config.slotProps?.trigger, h, styles.toggle, styles.focusable),
    h.Type("button"),
    h.AriaHasPopup("menu"),
    h.AriaExpanded(config.isOpen),
    h.AriaControls(`${config.id}-menu`),
    h.OnClick(config.onOpenChange(!config.isOpen)),
  ], config.trigger),
  ...(config.isOpen
    ? [h.div([h.Id(`${config.id}-menu`), ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)])],
        [menuContent(config.groups, h, config.slotProps)])]
    : []),
]);

export type ContextMenuSlot = "root" | MenuContentSlot;
export type ContextMenuConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, ContextMenuSlot> & Readonly<{
  id: string;
  children: Children;
  groups: ReadonlyArray<MenuGroup<Message>>;
  isOpen: boolean;
  onOpen: Message;
}>;

const contextMenu = <Message>(
  config: ContextMenuConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [...rootAttrs(config, h), h.OnContextMenu(config.onOpen), h.AriaHasPopup("menu")],
  [
    ...config.children,
    ...(config.isOpen ? [menuContent(config.groups, h, config.slotProps)] : []),
  ],
);

export type MenubarSlot = "root" | "menuRoot" | "trigger" | MenuContentSlot;
export type MenubarConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, MenubarSlot> & Readonly<{
  menus: ReadonlyArray<Readonly<{
    id: string;
    label: string;
    groups: ReadonlyArray<MenuGroup<Message>>;
    isOpen: boolean;
    onToggle: Message;
  }>>;
  ariaLabel?: string;
}>;

const menubar = <Message>(
  config: MenubarConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [...rootAttrs(config, h, styles.inset, styles.group), h.Role("menubar"), h.AriaLabel(config.ariaLabel ?? "Application menu")],
  config.menus.map((menu) => h.div(slotAttrs(config.slotProps?.menuRoot, h), [
    h.button([
      ...slotAttrs(config.slotProps?.trigger, h, styles.menuItem, styles.focusable),
      h.Type("button"),
      h.Role("menuitem"),
      h.AriaHasPopup("menu"),
      h.AriaExpanded(menu.isOpen),
      h.OnClick(menu.onToggle),
    ], [menu.label]),
    ...(menu.isOpen ? [menuContent(menu.groups, h, config.slotProps)] : []),
  ])),
);

type CommandItem<Message> = Readonly<{
  id: string;
  label: string;
  group?: string;
  keywords?: ReadonlyArray<string>;
  media?: Html;
  isDisabled?: boolean;
  onSelect: Message;
}>;

/** @deprecated Use Stateful.Command for keyboard selection and fuzzy search. */
const command = <Message>(
  config: StyledConfig<Message> & Readonly<{
    query: string;
    items: ReadonlyArray<CommandItem<Message>>;
    onQueryChange: (query: string) => Message;
    placeholder?: string;
    emptyLabel?: string;
    ariaLabel?: string;
  }>,
  h: HtmlBuilder<Message>,
): Html => {
  const normalizedQuery = config.query.trim().toLocaleLowerCase();
  const visibleItems = config.items.filter((item) =>
    normalizedQuery === "" || [item.label, ...(item.keywords ?? [])]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
  );
  const groups = visibleItems.reduce((accumulator, item) => {
    const group = item.group ?? "Commands";
    const entries = accumulator.get(group) ?? [];
    accumulator.set(group, [...entries, item]);
    return accumulator;
  }, new Map<string, ReadonlyArray<CommandItem<Message>>>());
  return h.div(
    [...styledAttrs(config, h, styles.surface, styles.command), h.Role("combobox"), h.AriaLabel(config.ariaLabel ?? "Command menu")],
    [
      h.input([
        ...sxAttrs(h, styles.control, styles.focusable),
        h.Value(config.query),
        h.Placeholder(config.placeholder ?? "Type a command or search…"),
        h.AriaAutocomplete("list"),
        h.OnInput(config.onQueryChange),
      ]),
      h.div([...sxAttrs(h, styles.commandList), h.Role("listbox")], visibleItems.length === 0
        ? [h.div(sxAttrs(h, styles.description), [config.emptyLabel ?? "No results found."])]
        : [...groups.entries()].flatMap(([group, items]) => [
            h.div(sxAttrs(h, styles.menuLabel), [group]),
            h.div([h.Role("group"), h.AriaLabel(group)], items.map((item) => h.button([
              ...sxAttrs(h, styles.menuItem, styles.focusable),
              h.Type("button"),
              h.Role("option"),
              h.Disabled(item.isDisabled === true),
              h.OnClick(item.onSelect),
              h.DataAttribute("command-item-id", item.id),
            ], [...(item.media === undefined ? [] : [item.media]), item.label]))),
          ])),
    ],
  );
};

const combobox = <Message, Value extends string>(
  config: StyledConfig<Message> & Readonly<{
    id: string;
    value: Value | "";
    options: ReadonlyArray<Readonly<{ value: Value; label: string }>>;
    onChange: (value: string) => Message;
    placeholder?: string;
    ariaLabel: string;
    isDisabled?: boolean;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(styledAttrs(config, h), [
  h.input([
    ...sxAttrs(h, styles.control, styles.focusable),
    h.Id(config.id),
    h.Value(config.value),
    h.Placeholder(config.placeholder ?? "Search…"),
    h.AriaLabel(config.ariaLabel),
    h.Attribute("list", `${config.id}-options`),
    h.Attribute("autocomplete", "off"),
    h.Disabled(config.isDisabled === true),
    h.OnInput(config.onChange),
  ]),
  h.datalist([h.Id(`${config.id}-options`)], config.options.map((option) => h.option([
    h.Value(option.value),
    h.Attribute("label", option.label),
  ]))),
]);

export const Combobox = { view: combobox } as const;
export const Command = { view: command } as const;
export const ContextMenu = { view: contextMenu } as const;
export const DropdownMenu = { view: dropdownMenu } as const;
export const Menubar = { view: menubar } as const;
