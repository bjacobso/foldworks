import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import { Check, Copy, Link, RotateCcw, Shuffle } from "@lucide/icons";
import {
  Badge,
  Button,
  CodeBlock,
  Disclosure,
  Field,
  Input,
  SegmentedControl,
  TabBar,
  Slider,
  Stateful,
  Switch,
} from "@foldworks/ui";
import { ThemeName } from "../theme";
import { contrast, contrastLabel, parseColor, toHex } from "./color";
import { contrastPairs, surfaceRadii, type Tokens } from "./contract";
import { exportTheme, slugify } from "./export";
import { Message } from "./message";
import { ExportFormat, type Model } from "./model";
import { fontStacks, resolveTheme } from "./palette";
import { preview } from "./preview";
import { editableTokens } from "./serialization";
import { className, styles } from "./styles";

const radiusNumber = (value: string): number =>
  value.endsWith("px") ? parseFloat(value) / 16 : parseFloat(value) || 0;
const contrastBadge = (fg: string, bg: string, h: HtmlBuilder<Message>): Html => {
  const ratio = contrast(fg, bg);
  return h.span(
    [
      h.Class(
        className(
          styles.contrast,
          ...(ratio !== undefined && ratio < 4.5 ? [styles.contrastFail] : []),
        ),
      ),
      h.Title(
        ratio === undefined ? "Contrast unavailable" : `WCAG normal text: ${ratio.toFixed(2)}:1`,
      ),
    ],
    [contrastLabel(ratio)],
  );
};
const colorField = (
  label: string,
  value: string,
  onInput: (value: string) => Message,
  h: HtmlBuilder<Message>,
  extra: Html = h.empty,
): Html =>
  h.div(
    [h.Class(className(styles.control))],
    [
      h.span([h.Class(className(styles.label))], [label]),
      h.div(
        [h.Class(className(styles.colorRow))],
        [
          h.input([
            h.Type("color"),
            h.Class(className(styles.colorInput)),
            h.Value(toHex(value)),
            h.AriaLabel(`${label} color`),
            h.OnInput(onInput),
          ]),
          Input.view({ value, onInput, ariaLabel: label, sx: styles.colorText }, h),
          extra,
        ],
      ),
      ...(parseColor(value)
        ? []
        : [h.span([h.Class(className(styles.invalid))], ["Enter hex, rgb, or oklch."])]),
    ],
  );
const section = (
  name: string,
  children: readonly (Html | string)[],
  model: Model,
  h: HtmlBuilder<Message>,
): Html =>
  Disclosure.view(
    {
      id: `theme-section-${slugify(name)}`,
      label: name,
      isOpen: model.sections.includes(name),
      onToggle: (isOpen) => Message.ToggledSection({ section: name, isOpen }),
      sx: styles.section,
      slotProps: {
        trigger: { sx: styles.sectionTrigger },
        panelInner: { sx: styles.sectionInner },
      },
      children,
    },
    h,
  );

const rail = (model: Model, tokens: Tokens, h: HtmlBuilder<Message>): Html => {
  const theme = model.working;
  return h.aside(
    [h.Class(className(styles.rail)), h.AriaLabel("Theme controls")],
    [
      section(
        "Start from",
        [
          h.p([h.Class(className(styles.hint))], ["A foundation to make your own."]),
          h.div(
            [h.Class(className(styles.chips))],
            ThemeName.literals.map((preset) =>
              h.button(
                [
                  h.Type("button"),
                  h.Class(
                    className(
                      styles.chip,
                      ...(theme.preset === preset ? [styles.chipSelected] : []),
                    ),
                  ),
                  h.AriaPressed(theme.preset === preset ? "true" : "false"),
                  h.AriaLabel(`Start from ${preset}`),
                  h.OnClick(Message.SelectedPreset({ preset })),
                ],
                [
                  h.div(
                    [h.Class(className(styles.swatches)), h.AriaHidden(true)],
                    ["primary", "background", "accent", "chart-1", "chart-2"].map((token) =>
                      h.span([
                        h.Class(className(styles.swatch)),
                        h.Style({
                          backgroundColor: model.presets[preset]?.light[token] ?? "transparent",
                        }),
                      ]),
                    ),
                  ),
                  preset === "Fluent2" ? "Fluent 2" : preset,
                ],
              ),
            ),
          ),
        ],
        model,
        h,
      ),
      section(
        "Color",
        [
          colorField(
            "Primary",
            model.drafts.primary ?? (theme.primary || theme.baseline.light.primary!),
            (value) => Message.ChangedPrimary({ value }),
            h,
            contrastBadge(tokens["primary-foreground"]!, tokens.primary!, h),
          ),
          Field.select(
            {
              id: "theme-neutral",
              label: "Neutral family",
              value: theme.neutral,
              options: [
                { value: "preset", label: "From preset" },
                ...(["zinc", "slate", "stone", "gray", "neutral"] as const).map((value) => ({
                  value,
                  label: value[0]!.toUpperCase() + value.slice(1),
                })),
              ],
              onChange: (value) =>
                Message.ChangedNeutral({ value: value as Model["working"]["neutral"] }),
            },
            h,
          ),
          colorField(
            "Accent",
            model.drafts.accent ?? (theme.accent || theme.baseline.light.accent!),
            (value) => Message.ChangedAccent({ value }),
            h,
            contrastBadge(tokens["accent-foreground"]!, tokens.accent!, h),
          ),
          h.div(
            [h.Class(className(styles.split))],
            [
              h.span([h.Class(className(styles.label))], ["Editing tokens"]),
              SegmentedControl.view(
                {
                  value: model.editMode,
                  ariaLabel: "Token mode",
                  options: [
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                  ],
                  onChange: (value) => Message.ChangedEditMode({ value }),
                },
                h,
              ),
            ],
          ),
          h.div(
            [h.Class(className(styles.row))],
            contrastPairs
              .slice(0, 3)
              .map(([label, fg, bg]) =>
                h.div(
                  [h.Class(className(styles.row))],
                  [
                    h.span([h.Class(className(styles.hint))], [label]),
                    contrastBadge(tokens[fg]!, tokens[bg]!, h),
                  ],
                ),
              ),
          ),
          section(
            "Advanced",
            [
              h.p(
                [h.Class(className(styles.hint))],
                ["Overrides affect this mode. Reset a token to follow the palette again."],
              ),
              h.div(
                [h.Class(className(styles.advanced))],
                editableTokens.map((token) => {
                  const value = model.drafts[`${model.editMode}:${token}`] ?? tokens[token]!;
                  const pair = contrastPairs.find(([, fg]) => fg === token);
                  return h.div(
                    [h.Class(className(styles.control))],
                    [
                      h.div(
                        [h.Class(className(styles.split))],
                        [
                          h.span([h.Class(className(styles.tokenLabel))], [`--${token}`]),
                          ...(pair ? [contrastBadge(tokens[pair[1]]!, tokens[pair[2]]!, h)] : []),
                        ],
                      ),
                      colorField(
                        token,
                        value,
                        (value) => Message.ChangedToken({ token, value }),
                        h,
                        theme.overrides[model.editMode][token] ||
                          model.drafts[`${model.editMode}:${token}`]
                          ? Button.view(
                              {
                                icon: RotateCcw,
                                size: "icon",
                                variant: "ghost",
                                ariaLabel: `Reset ${token}`,
                                onClick: Message.ResetToken({ token }),
                              },
                              h,
                            )
                          : h.empty,
                      ),
                    ],
                  );
                }),
              ),
            ],
            model,
            h,
          ),
        ],
        model,
        h,
      ),
      section(
        "Charts",
        [
          Switch.view(
            {
              id: "theme-derive-charts",
              label: "Derive from primary",
              isChecked: theme.deriveCharts,
              onToggle: (value) => Message.ToggledCharts({ value }),
            },
            h,
          ),
          ...Array.from({ length: 5 }, (_, i) =>
            colorField(
              `chart-${i + 1}`,
              model.drafts[`${model.editMode}:chart-${i + 1}`] ?? tokens[`chart-${i + 1}`]!,
              (value) => Message.ChangedToken({ token: `chart-${i + 1}`, value }),
              h,
              theme.overrides[model.editMode][`chart-${i + 1}`]
                ? Button.view(
                    {
                      icon: RotateCcw,
                      size: "icon",
                      variant: "ghost",
                      ariaLabel: `Reset chart-${i + 1}`,
                      onClick: Message.ResetToken({ token: `chart-${i + 1}` }),
                    },
                    h,
                  )
                : h.empty,
            ),
          ),
        ],
        model,
        h,
      ),
      section(
        "Shape",
        [
          h.div(
            [h.Class(className(styles.split))],
            [
              h.span([h.Class(className(styles.label))], ["Base radius"]),
              h.strong([], [`${theme.radius ?? radiusNumber(tokens.radius!)}rem`]),
            ],
          ),
          Slider.view(
            {
              ariaLabel: "Base radius",
              value: theme.radius ?? radiusNumber(tokens.radius!),
              min: 0,
              max: 1.25,
              step: 0.025,
              onChange: (value) => Message.ChangedRadius({ value }),
            },
            h,
          ),
          h.div(
            [h.Class(className(styles.split))],
            [
              h.span([h.Class(className(styles.hint))], ["Square"]),
              h.span([h.Class(className(styles.hint))], ["Rounded"]),
            ],
          ),
          ...surfaceRadii.map((token) =>
            h.div(
              [h.Class(className(styles.control))],
              [
                h.div(
                  [h.Class(className(styles.split))],
                  [
                    h.span([h.Class(className(styles.label))], [token.replace("radius-", "")]),
                    Button.view(
                      {
                        label: theme.radii[token] ? "Unlinked" : "Linked",
                        variant: "ghost",
                        size: "xs",
                        ariaLabel: `${theme.radii[token] ? "Link" : "Unlink"} ${token}`,
                        onClick: Message.ToggledRadiusLink({ token }),
                      },
                      h,
                    ),
                  ],
                ),
                ...(theme.radii[token]
                  ? [
                      Slider.view(
                        {
                          ariaLabel: token,
                          value: Math.min(1.25, radiusNumber(tokens[token]!)),
                          min: 0,
                          max: 1.25,
                          step: 0.025,
                          onChange: (value) => Message.ChangedSurfaceRadius({ token, value }),
                        },
                        h,
                      ),
                    ]
                  : []),
              ],
            ),
          ),
        ],
        model,
        h,
      ),
      section(
        "Typography",
        [
          Field.select(
            {
              id: "theme-font",
              label: "Font family",
              value: theme.font,
              options: [
                { value: "", label: "From preset" },
                ...Object.entries(fontStacks).map(([label, value]) => ({ label, value })),
              ],
              onChange: (value) => Message.ChangedFont({ value }),
            },
            h,
          ),
          h.p(
            [h.Class(className(styles.hint))],
            ["System stacks and the demo's existing Inter font."],
          ),
        ],
        model,
        h,
      ),
      section(
        "Elevation",
        [
          Field.select(
            {
              id: "theme-elevation",
              label: "Shadow preset",
              value: theme.elevation,
              options: ["preset", "flat", "subtle", "raised", "floating"].map((value) => ({
                value,
                label:
                  value === "preset" ? "From preset" : value[0]!.toUpperCase() + value.slice(1),
              })),
              onChange: (value) =>
                Message.ChangedElevation({ value: value as Model["working"]["elevation"] }),
            },
            h,
          ),
          Switch.view(
            {
              id: "theme-outlined",
              label: "Outlined badges & buttons",
              isChecked: theme.outlined ?? tokens["badge-border"] !== "transparent",
              onToggle: (value) => Message.ToggledOutlined({ value }),
            },
            h,
          ),
        ],
        model,
        h,
      ),
    ],
  );
};
const exportDialog = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.submodel({
    slotId: "theme-export-dialog",
    model: model.dialog,
    view: Stateful.Dialog.view,
    toParentMessage: (message) => Message.GotDialogMessage({ message }),
    viewInputs: Stateful.Dialog.styledViewInputs(
      {
        title: "Take your theme with you",
        description: "Copy, paste, and make it yours. Both modes are included.",
        slotProps: { panel: { sx: styles.exportPanel } },
        content: ({ initialFocus }, h) => [
          h.div(
            [h.Class(className(styles.exportStack))],
            [
              Field.input(
                {
                  id: "theme-export-name",
                  label: "Theme name",
                  value: model.working.name,
                  onInput: (value) => Message.ChangedName({ value }),
                  slotProps: { control: { attributes: initialFocus } },
                },
                h,
              ),
              h.p(
                [h.Class(className(styles.hint))],
                [`Selector: [data-theme="${slugify(model.working.name)}"]`],
              ),
              TabBar.view(
                {
                  id: "theme-export-tabs",
                  semantics: "tablist",
                  ariaLabel: "Export format",
                  value: model.exportFormat,
                  panelId: "theme-export-code",
                  tabs: ExportFormat.literals.map((value) => ({ value, label: value })),
                  onChange: (value) => Message.ChangedExportFormat({ value }),
                },
                h,
              ),
              h.div(
                [
                  h.Role("tabpanel"),
                  h.Id("theme-export-code"),
                  h.Attribute(
                    "aria-labelledby",
                    TabBar.tabId("theme-export-tabs", model.exportFormat),
                  ),
                ],
                [
                  CodeBlock.view(
                    {
                      code: exportTheme(model.working, model.exportFormat),
                      title: model.exportFormat,
                      language: model.exportFormat === "JSON tokens" ? "json" : "css",
                      maxHeight: "min(52vh, 470px)",
                      copy: {
                        onCopy: Message.CopyExport(),
                        isCopied: model.copied === model.exportFormat,
                      },
                    },
                    h,
                  ),
                ],
              ),
            ],
          ),
        ],
        footer: ({ closeButton }, h) => [
          Button.view({ label: "Done", variant: "outline", attributes: closeButton }, h),
        ],
      },
      h,
    ),
  });
export const view = defineView<Model, Message>((model, h) => {
  const resolved = resolveTheme(model.working);
  return h.div(
    [h.Class(className(styles.root)), h.DataAttribute("theme-builder", "true")],
    [
      h.header(
        [h.Class(className(styles.header))],
        [
          h.div(
            [],
            [
              h.h1([h.Class(className(styles.title))], ["Theme builder"]),
              h.p(
                [h.Class(className(styles.subtitle))],
                ["Find your palette. Shape your interface. Take the CSS."],
              ),
            ],
          ),
          h.div(
            [h.Class(className(styles.row))],
            [
              Button.view(
                {
                  label: "Randomize",
                  icon: Shuffle,
                  variant: "ghost",
                  size: "sm",
                  isDisabled: !model.ready,
                  onClick: Message.Randomize(),
                },
                h,
              ),
              Button.view(
                {
                  label: "Reset",
                  icon: RotateCcw,
                  variant: "ghost",
                  size: "sm",
                  isDisabled: !model.ready,
                  onClick: Message.Reset(),
                },
                h,
              ),
              Button.view(
                {
                  label: model.copied === "share" ? "Copied" : "Share",
                  icon: model.copied === "share" ? Check : Link,
                  variant: "outline",
                  size: "sm",
                  isDisabled: !model.ready,
                  onClick: Message.Share(),
                },
                h,
              ),
              Button.view(
                {
                  label: "Copy theme",
                  icon: Copy,
                  size: "sm",
                  isDisabled: !model.ready,
                  onClick: Message.OpenExport(),
                },
                h,
              ),
            ],
          ),
        ],
      ),
      model.ready
        ? h.div(
            [h.Class(className(styles.body))],
            [
              rail(model, resolved[model.editMode], h),
              h.section(
                [h.Class(className(styles.canvas)), h.AriaLabel("Live preview")],
                [
                  h.div(
                    [h.Class(className(styles.previewToolbar))],
                    [
                      h.div(
                        [h.Class(className(styles.row))],
                        [
                          h.span([h.Class(className(styles.eyebrow))], ["Live preview"]),
                          Badge.view({ label: "@foldworks/ui", tone: "muted" }, h),
                        ],
                      ),
                      SegmentedControl.view(
                        {
                          value: model.previewMode,
                          ariaLabel: "Preview mode",
                          options: [
                            { value: "Light", label: "Light" },
                            { value: "Dark", label: "Dark" },
                            { value: "Side-by-side", label: "Side-by-side" },
                          ],
                          onChange: (value) => Message.ChangedPreviewMode({ value }),
                        },
                        h,
                      ),
                    ],
                  ),
                  h.div(
                    [
                      h.Class(
                        className(
                          styles.previews,
                          ...(model.previewMode === "Side-by-side" ? [styles.previewsBoth] : []),
                        ),
                      ),
                    ],
                    (model.previewMode === "Side-by-side"
                      ? (["light", "dark"] as const)
                      : ([model.previewMode === "Dark" ? "dark" : "light"] as const)
                    ).map((mode) => preview(model, mode, resolved[mode], h)),
                  ),
                  h.div(
                    [h.Class(className(styles.footer))],
                    [
                      h.span(
                        [h.Class(className(styles.hint))],
                        ["Real components. Your tokens. Every change, live."],
                      ),
                      h.span(
                        [h.Class(className(styles.hint))],
                        [`${model.working.preset} foundation · ${model.editMode} tokens`],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          )
        : h.p([h.Class(className(styles.hint))], ["Loading theme presets…"]),
      exportDialog(model, h),
      h.p([h.Class(className(styles.srOnly)), h.AriaLive("polite")], [model.announcement]),
    ],
  );
});
