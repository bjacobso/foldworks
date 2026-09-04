import type { Html, HtmlBuilder } from "foldkit/html";

import {
  Accordion,
  Alert,
  AlertDialog,
  AspectRatio,
  Attachment,
  Avatar,
  Breadcrumb,
  Bubble,
  Button,
  ButtonGroup,
  Calendar,
  Card,
  Carousel,
  Chart,
  Collapsible,
  Combobox,
  Command,
  ContextMenu,
  Dialog,
  Direction,
  Drawer,
  DropdownMenu,
  Empty,
  Form,
  HoverCard,
  Input,
  InputGroup,
  InputOtp,
  Item,
  Kbd,
  Label,
  Marker,
  Menubar,
  Message as ChatMessage,
  MessageScroller,
  NativeSelect,
  NavigationMenu,
  Pagination,
  Popover,
  Progress,
  RadioGroup,
  Resizable,
  ScrollArea,
  Select,
  Separator,
  Sheet,
  Sidebar,
  Skeleton,
  Slider,
  Sonner,
  Spinner,
  Table,
  Tabs,
  Textarea,
  Toggle,
  ToggleGroup,
  Tooltip,
} from "@foldworks/ui";
import { FileText, Folder, Inbox, Paperclip, Search, Settings, User } from "@lucide/icons";
import { Icon } from "@foldworks/ui";

import { Message } from "./message";
import type { Model } from "./model";
import { className, uiKitStyles as styles } from "./styles";

const action = (label: string) => Message.ClickedAction({ action: label });
const toggleComponent = (component: string, isOpen: boolean) =>
  Message.ToggledComponent({ component, isOpen });

const section = (
  title: string,
  children: ReadonlyArray<Html | string>,
  h: HtmlBuilder<Message>,
  wide = false,
): Html => h.section([
  h.Class(className(styles.catalogSection, wide ? styles.catalogSectionWide : {})),
], [
  h.h3([h.Class(className(styles.catalogHeading))], [title]),
  ...children,
]);

const dataDisplay = (model: Model, h: HtmlBuilder<Message>): Html => section("Data display and feedback", [
  Alert.view({ title: "Deployment ready", description: "All checks completed successfully." }, h),
  Alert.view({ title: "Payment failed", description: "Update the card on file.", tone: "danger" }, h),
  h.div([h.Class(className(styles.catalogRow))], [
    Avatar.view({ alt: "Maya Chen", fallback: "MC", size: "lg" }, h),
    Kbd.view({ keys: ["⌘", "K"] }, h),
    Spinner.view({ label: "Syncing" }, h),
  ]),
  Progress.view({ value: model.sliderValue, ariaLabel: "Project completion" }, h),
  Skeleton.view({ label: "Loading account summary", height: "36px" }, h),
  Card.view({
    title: "Team plan",
    description: "A complete card composition.",
    children: ["12 active members"],
    footer: [Button.view({ label: "Manage", size: "sm", variant: "outline", onClick: action("Manage team") }, h)],
  }, h),
  Item.view({
    media: Icon.view({ icon: FileText, size: 18 }, h),
    title: "Quarterly report.pdf",
    description: "2.4 MB · Updated now",
    actions: [Button.view({ label: "Open", size: "sm", variant: "ghost", onClick: action("Open report") }, h)],
  }, h),
  AspectRatio.view({
    ratio: 3 / 1,
    children: [h.div([h.Class(className(styles.catalogMedia))], ["Aspect ratio · 3:1"])],
  }, h),
  Chart.view({ ariaLabel: "Monthly revenue", values: [34, 72, 56, 91, 68] }, h),
  Table.view({
    caption: "Recent invoices",
    columns: ["Invoice", "Status", "Amount"],
    rows: [["INV-024", "Paid", "$320"], ["INV-025", "Pending", "$180"]],
  }, h),
  Empty.view({
    media: Icon.view({ icon: Inbox, size: 18 }, h),
    title: "No messages",
    description: "New conversations will appear here.",
    actions: [Button.view({ label: "Compose", size: "sm", onClick: action("Compose") }, h)],
  }, h),
  Sonner.view({
    toasts: [{ id: "saved", title: "Changes saved", description: "Your workspace is up to date." }],
  }, h),
  Separator.view({ decorative: false }, h),
], h);

const forms = (model: Model, h: HtmlBuilder<Message>): Html => section("Forms and selection", [
  Form.view({
    ariaLabel: "Component form example",
    onSubmit: action("Submit form"),
    children: [
      Label.view({ for: "catalog-input", children: ["Project name"] }, h),
      Input.view({
        id: "catalog-input",
        value: model.name,
        placeholder: "Project name",
        onInput: (value) => Message.ChangedName({ value }),
      }, h),
    ],
  }, h),
  InputGroup.view({
    prefix: [Icon.view({ icon: Search, size: 15 }, h)],
    control: InputGroup.input({
      ariaLabel: "Search projects",
      placeholder: "Search projects",
      value: model.commandQuery,
      onInput: (value) => Message.ChangedCommandQuery({ value }),
    }, h),
    suffix: [Kbd.view({ keys: ["/"] }, h)],
  }, h),
  Textarea.view({
    ariaLabel: "Project description",
    value: model.notes,
    onInput: (value) => Message.ChangedNotes({ value }),
  }, h),
  NativeSelect.view({
    value: model.department,
    ariaLabel: "Native department select",
    onChange: (value) => Message.SelectedDepartment({ value: value === "Engineering" || value === "Operations" ? value : "People" }),
    options: ["Engineering", "Operations", "People"].map((value) => ({ value, label: value })),
  }, h),
  Select.view({
    id: "catalog-select",
    value: model.department,
    ariaLabel: "Custom department select",
    isOpen: model.openComponent === "Select",
    onOpenChange: (isOpen) => toggleComponent("Select", isOpen),
    onChange: (value) => Message.SelectedDepartment({ value: value === "Engineering" || value === "Operations" ? value : "People" }),
    options: ["Engineering", "Operations", "People"].map((value) => ({ value, label: value })),
  }, h),
  InputOtp.view({
    value: model.otp,
    length: 6,
    onInput: (value) => Message.ChangedOtp({ value }),
  }, h),
  RadioGroup.view({
    name: "catalog-department",
    value: model.department,
    ariaLabel: "Catalog department",
    onChange: (value) => Message.SelectedDepartment({ value }),
    options: [
      { value: "Engineering", label: "Engineering" },
      { value: "Operations", label: "Operations" },
      { value: "People", label: "People" },
    ],
  }, h),
  Slider.view({
    value: model.sliderValue,
    ariaLabel: "Completion",
    onChange: (value) => Message.ChangedSlider({ value }),
  }, h),
  h.div([h.Class(className(styles.catalogRow))], [
    Toggle.view({
      label: "Bold",
      isPressed: model.termsAccepted,
      onToggle: (isChecked) => Message.ToggledTerms({ isChecked }),
    }, h),
    ToggleGroup.view({
      values: [model.selectedView],
      ariaLabel: "Density",
      onChange: (values) => Message.SelectedView({ value: values[0] ?? "Overview" }),
      options: [
        { value: "Overview", label: "Comfortable" },
        { value: "Details", label: "Compact" },
        { value: "Activity", label: "Dense" },
      ],
    }, h),
  ]),
  ButtonGroup.view({
    ariaLabel: "Alignment",
    children: [
      Button.view({ label: "Left", size: "sm", variant: "outline", onClick: action("Align left") }, h),
      Button.view({ label: "Center", size: "sm", variant: "outline", onClick: action("Align center") }, h),
      Button.view({ label: "Right", size: "sm", variant: "outline", onClick: action("Align right") }, h),
    ],
  }, h),
], h);

const navigation = (model: Model, h: HtmlBuilder<Message>): Html => section("Navigation", [
  Breadcrumb.view({ items: [{ label: "Home", href: "#" }, { label: "Settings", href: "#" }], current: "Billing" }, h),
  NavigationMenu.view({ items: [{ label: "Products", href: "#" }, { label: "Docs", href: "#" }, { label: "Pricing", href: "#" }] }, h),
  Pagination.view({ page: model.page, pageCount: 4, onChange: (page) => Message.SelectedPage({ page }) }, h),
  Tabs.view({
    id: "catalog-tabs",
    value: model.selectedView,
    onChange: (value) => Message.SelectedView({ value }),
    tabs: [
      { value: "Overview", label: "Overview", content: ["Account overview"] },
      { value: "Details", label: "Details", content: ["Account details"] },
      { value: "Activity", label: "Activity", content: ["Recent activity"] },
    ],
  }, h),
  h.div([h.Class(className(styles.catalogSidebar))], [Sidebar.view({
    header: [h.strong([], ["Acme"] )],
    groups: [{ label: "Workspace", items: [
      { label: "Overview", href: "#", isCurrent: true, media: Icon.view({ icon: Folder, size: 15 }, h) },
      { label: "Settings", href: "#", media: Icon.view({ icon: Settings, size: 15 }, h) },
    ] }],
    footer: ["maya@example.com"],
  }, h)]),
], h);

const disclosureAndLayout = (model: Model, h: HtmlBuilder<Message>): Html => section("Disclosure and layout", [
  Accordion.view({ items: [
    {
      id: "catalog-accordion-one",
      label: "Is it accessible?",
      isOpen: model.isDetailsOpen,
      onToggle: (isOpen) => Message.ToggledDetails({ isOpen }),
      children: ["Yes. Keyboard and ARIA behavior comes from Foldkit."],
    },
    {
      id: "catalog-accordion-two",
      label: "Can it be themed?",
      isOpen: false,
      onToggle: (isOpen) => Message.ToggledDetails({ isOpen }),
      children: ["Yes. Every color resolves through semantic CSS variables."],
    },
  ] }, h),
  Collapsible.view({
    id: "catalog-collapsible",
    label: "Advanced options",
    isOpen: model.openComponent === "Collapsible",
    onToggle: (isOpen) => toggleComponent("Collapsible", isOpen),
    children: ["Additional configuration"],
  }, h),
  Carousel.view({
    id: "catalog-carousel",
    slides: [1, 2, 3].map((value) => ({
      label: `Slide ${value}`,
      content: [h.div([h.Class(className(styles.catalogTile))], [`Carousel slide ${value}`])],
    })),
  }, h),
  Resizable.view({ ariaLabel: "Resizable panel", children: [h.div([h.Class(className(styles.catalogTile))], ["Drag the bottom-right corner"])] }, h),
  ScrollArea.view({
    ariaLabel: "Release notes",
    maxHeight: "120px",
    children: [h.div([h.Class(className(styles.catalogScrollContent))],
      Array.from({ length: 8 }, (_, index) => h.div([h.Class(className(styles.catalogScrollItem))], [`Release note ${index + 1}`]))),
    ],
  }, h),
  Direction.view({ direction: "rtl", children: [h.div([h.Class(className(styles.catalogTile))], ["Right-to-left direction scope"])] }, h),
], h);

const overlayDialog = (
  kind: "Dialog" | "AlertDialog" | "Sheet" | "Drawer",
  model: Model,
  h: HtmlBuilder<Message>,
): Html => {
  const component = kind === "Dialog" ? Dialog : kind === "AlertDialog" ? AlertDialog : kind === "Sheet" ? Sheet : Drawer;
  return component.view({
    id: `catalog-${kind.toLocaleLowerCase()}`,
    title: kind === "AlertDialog" ? "Delete project?" : `${kind} example`,
    description: kind === "AlertDialog" ? "This action cannot be undone." : "A controlled overlay owned by the parent model.",
    children: ["Overlay content"],
    isOpen: model.openComponent === kind,
    onOpenChange: (isOpen) => toggleComponent(kind, isOpen),
    footer: [Button.view({ label: "Close", variant: "outline", onClick: toggleComponent(kind, false) }, h)],
  }, h);
};

const overlaysAndMenus = (model: Model, h: HtmlBuilder<Message>): Html => {
  const menuGroups = [{ label: "Actions", items: [
    { id: "edit", label: "Edit", onSelect: action("Edit") },
    { id: "duplicate", label: "Duplicate", onSelect: action("Duplicate") },
    { id: "delete", label: "Delete", isDestructive: true, onSelect: action("Delete") },
  ] }];
  return section("Overlays, menus, and command", [
    h.div([h.Class(className(styles.catalogOverlayButtons))], [
      ...(["Dialog", "AlertDialog", "Sheet", "Drawer"] as const).map((kind) =>
        Button.view({ label: kind, size: "sm", variant: "outline", onClick: toggleComponent(kind, true) }, h)),
    ]),
    overlayDialog("Dialog", model, h),
    overlayDialog("AlertDialog", model, h),
    overlayDialog("Sheet", model, h),
    overlayDialog("Drawer", model, h),
    h.div([h.Class(className(styles.catalogRow))], [
      Popover.view({
        id: "catalog-popover",
        trigger: ["Popover"],
        content: ["Contextual settings"],
        isOpen: model.openComponent === "Popover",
        onOpenChange: (isOpen) => toggleComponent("Popover", isOpen),
      }, h),
      HoverCard.view({
        id: "catalog-hover-card",
        trigger: ["Hover card"],
        content: ["Preview account details"],
        isOpen: model.openComponent === "HoverCard",
        onOpenChange: (isOpen) => toggleComponent("HoverCard", isOpen),
      }, h),
      Tooltip.view({
        id: "catalog-tooltip",
        trigger: ["Tooltip"],
        label: "Helpful context",
        isOpen: model.openComponent === "Tooltip",
        onOpenChange: (isOpen) => toggleComponent("Tooltip", isOpen),
      }, h),
      DropdownMenu.view({
        id: "catalog-dropdown",
        trigger: ["Dropdown menu"],
        groups: menuGroups,
        isOpen: model.openComponent === "DropdownMenu",
        onOpenChange: (isOpen) => toggleComponent("DropdownMenu", isOpen),
      }, h),
    ]),
    ContextMenu.view({
      id: "catalog-context",
      groups: menuGroups,
      isOpen: model.openComponent === "ContextMenu",
      onOpen: toggleComponent("ContextMenu", true),
      children: [h.div([h.Class(className(styles.catalogTile))], ["Right-click for the context menu"] )],
    }, h),
    Menubar.view({
      menus: ["File", "Edit", "View"].map((label) => ({
        id: label.toLocaleLowerCase(),
        label,
        groups: menuGroups,
        isOpen: model.openComponent === `Menubar${label}`,
        onToggle: toggleComponent(`Menubar${label}`, model.openComponent !== `Menubar${label}`),
      })),
    }, h),
    Command.view({
      query: model.commandQuery,
      onQueryChange: (value) => Message.ChangedCommandQuery({ value }),
      items: [
        { id: "profile", label: "Open profile", group: "Navigation", media: Icon.view({ icon: User, size: 15 }, h), onSelect: action("Open profile") },
        { id: "settings", label: "Open settings", group: "Navigation", media: Icon.view({ icon: Settings, size: 15 }, h), onSelect: action("Open settings") },
      ],
    }, h),
    Combobox.view({
      id: "catalog-combobox",
      value: model.commandQuery,
      ariaLabel: "Select framework",
      placeholder: "Select framework",
      onChange: (value) => Message.ChangedCommandQuery({ value }),
      options: [{ value: "Foldkit", label: "Foldkit" }, { value: "React", label: "React" }],
    }, h),
  ], h, true);
};

const calendarAndMessages = (model: Model, h: HtmlBuilder<Message>): Html => section("Calendar and messages", [
  Calendar.view({
    year: 2026,
    month: 9,
    selected: { year: 2026, month: 9, day: model.selectedCalendarDay },
    onSelect: ({ day }) => Message.SelectedCalendarDay({ day }),
  }, h),
  MessageScroller.view({ children: [
    ChatMessage.view({
      author: "Maya",
      avatar: Avatar.view({ alt: "Maya", fallback: "MC" }, h),
      children: ["Can you review the ", Marker.view({ children: ["launch plan"] }, h), " today?"],
    }, h),
    ChatMessage.view({
      author: "You",
      isOwn: true,
      children: ["Yes — I’ll leave comments before noon."],
    }, h),
    Attachment.view({
      media: Icon.view({ icon: Paperclip, size: 16 }, h),
      name: "launch-plan.pdf",
      metadata: "1.8 MB",
      action: Button.view({ label: "Open", size: "sm", variant: "ghost", onClick: action("Open attachment") }, h),
    }, h),
    Bubble.view({ children: ["Standalone message bubble"] }, h),
  ] }, h),
], h);

export const catalogView = (model: Model, h: HtmlBuilder<Message>): Html => h.div([
  h.Class(className(styles.catalogGrid)),
  h.DataAttribute("component-catalog", "true"),
], [
  dataDisplay(model, h),
  forms(model, h),
  navigation(model, h),
  disclosureAndLayout(model, h),
  overlaysAndMenus(model, h),
  calendarAndMessages(model, h),
]);
