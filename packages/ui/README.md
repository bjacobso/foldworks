# @foldworks/ui

Opinionated application chrome for Foldkit, built with StyleX and the accessible behavior from `@foldkit/ui`.

The package owns semantic tokens, focus treatment, control density, and reusable visual primitives. Product concepts and feature behavior stay in their application or feature package.

The root export covers all 61 components in the current shadcn UI catalog,
translated to Foldkit's controlled `view(config, h)` convention. That includes
forms, feedback, data display, navigation, menus, overlays, layout primitives,
calendar and chart views, and the attachment/message family. Existing Foldkit
headless behavior remains the foundation for buttons, inputs, checkboxes,
switches, fieldsets, and disclosures; other controls use native browser
semantics and parent-owned state.

Foldworks also includes first-principles application foundations beyond that
catalog: responsive Container/Grid/Stack/Row layout, semantic Text/Heading/Link,
actionable Tag, NumberField, Stepper, and a shared anchored-layer policy.
DescriptionList, Stat, Legend, and CodeBlock cover structured details, metrics,
chart keys, and read-only source.

For interactive tabs, modal dialogs, custom selects, command palettes, menus,
popovers, tooltips, comboboxes, and managed toast stacks, use
the `Stateful` namespace. These styled submodels integrate models, messages,
commands, and focus behavior. The existing view-only APIs remain available for
compatibility. Catalog coverage does not imply behavioral parity: see the
[capability guide](docs/capabilities.md) and [stateful integration examples](docs/stateful.md).

## Setup

Foldworks ships its StyleX expressions so applications can combine them with
their own atomic styles. Configure the StyleX transform in the consuming
application. For Vite:

```sh
pnpm add -D @stylexjs/unplugin
```

```ts
// vite.config.ts
import { foldworksLayers } from "@foldworks/ui/vite";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    stylex.vite({
      runtimeInjection: false,
      // Rank the Foldworks reset below StyleX in development and in builds.
      useCSSLayers: { before: foldworksLayers },
    }),
  ],
});
```

The plugin automatically discovers installed packages that depend on
`@stylexjs/stylex`, including the Foldworks packages. `@foldworks/ui/vite` is a
Node-only configuration entry; see [Cascade layers](#cascade-layers) for why
`before` matters and [Testing views](#testing-views) for its Vitest plugin.

Import the base contract and the themes your application supports:

```css
@import "@foldworks/ui/base.css";
@import "@foldworks/ui/themes/shadcn.css";
@import "@foldworks/ui/themes/blueprint.css";
@import "@foldworks/ui/themes/office.css";
@import "@foldworks/ui/themes/fluent2.css";
@import "@foldworks/ui/themes/google.css";
@import "@foldworks/ui/themes/apple.css";
@import "@foldworks/ui/themes/polaris.css";
```

For a Shadcn-only application, `@foldworks/ui/theme.css` is a convenient
combined base-and-theme import.

`base.css` also includes a modern browser reset in the `foldworks-reset`
cascade layer, ranked below the StyleX styles. See
[Cascade layers](#cascade-layers).

The theme contract exposes the familiar shadcn semantic roles (`--background`,
`--foreground`, `--card`, `--primary`, `--muted`, `--accent`, `--destructive`,
`--border`, `--input`, `--ring`, and `--sidebar-*`) in OKLCH. StyleX component
recipes consume those native variables through `tokens.stylex.ts`, so changing
a variable updates every component without rebuilding or rewriting styles.

Light themes use a soft gray application background, a darker sidebar, and
white card surfaces to distinguish the workspace from its content.

Set `data-theme` and the resolved `data-mode` on a root ancestor:

```html
<html data-theme="shadcn" data-mode="dark" class="dark"></html>
```

`data-theme` accepts `shadcn`, `blueprint`, `office`, `fluent2`, `google`, `apple`, or
`polaris`.
`data-mode` accepts `light` or `dark`; the optional `.dark` class remains
compatible with shadcn theme providers. CSS variables cascade, so the same
attributes can theme a nested subtree. An application can define its own theme
by overriding the semantic variables after the Foldworks imports:

```css
[data-theme="product"] {
  --primary: oklch(0.58 0.22 264);
  --primary-foreground: oklch(0.985 0 0);
  --ring: oklch(0.66 0.16 264);
  --radius: 0.75rem;
}
```

Application interactions use separate semantic roles for selection and drag
intent: `--foldworks-ui-selection-*`, `--foldworks-ui-drop-target-*`, and
`--foldworks-ui-overlay`. Selection and drag roles derive from the active
theme's `--primary`, `--card`, and `--border` tokens, while remaining distinct
from success, warning, danger, and information status colors. The same roles
are available through the exported StyleX `colors` constants.

### Cascade layers

`base.css` includes a modern browser reset in the `foldworks-reset` cascade
layer. With `useCSSLayers`, StyleX puts its atomic styles in layers named
`priority1`, `priority2`, and so on. A layer's rank comes from the first
stylesheet in the document that names it, and later layers win, so
`foldworks-reset` must be named before the StyleX layers.

A production build puts the StyleX rules at the end of the application
stylesheet, so the order is correct there. Under `vite dev`, the StyleX dev
runtime injects its own `<style>` element, and Vite injects each stylesheet
imported from JavaScript when its module runs. When the StyleX element arrives
first, the reset outranks StyleX, and buttons and inputs lose their padding,
borders, radius, and font size in development only. This happens, for example,
when the stylesheet import sits behind a lazy `import()` or a dependency with
top-level await.

Passing `foldworksLayers` to `useCSSLayers.before`, as in the setup above, makes
the StyleX stylesheet itself start with `@layer foldworks-reset, priority1, …`.
The order is then the same whichever stylesheet loads first.

If your StyleX integration doesn't accept `before`, load
`@foldworks/ui/layers.css` ahead of any StyleX output. It declares the layer
order and contains no rules. Import it at the top of the stylesheet that
contains the StyleX output, or declare the order at the top of `<head>` in
`index.html`:

```html
<style>
  @layer foldworks-reset;
</style>
```

Unlayered application CSS outranks every layer, including the StyleX layers.
That is what you want for deliberate overrides, but an element-level rule
written this way overrides Foldworks components (see
[Control typography](#control-typography-and-the-reset)). Put element resets
inside `@layer foldworks-reset { … }`, or in your own layer listed after the
Foldworks layers: `useCSSLayers: { before: [...foldworksLayers, "app-base"] }`.
A layer named only in application CSS has no fixed rank: it lands before or
after the StyleX layers depending on stylesheet order, which differs between
development and production.

### Control typography and the reset

The reset gives `button`, `input`, `optgroup`, `select`, and `textarea`
`font: inherit`, `color: inherit`, and `letter-spacing: inherit`, so native
controls use the theme font instead of the browser's control font. The rule has
zero specificity and sits in the lowest layer. Every Foldworks typography
setting wins over it: Button `size`, the sizes of Input, Textarea, NativeSelect,
and the other form controls, and any font styles you pass through `sx` or
`slotProps`.

Don't repeat the rule in unlayered application CSS:

```css
/* Overrides Foldworks control typography. */
button,
input,
select,
textarea {
  font: inherit;
}
```

Unlayered CSS outranks every StyleX layer, so this resets the font size, weight,
and line height that components set on the control element itself. In the
demo's UI kit it changes 168 of 220 controls: buttons drop from 13px/500 to the
inherited 16px/400, and inputs and selects from 14px to 16px. `sx` font styles
on those elements lose too. Typography set on a surrounding element is
unaffected. That covers Text, Heading, Badge, Field labels and descriptions, and
Tag and Stepper actions, which inherit their font from their container. If your
application needs the rule, put it in `@layer foldworks-reset`, as described
above.

## Theme gallery

In the demo, select a preset in the **Theme** menu. Shadcn is the neutral
default with crisp monochrome surfaces; Blueprint is dense and
enterprise-oriented; Office follows Fluent-like geometry; Fluent 2 maps the
Microsoft web light and dark color, font family, radius, shadow, and motion
tokens to Foldworks roles; Google uses tonal Material-like surfaces; Apple uses
layered system grays and generous corners; and Polaris follows Shopify's Polaris
2 admin palette, pill actions, and soft elevation. Compare the UI kit, Workers
workbench, and workflow builder using the same controls.

The Fluent 2 palette maps values from Microsoft's
[`@fluentui/tokens` web themes](https://github.com/microsoft/fluentui/tree/master/packages/tokens/src/themes/web)
to Foldworks semantic roles. The CSS theme does not load Fluent React or its
runtime; it keeps the Foldkit components and their existing behavior. Fluent
spacing and typography scales are not yet fully themeable because several
component recipes still use fixed StyleX values.

### Fluent 2 component coverage

The current catalog already covers Fluent's core buttons, form controls,
dialogs, navigation, tree, toolbar, tabs, and feedback. The most useful
Fluent-specific additions are:

| Priority | Primitive               | Reason                                                                                             |
| -------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| High     | AvatarGroup and Persona | Avatar exists, but grouped presence and identity details need shared overflow and status behavior. |
| High     | SearchBox               | InputGroup can render a search field, but it lacks a dedicated clear action and search semantics.  |
| Medium   | InfoLabel               | Field and Tooltip exist, but the paired help trigger and popover behavior is not packaged.         |
| Medium   | Rating                  | There is no accessible read-only and interactive star rating control.                              |

MessageBar can initially use `Alert` or `StatusMessage`; TagPicker behavior is
largely covered by `TokenField`. Those are lower-priority Fluent wrappers until
their distinct layouts or APIs are needed.

The shared recipes expose shape and elevation variables so presets can alter
more than color. Their base values preserve component behavior:

| Token                                                  | Controls                |
| ------------------------------------------------------ | ----------------------- |
| `--font-sans`                                          | Theme typography        |
| `--radius-button` / `--radius-button-sm`               | Button geometry         |
| `--radius-badge`                                       | Badge geometry          |
| `--radius-panel`                                       | Panel geometry          |
| `--badge-border`                                       | Badge outline treatment |
| `--button-outline-surface` / `--button-outline-shadow` | Outlined actions        |
| `--shadow-card` / `--shadow-panel` / `--shadow-float`  | Elevation hierarchy     |

## Usage

Button typography follows the shared type scale: `xs` and `sm` use 12px,
the default `md` uses 13px, and `lg` uses 14px, all at weight 500. Heights
remain 24, 28, 32, and 36px respectively. Keep application font resets out of
unlayered CSS so they do not override component typography; see
[Control typography](#control-typography-and-the-reset).

Primitives follow Foldkit's `view(config, h)` convention:

```ts
import { Send } from "@lucide/icons";
import { Badge, Button, Icon, Toolbar } from "@foldworks/ui";

Icon.view({ icon: Send, size: 20, label: "Send" }, h);

// Icon-only tools have a required accessible name and square hit area.
Button.icon({ icon: Send, label: "Send message", onClick: Message.ClickedSend() }, h);

// A link-looking action retains button semantics.
Button.view({ label: "Edit answer", variant: "link", onClick: Message.ClickedEdit() }, h);

Toolbar.view(
  {
    title: "Candidate workflow",
    description: "5 nodes · structured auto-layout",
    actions: [
      Badge.view({ label: "Draft saved", tone: "success", dot: true }, h),
      Button.view(
        {
          label: "Publish",
          icon: Send,
          variant: "primary",
          onClick: Message.ClickedPublish(),
        },
        h,
      ),
    ],
  },
  h,
);
```

Presentation helpers use the namespace-style surface:

```ts
import { Alert, Progress } from "@foldworks/ui";

Alert.view({ title: "Saved", description: "Your changes are live." }, h);
Progress.view({ value: 72, ariaLabel: "Upload progress" }, h);
```

Styled stateful families are available under `Stateful`. Embed them with
`h.submodel` and forward child updates through `Update.foldChild`:

```ts
import { Stateful } from "@foldworks/ui";

const AccountTabs = Stateful.Tabs.create<"overview" | "settings">();
const tabsModel = Stateful.Tabs.init({ id: "account-tabs" });
```

The [integration guide](docs/stateful.md) includes complete tabs wiring and
Dialog, Select, and Command usage. Dialog and Select support optional transitions
that respect reduced motion. Select uses Foldkit's custom Listbox engine;
`Select.control` and `NativeSelect.view` remain native browser controls.
For conditional fields and animated presence, see the [animation guide](docs/animation.md).

### Read-only answers

Set `presentation: "value"` on `Input`, `Textarea`, `NativeSelect`,
`RadioGroup`, `Checkbox`, `Field.input`, `Field.textarea`, or `Field.select` to
show a legible answer in a review form. `Select.control`, `NumberField`, and
`DateInput` support the same presentation. The default is `"control"`.
Text answers render as focusable, selectable read-only text. Selects and radio
groups show their option label. When a control has a `name`, its answer is
submitted through a hidden input. This is distinct from `isDisabled`, which
removes a control from form submission. Password answers are masked.

```ts
import { Field, Input, ReadOnlyValue } from "@foldworks/ui";

Field.input(
  {
    id: "legal-name",
    label: "Legal name",
    name: "legalName",
    value: model.legalName,
    presentation: "value",
  },
  h,
);

// For answers without an existing control, use the same presentation directly.
ReadOnlyValue.view({ ariaLabel: "Address", value: model.address }, h);

// onInput reports typing; onChange reports a committed edit.
Input.view({ value: model.name, onInput: Message.TypedName, onChange: Message.CommittedName }, h);
```

`ReadOnlyValue` is exported separately for composite answers while the
`presentation` prop keeps existing control APIs and form layouts intact.

Unstyled Foldkit engines are available under `Headless`. Use that
surface when an application needs the complete state machine, including focus
management, keyboard navigation, floating-element anchoring, commands, and
subscriptions:

```ts
import { Headless } from "@foldworks/ui";

const model = Headless.Dialog.init({ id: "edit-profile", isAnimated: true });
const update = Headless.Dialog.update;
const view = Headless.Dialog.view;
```

Responsive layout uses mobile-first values. A scalar applies at every width;
an object changes the value at named breakpoints:

```ts
Layout.Grid.view(
  {
    columns: { base: 1, md: 2, lg: 4 },
    gap: { base: "sm", lg: "lg" },
    children: cards,
  },
  h,
);
```

For component-local responsiveness, establish containment with
`Layout.Container.view({ query: true, ... }, h)` and set `responsiveTo:
"container"` on a nested grid, stack, or row.

`SplitView` arranges two or three panes in columns and stacks them below a
breakpoint. Pane `width` values are CSS grid tracks. Use `sticky` for a pane
that stays in view and scrolls independently, or `height: "fill"` inside a
bounded parent to make every pane scroll independently. `resizable` enables a
native horizontal resize handle on an individual pane. For a master/detail
layout, set `collapsedPane` to the active pane key; the other pane stays
mounted and appears again at the split breakpoint.

```ts
SplitView.view(
  {
    collapseBelow: "md",
    panes: [
      { key: "list", label: "Mappings", width: "280px", children: [list] },
      { key: "detail", label: "Inspector", sticky: true, children: [inspector] },
    ],
    collapsedPane: "detail",
  },
  h,
);

AppHeader.view(
  {
    title: "Compliance library",
    breadcrumb: { items: [{ label: "Forms", onClick: showForms }], current: "I-9" },
    status: [environmentBadge],
  },
  h,
);
```

`SplitView` accepts `responsiveTo: "container"` inside a query container,
`stickyOffset` for an app header, and `slotProps` for pane styling. `AppHeader`
also accepts leading content, actions, a linked or message-driven title, and
slot props for its regions.

See the [foundational primitives guide](docs/primitives.md) for layout,
typography, tags, numeric fields, and steppers.

Documentation is also published on the demo site at `/llms.txt`,
`/docs/ui/setup.md`, `/docs/ui/stateful.md`, `/docs/ui/capabilities.md`, and
`/docs/ui/primitives.md`.

`Icon.view` converts Lucide's framework-neutral icon data into Foldkit SVG
nodes. Static icon imports remain tree-shakeable, decorative icons are hidden
from assistive technology by default, and a `label` makes a standalone icon an
accessible image. Buttons render their icons decoratively and keep their
accessible name on the button label or `ariaLabel`.

### Tokens in application styles

Application StyleX should use the Foldworks tokens instead of literal colors,
spacing, and radii. Themes, dark mode, and product overrides then restyle the
application's own surfaces along with the components, and custom layouts match
component density. Adopting the tokens is the prerequisite for theming an
application.

Import the token groups from `@foldworks/ui/tokens.stylex`. The StyleX compiler
only resolves constants imported from `.stylex` modules. The same names
imported from the `@foldworks/ui` root fail to compile inside `stylex.create`
with "Could not resolve the path to the imported file"; the root export is for
reading the values at runtime.

```ts
import * as stylex from "@stylexjs/stylex";
import { colors, radii, space, typography } from "@foldworks/ui/tokens.stylex";

const styles = stylex.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    color: colors.surfaceForeground,
    gap: space.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizeMd,
  },
  gapRow: {
    backgroundColor: colors.warningSurface,
    color: colors.warning,
  },
});
```

| Group        | Values                                                                                                                                                                              | Themed              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `colors`     | Semantic roles such as `surface`, `foreground`, `foregroundMuted`, `border`, and `primary`; status pairs such as `success` and `successSurface`; `selection` and `dropTarget` roles | Yes, CSS variables  |
| `space`      | `xxs` 2px, `xs` 4px, `sm` 8px, `md` 12px, `lg` 16px, `xl` 24px, `xxl` 32px                                                                                                          | No, fixed constants |
| `radii`      | `sm`, `md`, and `lg` from the theme's `--radius` scale; `full`                                                                                                                      | Yes, except `full`  |
| `typography` | `fontFamily`; `sizeXs` 11px through `sizeXl` 16px; `weightMedium`, `weightSemibold`, `weightBold`; `lineHeightTight`, `lineHeightNormal`                                            | `fontFamily` only   |

`shadows`, `motion`, `sizes`, `breakpoints`, and `contentWidths` follow the same
pattern.

When converting existing styles:

- Choose colors by role, not by the closest match. Body text is `foreground`,
  secondary text is `foregroundMuted`, hairlines are `border`, and panels are
  `surface` with `surfaceForeground`. Status tints use the status pairs, for
  example `dangerSurface` behind `danger` text.
- Round spacing to the nearest `space` step, and font sizes to the nearest
  `typography` size. For headings and body copy, prefer the `Text` and
  `Heading` components.
- Leave literals for values the scales don't cover, such as a fixed column
  width or a display-size heading.
- In global CSS, use the variables the color and radius tokens resolve to, such
  as `var(--foreground)`, `var(--border)`, and `var(--radius-lg)`. `space` and
  the `typography` sizes are plain values with no CSS variable, so themes don't
  change them.

Use matching foreground roles when choosing a surface: `surfaceForeground` for
`surface`, `popoverForeground` for `popover`, `secondaryForeground` for
`surfaceSubtle`, and `accentForeground` for `surfaceHover`. These use the existing
theme variables and allow custom card and overlay palettes to differ from the canvas.

### Composition and slot styling

Composition-enabled components accept `sx` for StyleX styles on their root
element. Components with internal structure expose typed `slotProps`; every
slot uses the same `{ attributes?, sx? }` contract. Top-level `attributes` and
`sx` are shorthand for the root slot. When both forms are present, the explicit
`slotProps.root` styles are applied last:

This contract is available on Button, Badge, Card, Checkbox, Disclosure, Field,
Fieldset, Icon, Layout, SplitView, AppHeader, NumberField, Panel, SegmentedControl, Select, Switch,
Tag, Toolbar, and the stateful Dialog, Popover, Tabs, and Tooltip adapters.

```ts
Card.view(
  {
    title: "Review",
    children: [review],
    sx: styles.reviewCard,
    slotProps: {
      header: { sx: styles.compactHeader },
      content: {
        attributes: [h.DataAttribute("review-region", "content")],
        sx: styles.reviewContent,
      },
    },
  },
  h,
);
```

Slot attributes augment the attributes required by Foldkit's behavior and
accessibility engines. A repeated slot such as a tab `trigger` applies to every
instance. `sx` is the only StyleX override property; the former `style` alias is
no longer accepted.

## Testing views

`stylex.create` throws unless the StyleX compiler has transformed the file, and
Vitest doesn't run the compiler. You don't need to split views from update logic
to test them. Add the Foldworks test plugin instead:

```ts
// vitest.config.ts
import { foldworksStylexTest } from "@foldworks/ui/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({ plugins: [foldworksStylexTest()] });
```

The plugin aliases `@stylexjs/stylex` to `@foldworks/ui/testing/stylex`, a
runtime stand-in for the compiler's output. It also tells Vitest to process the
installed `@foldworks/*` packages through Vite so the alias reaches them;
Vitest otherwise loads installed packages directly with Node. If another
installed package imports StyleX, add it with
`foldworksStylexTest({ inline: ["@acme/design-system"] })`. When one Vite
config serves both the app and its tests, use the plugin in test mode only, in
place of the StyleX compiler plugin:
`plugins: mode === "test" ? [foldworksStylexTest()] : [stylex.vite(...)]`.

With the stand-in, each style's class name is its key, so a test can check
which styles a view applied:

```ts
// status.ts
import { sxAttrs } from "@foldworks/ui";
import { colors, radii, space } from "@foldworks/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { HtmlBuilder } from "foldkit/html";

const styles = stylex.create({
  pill: { borderRadius: radii.full, paddingInline: space.sm },
  failing: { backgroundColor: colors.dangerSurface, color: colors.danger },
});

export const status = <Message>(failing: boolean, h: HtmlBuilder<Message>) =>
  h.span(
    [...sxAttrs(h, styles.pill, failing && styles.failing)],
    [failing ? "Failing" : "Passing"],
  );

// status.test.ts
import { Option } from "effect";
import { inertHtml as h } from "foldkit/html";
import { Scene } from "foldkit/test";
import { expect, it } from "vitest";

import { status } from "./status";

it("marks failing journeys", () => {
  const html = status(true, h);
  if (html === null) throw new Error("Expected a status pill");
  expect(Scene.attr(html, "class")).toEqual(Option.some("pill failing"));
});
```

Dynamic styles also use their key as the class name, and their primitive values
become inline styles. Tokens resolve to their CSS variable or constant values.
The stand-in doesn't generate CSS, so check layout and appearance in a browser
test. The demo's Playwright visual tests do this.

## Boundaries

- `@foldkit/ui` owns headless behavior and accessibility.
- This package owns reusable visual language and composition.
- `@lucide/icons` supplies framework-neutral icon data; Foldkit owns the rendered SVG.
- Feature packages own workflow, grid, and form semantics.
- Applications map domain states onto generic variants such as `success`, `warning`, and `danger`.

Start with existing primitives. Add a new primitive only after the same visual or composition pattern appears in multiple real views.

## Tree explorer

`Tree` provides expansion, keyboard navigation, typeahead, single selection,
inline rename, and controlled move requests for application-owned hierarchies.
See the [tree integration guide](docs/tree.md) for data contracts and host policies.

## Workspace panes

`Workspace` provides nestable horizontal and vertical splits, pointer and keyboard
resizing, collapsible panes, focus recovery, and explicit scroll regions. Add its
serializable model to the parent and forward its updates and commands with
`Update.foldChild`. See the [workspace integration guide](docs/workspace.md).

## Operational compositions

`ValueInspector`, `ExplanationTree`, `ChangeSetPreview`, and `TransactionTimeline`
provide controlled presentation for inspecting values, explaining outcomes,
reviewing proposed changes, and reading attributed history. Import them from
`@foldworks/ui` and call `view(config, h)`.

- `ValueInspector` separates a value's origin from its freshness.
- `ExplanationTree` renders nested passed, failed, and unknown conditions with
  optional evidence descriptions. It uses semantic nested lists rather than an
  interactive ARIA tree widget.
- `ChangeSetPreview` accepts before/after values, added/removed/changed
  consequences, notices, and application-owned action elements.
- `TransactionTimeline` accepts attributed entries with timestamps, context,
  and value changes. Supply entries in the desired display order.

Applications own evaluation, permissions, temporal context, persistence, and
execution. These components render the data supplied to them and do not infer
business consequences or generate explanations. See the
[Workers reference](../../docs/workbench/README.md) for a complete composition
and browser-test screenshots.

## Desktop applications

`Shortcuts`, `Measurement`, `OverflowList`, `EditableText`, `TokenField`,
`PanelStack`, `DateInput`, and the stateful menu/overlay/date variants provide
controlled desktop workflows. See the [architecture and integration guide](docs/desktop.md)
and the **Desktop workspace** example in `/ui-kit`. Command definitions are
shared through `@foldworks/keyboard`; application actions remain host-owned.
