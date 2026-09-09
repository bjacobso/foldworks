import { type Html, type HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Eye,
  Plus,
  Send,
  Settings,
  User,
} from "@lucide/icons";
import {
  Badge,
  Button,
  Checkbox,
  Disclosure,
  Field,
  Fieldset,
  Icon,
  Layout,
  Panel,
  SegmentedControl,
  Select,
  Switch,
  Toolbar,
} from "@foldworks/ui";

import { Message } from "./message";
import type { Model } from "./model";
import { catalogView } from "./catalog-view";
import { financeShowcase } from "./finance-showcase";
import { financeStyles } from "./finance-styles";
import { className, uiKitStyles as styles } from "./styles";

const uiKitDepartmentFromString = (
  value: string,
  fallback: Model["department"],
): Model["department"] =>
  value === "Engineering" || value === "Operations" || value === "People"
    ? value
    : fallback;

const group = (
  label: string,
  children: ReadonlyArray<Html | string>,
  h: HtmlBuilder<Message>,
): Html => h.div([h.Class(className(styles.group))], [
  h.p([h.Class(className(styles.groupLabel))], [label]),
  ...children,
]);

const buttonsPanel = (h: HtmlBuilder<Message>): Html =>
  Panel.view(
    {
      title: "Button",
      description: "Five intent variants, four text sizes, icons, and controlled disabled states.",
      children: [
        Layout.stack({
          gap: "lg",
          children: [
            group("Variants", [
              Layout.row({
                gap: "sm",
                wrap: true,
                children: [
                  Button.view({ label: "Primary", onClick: Message.ClickedAction({ action: "Primary" }) }, h),
                  Button.view({ label: "Secondary", variant: "secondary", onClick: Message.ClickedAction({ action: "Secondary" }) }, h),
                  Button.view({ label: "Outline", variant: "outline", onClick: Message.ClickedAction({ action: "Outline" }) }, h),
                  Button.view({ label: "Ghost", variant: "ghost", onClick: Message.ClickedAction({ action: "Ghost" }) }, h),
                  Button.view({ label: "Danger", variant: "danger", onClick: Message.ClickedAction({ action: "Danger" }) }, h),
                ],
              }, h),
            ], h),
            h.hr([h.Class(className(styles.divider))]),
            group("Sizes and states", [
              Layout.row({
                gap: "sm",
                wrap: true,
                children: [
                  Button.view({ label: "Extra small", size: "xs", variant: "outline", onClick: Message.ClickedAction({ action: "Extra small" }) }, h),
                  Button.view({ label: "Small", size: "sm", variant: "outline", onClick: Message.ClickedAction({ action: "Small" }) }, h),
                  Button.view({ label: "Default", onClick: Message.ClickedAction({ action: "Default" }) }, h),
                  Button.view({ label: "Large", size: "lg", variant: "outline", onClick: Message.ClickedAction({ action: "Large" }) }, h),
                  Button.view({ icon: Plus, size: "icon", ariaLabel: "Create item", onClick: Message.ClickedAction({ action: "Create item" }) }, h),
                  Button.view({ label: "With icon", icon: Check, variant: "secondary", onClick: Message.ClickedAction({ action: "Icon" }) }, h),
                  Button.view({ label: "Continue", trailingIcon: ArrowRight, variant: "ghost", onClick: Message.ClickedAction({ action: "Continue" }) }, h),
                  Button.view({ label: "Disabled", isDisabled: true }, h),
                ],
              }, h),
              Button.view({ label: "Full-width action", isFullWidth: true, variant: "outline", onClick: Message.ClickedAction({ action: "Full-width" }) }, h),
            ], h),
          ],
        }, h),
      ],
    },
    h,
  );

const badgesPanel = (h: HtmlBuilder<Message>): Html =>
  Panel.view(
    {
      title: "Badge",
      description: "Semantic tones stay generic so applications can map domain states onto them.",
      children: [
        Layout.row({
          gap: "sm",
          wrap: true,
          children: [
            Badge.view({ label: "Neutral", tone: "neutral" }, h),
            Badge.view({ label: "Active", tone: "success", dot: true }, h),
            Badge.view({ label: "Pending", tone: "warning", dot: true }, h),
            Badge.view({ label: "Blocked", tone: "danger", dot: true }, h),
            Badge.view({ label: "Information", tone: "info", dot: true }, h),
          ],
        }, h),
      ],
    },
    h,
  );

const iconsPanel = (h: HtmlBuilder<Message>): Html =>
  Panel.view(
    {
      title: "Icon",
      description: "Tree-shakeable Lucide data rendered as declarative Foldkit SVG.",
      children: [
        Layout.row({
          gap: "sm",
          wrap: true,
          children: [
            h.div([h.Class(className(styles.iconSample))], [
              Icon.view({ icon: User, size: 16 }, h),
              "16px",
            ]),
            h.div([h.Class(className(styles.iconSample))], [
              Icon.view({ icon: CalendarDays, size: 20, strokeWidth: 1.75 }, h),
              "20px",
            ]),
            h.div([h.Class(className(styles.iconSample))], [
              Icon.view({ icon: Settings, size: 24, strokeWidth: 1.5 }, h),
              "24px",
            ]),
            h.div([h.Class(className(styles.iconSample))], [
              Icon.view({ icon: Bell, size: 18, label: "Notifications" }, h),
              "Labeled",
            ]),
          ],
        }, h),
      ],
    },
    h,
  );

const fieldsPanel = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div([h.Class(className(styles.wide))], [
    Panel.view(
      {
        title: "Field, input, textarea, and select",
        description: "Default, required, invalid, read-only, disabled, and compact control states.",
        children: [
          h.div([h.Class(className(styles.fieldGrid))], [
            Field.input({
              id: "ui-kit-name",
              label: "Display name",
              description: "A controlled text input.",
              value: model.name,
              placeholder: "Enter a name",
              onInput: (value) => Message.ChangedName({ value }),
            }, h),
            Field.select({
              id: "ui-kit-department",
              label: "Department",
              description: "A labeled native select.",
              value: model.department,
              onChange: (value) => Message.SelectedDepartment({
                value: uiKitDepartmentFromString(value, model.department),
              }),
              options: [
                { value: "Engineering", label: "Engineering" },
                { value: "Operations", label: "Operations" },
                { value: "People", label: "People" },
              ],
            }, h),
            Field.input({
              id: "ui-kit-email",
              label: "Work email",
              description: "Used for account notifications.",
              ...(model.email.includes("@") && model.email.includes(".")
                ? {}
                : { error: "Enter a complete email address." }),
              isRequired: true,
              type: "email",
              value: model.email,
              placeholder: "name@company.com",
              onInput: (value) => Message.ChangedEmail({ value }),
            }, h),
            Field.input({
              id: "ui-kit-compact",
              label: "Compact input",
              value: "Compact density",
              density: "compact",
            }, h),
            Field.input({
              id: "ui-kit-readonly",
              label: "Account ID",
              description: "Read-only values remain selectable.",
              value: "acct_01HRZ8M4Q2",
              isReadOnly: true,
            }, h),
            Field.select({
              id: "ui-kit-disabled",
              label: "Billing region",
              value: "Managed automatically",
              isDisabled: true,
              options: [{ value: "Managed automatically", label: "Managed automatically" }],
            }, h),
            h.div([h.Class(className(styles.fullWidth))], [
              Field.textarea({
                id: "ui-kit-notes",
                label: "Notes",
                description: "Textarea resizing remains available to the user.",
                value: model.notes,
                onInput: (value) => Message.ChangedNotes({ value }),
              }, h),
            ]),
          ]),
        ],
      },
      h,
    ),
  ]);

const controlsPanel = (model: Model, h: HtmlBuilder<Message>): Html =>
  Panel.view(
    {
      title: "Selection controls",
      description: "Compact controls for toolbars and local view switching.",
      children: [
        Layout.stack({
          gap: "lg",
          children: [
            group("Segmented control", [
              SegmentedControl.view({
                value: model.selectedView,
                ariaLabel: "UI kit view",
                options: [
                  { value: "Overview", label: "Overview" },
                  { value: "Details", label: "Details" },
                  { value: "Activity", label: "Activity" },
                ],
                onChange: (value) => Message.SelectedView({ value }),
              }, h),
            ], h),
            group("Compact select", [
              h.div([h.Class(className(styles.compactControl))], [
                Select.control({
                  value: model.department,
                  ariaLabel: "Compact department",
                  onChange: (value) => Message.SelectedDepartment({
                    value: uiKitDepartmentFromString(value, model.department),
                  }),
                  options: [
                    { value: "Engineering", label: "Engineering" },
                    { value: "Operations", label: "Operations" },
                    { value: "People", label: "People" },
                  ],
                }, h),
              ]),
            ], h),
            h.div([h.Class(className(styles.controlState))], [
              h.span([], ["Current view"]),
              h.strong([], [model.selectedView]),
            ]),
          ],
        }, h),
      ],
    },
    h,
  );

const choiceControlsPanel = (model: Model, h: HtmlBuilder<Message>): Html =>
  Panel.view(
    {
      title: "Choice and disclosure",
      description: "Accessible Foldkit behavior with consistent labels, supporting copy, and state styling.",
      children: [
        Fieldset.view({
          id: "ui-kit-preferences",
          legend: "Preferences",
          description: "Controlled values live in the UI kit submodel.",
          children: [
            Checkbox.view({
              id: "ui-kit-terms",
              label: "Accept the workspace terms",
              description: "Required before publishing a workspace.",
              isChecked: model.termsAccepted,
              onToggle: (isChecked) => Message.ToggledTerms({ isChecked }),
            }, h),
            Checkbox.view({
              id: "ui-kit-permissions",
              label: "Team permissions",
              description: "Some workspace roles are currently selected.",
              isChecked: model.mixedPermissions,
              isIndeterminate: !model.mixedPermissions,
              onToggle: (isChecked) => Message.ToggledMixedPermissions({ isChecked }),
            }, h),
            Checkbox.view({
              id: "ui-kit-disabled-checkbox",
              label: "Managed by your organization",
              isChecked: true,
              isDisabled: true,
              onToggle: () => Message.ClickedAction({ action: "Disabled checkbox" }),
            }, h),
            Switch.view({
              id: "ui-kit-updates",
              label: "Product updates",
              description: "Receive a concise monthly summary.",
              isChecked: model.receivesUpdates,
              onToggle: (isChecked) => Message.ToggledUpdates({ isChecked }),
            }, h),
            Switch.view({
              id: "ui-kit-security-alerts",
              label: "Security alerts",
              description: "Get notified when a new device signs in.",
              isChecked: model.securityAlerts,
              onToggle: (isChecked) => Message.ToggledSecurityAlerts({ isChecked }),
            }, h),
            Switch.view({
              id: "ui-kit-disabled-switch",
              label: "Automatic backups",
              description: "Required on this plan.",
              isChecked: true,
              isDisabled: true,
              onToggle: () => Message.ClickedAction({ action: "Disabled switch" }),
            }, h),
          ],
        }, h),
        Disclosure.view({
          id: "ui-kit-disclosure",
          label: "Why these controls are wrappers",
          isOpen: model.isDetailsOpen,
          onToggle: (isOpen) => Message.ToggledDetails({ isOpen }),
          children: [
            "Foldkit owns keyboard behavior and ARIA. The wrapper contributes tokens, layout, and visual states.",
          ],
        }, h),
        Disclosure.view({
          id: "ui-kit-disabled-disclosure",
          label: "Managed account details",
          isOpen: false,
          isDisabled: true,
          onToggle: () => Message.ClickedAction({ action: "Disabled disclosure" }),
          children: ["This content is unavailable."],
        }, h),
      ],
    },
    h,
  );

const compositionPanel = (h: HtmlBuilder<Message>): Html =>
  Panel.view(
    {
      title: "Panel and Layout",
      description: "Composition helpers provide consistent grouping without owning product semantics.",
      children: [
        Layout.stack({
          gap: "sm",
          children: [
            Layout.row({
              gap: "sm",
              wrap: true,
              children: [
                h.div([h.Class(className(styles.layoutTile))], ["Row item A"]),
                h.div([h.Class(className(styles.layoutTile))], ["Row item B"]),
                h.div([h.Class(className(styles.layoutTile))], ["Row item C"]),
              ],
            }, h),
            h.div([h.Class(className(styles.layoutTile))], ["Stack item"]),
            Fieldset.view({
              id: "ui-kit-disabled-fieldset",
              legend: "Disabled fieldset",
              description: "Fieldset state is inherited by its native controls.",
              isDisabled: true,
              children: [
                Field.input({
                  id: "ui-kit-fieldset-input",
                  label: "Organization policy",
                  value: "Editing disabled",
                }, h),
              ],
            }, h),
          ],
        }, h),
      ],
    },
    h,
  );

const toolbarPanel = (h: HtmlBuilder<Message>): Html =>
  h.div([h.Class(className(styles.wide))], [
    Panel.view(
      {
        title: "Toolbar",
        description: "A reusable page heading with leading content and responsive actions.",
        children: [
          h.div([h.Class(className(styles.toolbarPreview))], [
            Toolbar.view({
              title: "Employee workflow",
              description: "Last edited a few seconds ago",
              leading: [Badge.view({ label: "Draft", tone: "warning" }, h)],
              actions: [
                Button.view({ label: "Preview", icon: Eye, variant: "outline", size: "sm", onClick: Message.ClickedAction({ action: "Preview" }) }, h),
                Button.view({ label: "Publish", icon: Send, size: "sm", onClick: Message.ClickedAction({ action: "Publish" }) }, h),
              ],
            }, h),
          ]),
        ],
      },
      h,
    ),
  ]);

const tokensPanel = (h: HtmlBuilder<Message>): Html => {
  const tokens = [
    ["Background", styles.swatchBackground],
    ["Card", styles.swatchCard],
    ["Muted", styles.swatchMuted],
    ["Primary", styles.swatchPrimary],
    ["Border", styles.swatchBorder],
    ["Ring", styles.swatchRing],
    ["Success", styles.swatchSuccess],
    ["Warning", styles.swatchWarning],
    ["Destructive", styles.swatchDanger],
    ["Information", styles.swatchInfo],
    ["Selection", styles.swatchSelection],
    ["Drop target", styles.swatchDropTarget],
  ] as const;
  return h.div([h.Class(className(styles.wide))], [
    Panel.view(
      {
        title: "Semantic tokens",
        description: "Shadcn-compatible OKLCH roles feed the Foldkit and application-level tokens.",
        children: [
          h.div([h.Class(className(styles.tokenGrid))], tokens.map(([label, swatch]) =>
            h.div([h.Class(className(styles.token))], [
              h.div([h.Class(className(styles.swatch, swatch))]),
              h.span([h.Class(className(styles.tokenLabel))], [label]),
            ]),
          )),
        ],
      },
      h,
    ),
  ]);
};

export const uiKitView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div([h.Class(className(styles.viewport)), h.DataAttribute("ui-kit", "true")], [
    h.div([h.Class(className(styles.content))], [
      h.p([h.Class(className(styles.srOnly)), h.AriaLive("polite")], [model.announcement]),
      financeShowcase(model, h),
      h.header([h.Class(className(financeStyles.sectionIntro))], [
        h.div([h.Class(className(financeStyles.sectionCopy))], [
          h.span([h.Class(className(financeStyles.eyebrow))], ["Primitive library"]),
          h.h2([h.Class(className(financeStyles.sectionTitle))], ["Complete component catalog"]),
          h.p([h.Class(className(financeStyles.sectionDescription))], [
            "Every Foldworks UI primitive, state, and composition remains available below the application examples.",
          ]),
        ]),
        Badge.view({ label: "61 primitives", tone: "info" }, h),
      ]),
      Panel.view({
        title: "Interaction support",
        description: "Tabs, Dialog, Custom department select, and Workspace commands below use styled Foldkit submodels.",
        children: [
          h.p([], ["Other catalog examples have different behavior limits. Check the capability guide when choosing a component."]),
          h.a([h.Href("/docs/ui/capabilities.md"), h.Attribute("target", "_blank"), h.Attribute("rel", "noopener")], ["Component capabilities"]),
          " · ",
          h.a([h.Href("/docs/ui/stateful.md"), h.Attribute("target", "_blank"), h.Attribute("rel", "noopener")], ["Stateful integration examples"]),
        ],
      }, h),
      h.div([h.Class(className(styles.sectionGrid))], [
        h.div([h.Class(className(styles.wide))], [catalogView(model, h)]),
        buttonsPanel(h),
        badgesPanel(h),
        iconsPanel(h),
        fieldsPanel(model, h),
        controlsPanel(model, h),
        choiceControlsPanel(model, h),
        compositionPanel(h),
        toolbarPanel(h),
        tokensPanel(h),
      ]),
    ]),
  ]);

export const view = defineView<Model, Message>((model, h) => uiKitView(model, h));
