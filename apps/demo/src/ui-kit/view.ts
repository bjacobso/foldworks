import type { Html, HtmlBuilder } from "foldkit/html";

import { CalendarDays, Check, Eye, Plus, Send, Settings, User } from "@lucide/icons";
import {
  Badge,
  Button,
  Field,
  Icon,
  Layout,
  Panel,
  SegmentedControl,
  Select,
  Toolbar,
} from "@foldworks/ui";

import { Message } from "../workflow/message";
import type { Model } from "../workflow/model";
import { className, uiKitStyles as styles } from "./styles";

const uiKitDepartmentFromString = (
  value: string,
  fallback: Model["uiKitDepartment"],
): Model["uiKitDepartment"] =>
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
      description: "Five intent variants, three sizes, and controlled disabled states.",
      children: [
        Layout.stack({
          gap: "lg",
          children: [
            group("Variants", [
              Layout.row({
                gap: "sm",
                wrap: true,
                children: [
                  Button.view({ label: "Primary", onClick: Message.ClickedUiKitAction({ action: "Primary" }) }, h),
                  Button.view({ label: "Secondary", variant: "secondary", onClick: Message.ClickedUiKitAction({ action: "Secondary" }) }, h),
                  Button.view({ label: "Outline", variant: "outline", onClick: Message.ClickedUiKitAction({ action: "Outline" }) }, h),
                  Button.view({ label: "Ghost", variant: "ghost", onClick: Message.ClickedUiKitAction({ action: "Ghost" }) }, h),
                  Button.view({ label: "Danger", variant: "danger", onClick: Message.ClickedUiKitAction({ action: "Danger" }) }, h),
                ],
              }, h),
            ], h),
            h.hr([h.Class(className(styles.divider))]),
            group("Sizes and states", [
              Layout.row({
                gap: "sm",
                wrap: true,
                children: [
                  Button.view({ label: "Small", size: "sm", variant: "outline", onClick: Message.ClickedUiKitAction({ action: "Small" }) }, h),
                  Button.view({ label: "Medium", onClick: Message.ClickedUiKitAction({ action: "Medium" }) }, h),
                  Button.view({ icon: Plus, size: "icon", ariaLabel: "Create item", onClick: Message.ClickedUiKitAction({ action: "Create item" }) }, h),
                  Button.view({ label: "With icon", icon: Check, variant: "secondary", onClick: Message.ClickedUiKitAction({ action: "Icon" }) }, h),
                  Button.view({ label: "Disabled", isDisabled: true }, h),
                ],
              }, h),
              Button.view({ label: "Full-width action", isFullWidth: true, variant: "outline", onClick: Message.ClickedUiKitAction({ action: "Full-width" }) }, h),
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
        title: "Field and Select",
        description: "Foldkit input behavior with shared labels, descriptions, density, and focus treatment.",
        children: [
          h.div([h.Class(className(styles.fieldGrid))], [
            Field.input({
              id: "ui-kit-name",
              label: "Display name",
              description: "A controlled text input.",
              value: model.uiKitName,
              placeholder: "Enter a name",
              onInput: (value) => Message.ChangedUiKitName({ value }),
            }, h),
            Field.select({
              id: "ui-kit-department",
              label: "Department",
              description: "A labeled native select.",
              value: model.uiKitDepartment,
              onChange: (value) => Message.SelectedUiKitDepartment({
                value: uiKitDepartmentFromString(value, model.uiKitDepartment),
              }),
              options: [
                { value: "Engineering", label: "Engineering" },
                { value: "Operations", label: "Operations" },
                { value: "People", label: "People" },
              ],
            }, h),
            Field.input({
              id: "ui-kit-compact",
              label: "Compact input",
              value: "Compact density",
              density: "compact",
            }, h),
            Field.input({
              id: "ui-kit-disabled",
              label: "Disabled input",
              value: "Unavailable",
              isDisabled: true,
            }, h),
            h.div([h.Class(className(styles.fullWidth))], [
              Field.textarea({
                id: "ui-kit-notes",
                label: "Notes",
                description: "Textarea resizing remains available to the user.",
                value: model.uiKitNotes,
                onInput: (value) => Message.ChangedUiKitNotes({ value }),
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
                value: model.uiKitView,
                ariaLabel: "UI kit view",
                options: [
                  { value: "Overview", label: "Overview" },
                  { value: "Details", label: "Details" },
                  { value: "Activity", label: "Activity" },
                ],
                onChange: (value) => Message.SelectedUiKitView({ value }),
              }, h),
            ], h),
            group("Compact select", [
              h.div([h.Class(className(styles.compactControl))], [
                Select.control({
                  value: model.uiKitDepartment,
                  ariaLabel: "Compact department",
                  onChange: (value) => Message.SelectedUiKitDepartment({
                    value: uiKitDepartmentFromString(value, model.uiKitDepartment),
                  }),
                  options: [
                    { value: "Engineering", label: "Engineering" },
                    { value: "Operations", label: "Operations" },
                    { value: "People", label: "People" },
                  ],
                }, h),
              ]),
            ], h),
          ],
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
                Button.view({ label: "Preview", icon: Eye, variant: "outline", size: "sm", onClick: Message.ClickedUiKitAction({ action: "Preview" }) }, h),
                Button.view({ label: "Publish", icon: Send, size: "sm", onClick: Message.ClickedUiKitAction({ action: "Publish" }) }, h),
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
      h.p([h.Class(className(styles.intro))], [
        "These primitives add Foldworks's visual language to Foldkit's accessible behavior. The controls below are live and controlled by the demo model.",
      ]),
      h.div([h.Class(className(styles.sectionGrid))], [
        buttonsPanel(h),
        badgesPanel(h),
        iconsPanel(h),
        fieldsPanel(model, h),
        controlsPanel(model, h),
        compositionPanel(h),
        toolbarPanel(h),
        tokensPanel(h),
      ]),
    ]),
  ]);
