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
  ContextMenu,
  Direction,
  Drawer,
  DropdownMenu,
  Empty,
  Form,
  Heading,
  HoverCard,
  Input,
  InputGroup,
  InputOtp,
  Item,
  Kbd,
  Label,
  Layout,
  Link,
  Marker,
  Menubar,
  Message as ChatMessage,
  MessageScroller,
  NativeSelect,
  NavigationMenu,
  NumberField,
  Pagination,
  Popover,
  Progress,
  RadioGroup,
  Resizable,
  ScrollArea,
  Separator,
  Sheet,
  Sidebar,
  Skeleton,
  Slider,
  Sonner,
  Spinner,
  Stateful,
  Stepper,
  Table,
  Tag,
  Text,
  Textarea,
  Toggle,
  ToggleGroup,
  Tooltip,
  VisuallyHidden,
} from "@foldworks/ui";
import { FileText, Folder, Inbox, Paperclip, Search, Settings, User } from "@lucide/icons";
import { Icon } from "@foldworks/ui";

import { Message } from "./message";
import type { Model } from "./model";
import { AccountTabs, ActionMenu, DepartmentCombobox, DepartmentSelect, ToolCombobox } from "./components";
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

const departmentOptions = [
  { value: "Engineering", label: "Engineering", group: "Product" },
  { value: "Operations", label: "Operations", group: "Business", isDisabled: true },
  { value: "People", label: "People", keywords: ["team", "hr"], group: "Business" },
] as const;

const toolOptions = [
  { value: "Menu", label: "Menu", group: "Floating layers" },
  { value: "Popover", label: "Popover", group: "Floating layers" },
  { value: "Combobox", label: "Combobox", group: "Inputs" },
  { value: "Toast", label: "Toast", group: "Feedback" },
] as const;

const foundations = (model: Model, h: HtmlBuilder<Message>): Html => section("First-principles foundations", [
  Layout.Container.view({
    size: "full",
    query: true,
    padding: "none",
    children: [Layout.Stack.view({
      gap: { base: "sm", lg: "lg" },
      responsiveTo: "container",
      children: [
        Heading.view({ level: 4, size: "lg", children: ["Semantic content and local layout"] }, h),
        Text.view({ tone: "muted", children: [
          "Resize the page: this grid follows its container, while heading level and visual size remain independent.",
        ] }, h),
        Link.view({ href: "/docs/ui/primitives.md", target: "_blank", children: ["Read the primitives guide"] }, h),
        Layout.Grid.view({
          columns: { base: 1, sm: 2, lg: 3 },
          gap: { base: "sm", lg: "lg" },
          responsiveTo: "container",
          children: ["Container query", "Responsive gap", "One-to-twelve columns"].map((label) =>
            h.div([h.Class(className(styles.catalogTile))], [label])),
        }, h),
        Layout.Row.view({
          direction: { base: "column", sm: "row" },
          responsiveTo: "container",
          gap: "sm",
          align: "start",
          wrap: true,
          children: [
            Tag.view({ label: "Static" }, h),
            Tag.view({ label: "Selectable", isSelected: true, onSelect: action("Selectable tag") }, h),
            Tag.view({ label: "Removable", tone: "success", onRemove: action("Remove tag") }, h),
          ],
        }, h),
        VisuallyHidden.view({ children: ["The layout examples above adapt without changing reading order."] }, h),
      ],
    }, h)],
  }, h),
  NumberField.view({
    id: "catalog-number", label: "Completion", value: model.sliderValue,
    min: 0, max: 100, step: 5, description: "Native number input with clamped step controls.",
    onChange: (value) => Message.ChangedSlider({ value: value ?? 0 }),
  }, h),
  Stepper.view({
    currentStepId: model.foundationStep,
    steps: [
      { id: "Compose", label: "Compose", description: "Prepare the change" },
      { id: "Validate", label: "Validate", description: "Run checks" },
      { id: "Ship", label: "Ship", description: "Publish safely" },
    ],
    onSelect: (value) => Message.SelectedFoundationStep({ value: value as "Compose" | "Validate" | "Ship" }),
  }, h),
], h, true);

const statefulFoundations = (model: Model, h: HtmlBuilder<Message>): Html => section("Stateful floating primitives", [
  Text.view({ tone: "muted", children: [
    "These examples run Foldkit state machines for keyboard navigation, focus return, dismissal, collision-aware anchoring, and timed lifecycle behavior.",
  ] }, h),
  h.div([h.Class(className(styles.catalogOverlayButtons))], [
    h.submodel({
      slotId: model.actionMenu.id,
      model: model.actionMenu,
      view: ActionMenu.view,
      viewInputs: Stateful.Menu.styledViewInputs({
        trigger: ["Stateful menu"],
        ariaLabel: "Document actions",
        items: [
          { value: "Edit", label: "Edit document", group: "Document", shortcut: "⌘E", media: [Icon.view({ icon: FileText, size: 15 }, h)] },
          { value: "Duplicate", label: "Duplicate", group: "Document", shortcut: "⌘D" },
          { value: "Delete", label: "Delete", group: "Danger zone", isDestructive: true },
        ],
      }, h),
      toParentMessage: (message) => Message.GotActionMenuMessage({ message }),
    }),
    h.submodel({
      slotId: model.popover.id,
      model: model.popover,
      view: Stateful.Popover.view,
      viewInputs: Stateful.Popover.styledViewInputs({
        trigger: ["Stateful popover"],
        ariaLabel: "Deployment details",
        showArrow: true,
        anchor: { placement: "bottom-start" },
        content: [Layout.Stack.view({ gap: "sm", children: [
          Heading.view({ level: 5, size: "sm", children: ["Deployment details"] }, h),
          Text.view({ size: "sm", tone: "muted", children: ["Anchored, portaled, focus-managed content."] }, h),
          Tag.view({ label: "Ready", tone: "success" }, h),
        ] }, h)],
      }, h),
      toParentMessage: (message) => Message.GotPopoverMessage({ message }),
    }),
    h.submodel({
      slotId: model.tooltip.id,
      model: model.tooltip,
      view: Stateful.Tooltip.view,
      viewInputs: Stateful.Tooltip.styledViewInputs({
        trigger: ["Hover or focus"],
        label: "Escape dismisses this collision-aware tooltip",
      }, h),
      toParentMessage: (message) => Message.GotTooltipMessage({ message }),
    }),
  ]),
  Layout.Grid.view({
    columns: { base: 1, md: 2 },
    gap: "lg",
    children: [
      Layout.Stack.view({ gap: "sm", children: [
        Label.view({ for: Stateful.Combobox.inputId(model.departmentCombobox.id), children: ["Single-select combobox"] }, h),
        h.submodel({
          slotId: model.departmentCombobox.id,
          model: model.departmentCombobox,
          view: DepartmentCombobox.view,
          viewInputs: Stateful.Combobox.styledViewInputs({
            options: departmentOptions,
            query: model.departmentCombobox.inputValue,
            value: model.department,
            ariaLabel: "Department combobox",
            name: "stateful-department",
            openOnFocus: true,
          }, h),
          toParentMessage: (message) => Message.GotComboboxMessage({ message }),
        }),
        Text.view({ size: "sm", tone: "muted", children: [`Selected: ${model.department}`] }, h),
      ] }, h),
      Layout.Stack.view({ gap: "sm", children: [
        Label.view({ for: Stateful.Combobox.inputId(model.toolCombobox.id), children: ["Multi-select combobox"] }, h),
        h.submodel({
          slotId: model.toolCombobox.id,
          model: model.toolCombobox,
          view: ToolCombobox.view,
          viewInputs: Stateful.Combobox.Multi.styledViewInputs({
            options: toolOptions,
            query: model.toolCombobox.inputValue,
            values: model.selectedTools,
            ariaLabel: "UI tools combobox",
            name: "stateful-tools",
            openOnFocus: true,
          }, h),
          toParentMessage: (message) => Message.GotMultiComboboxMessage({ message }),
        }),
        Layout.Row.view({ gap: "xs", wrap: true, children: model.selectedTools.map((value) =>
          Tag.view({ label: value, isSelected: true, onRemove: Message.RemovedTool({ value }) }, h)),
        }, h),
      ] }, h),
    ],
  }, h),
  Layout.Row.view({ gap: "sm", wrap: true, children: (["Info", "Success", "Warning", "Error"] as const).map((variant) =>
    Button.view({
      label: `${variant} toast`,
      size: "sm",
      variant: variant === "Error" ? "danger" : variant === "Success" ? "primary" : "outline",
      onClick: Message.RequestedToast({ variant }),
    }, h)),
  }, h),
  h.submodel({
    slotId: model.toasts.id,
    model: model.toasts,
    view: Stateful.Toast.view,
    viewInputs: Stateful.Toast.styledViewInputs({ position: "BottomRight", ariaLabel: "Demo notifications" }, h),
    toParentMessage: (message) => Message.GotToastMessage({ message }),
  }),
], h, true);

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
  h.submodel({
    slotId: model.departmentSelect.id,
    model: model.departmentSelect,
    view: DepartmentSelect.view,
    viewInputs: Stateful.Select.styledViewInputs({
      value: model.department,
      ariaLabel: "Custom department select",
      name: "department",
      options: [
        { value: "Engineering", label: "Engineering" },
        { value: "Operations", label: "Operations", isDisabled: true },
        { value: "People", label: "People" },
      ],
    }, h),
    toParentMessage: (message) => Message.GotSelectMessage({ message }),
  }),
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
  h.submodel({
    slotId: model.tabs.id,
    model: model.tabs,
    view: AccountTabs.view,
    viewInputs: Stateful.Tabs.styledViewInputs({
      selectedValue: model.selectedView,
      ariaLabel: "Account views",
      tabs: [
        { value: "Overview", label: "Overview", content: ["Account overview"] },
        { value: "Details", label: "Details", content: ["Account details"] },
        { value: "Activity", label: "Activity", content: ["Recent activity"] },
      ],
    }, h),
    toParentMessage: (message) => Message.GotTabsMessage({ message }),
  }),
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
  if (kind === "Dialog") return h.submodel({
    slotId: model.dialog.id,
    model: model.dialog,
    view: Stateful.Dialog.view,
    viewInputs: Stateful.Dialog.styledViewInputs({
      title: "Dialog example",
      description: "Edit your profile. Escape closes and restores focus to the trigger.",
      content: ({ initialFocus }, h) => [
        h.label([h.For("dialog-name")], ["Display name"]),
        Input.view({
          id: "dialog-name",
          ariaLabel: "Display name",
          value: model.name,
          onInput: (value) => Message.ChangedName({ value }),
          attributes: initialFocus,
        }, h),
      ],
      footer: ({ closeButton }, h) => [
        Button.view({ label: "Close", variant: "outline", attributes: closeButton }, h),
      ],
    }, h),
    toParentMessage: (message) => Message.GotDialogMessage({ message }),
  });
  const component = kind === "AlertDialog" ? AlertDialog : kind === "Sheet" ? Sheet : Drawer;
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
        Button.view({ label: kind, size: "sm", variant: "outline", onClick: kind === "Dialog"
          ? Message.GotDialogMessage({ message: Stateful.Dialog.Message.RequestedOpen() })
          : toggleComponent(kind, true) }, h)),
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
    h.submodel({
      slotId: model.command.id,
      model: model.command,
      view: Stateful.Command.view,
      viewInputs: {
        ariaLabel: "Workspace commands",
        items: [
          { value: "profile", label: "Open profile", group: "Navigation", media: [Icon.view({ icon: User, size: 15 }, h)] },
          { value: "admin", label: "Administration", group: "Navigation", isDisabled: true },
          { value: "settings", label: "Open settings", keywords: ["preferences"], group: "Navigation", media: [Icon.view({ icon: Settings, size: 15 }, h)] },
          { value: "publish", label: "Publish changes", group: "Actions" },
        ],
      },
      toParentMessage: (message) => Message.GotCommandMessage({ message }),
    }),
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
  foundations(model, h),
  statefulFoundations(model, h),
  dataDisplay(model, h),
  forms(model, h),
  navigation(model, h),
  disclosureAndLayout(model, h),
  overlaysAndMenus(model, h),
  calendarAndMessages(model, h),
]);
