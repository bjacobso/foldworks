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

## Setup

Foldworks ships its StyleX expressions so applications can combine them with
their own atomic styles. Configure the StyleX transform in the consuming
application. For Vite:

```sh
pnpm add -D @stylexjs/unplugin
```

```ts
// vite.config.ts
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [stylex.vite({ runtimeInjection: false, useCSSLayers: true })],
});
```

The plugin automatically discovers installed packages that depend on
`@stylexjs/stylex`, including the Foldworks packages.

Import the base contract and the themes your application supports:

```css
@import "@foldworks/ui/base.css";
@import "@foldworks/ui/themes/neutral.css";
@import "@foldworks/ui/themes/zinc.css";
@import "@foldworks/ui/themes/blue.css";
```

For a neutral-only application, `@foldworks/ui/theme.css` remains a convenient
backward-compatible import.

`base.css` also includes a modern browser reset in the low-priority
`foldworks-reset` cascade layer. StyleX atomic styles and application CSS remain
unlayered, so they always override the reset regardless of stylesheet order.

The theme contract exposes the familiar shadcn semantic roles (`--background`,
`--foreground`, `--card`, `--primary`, `--muted`, `--accent`, `--destructive`,
`--border`, `--input`, `--ring`, and `--sidebar-*`) in OKLCH. StyleX component
recipes consume those native variables through `tokens.stylex.ts`, so changing
a variable updates every component without rebuilding or rewriting styles.

Light themes use a soft gray application background, a darker sidebar, and
white card surfaces to distinguish the workspace from its content.

Set `data-theme` and the resolved `data-mode` on a root ancestor:

```html
<html data-theme="blue" data-mode="dark" class="dark">
```

`data-theme` accepts `neutral`, `zinc`, or `blue`. `data-mode` accepts `light`
or `dark`; the optional `.dark` class remains compatible with shadcn theme
providers. CSS variables cascade, so the same attributes can theme a nested
subtree. An application can define its own theme by overriding the semantic
variables after the Foldworks imports:

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

## Usage

Primitives follow Foldkit's `view(config, h)` convention:

```ts
import { Send } from "@lucide/icons";
import { Badge, Button, Icon, Toolbar } from "@foldworks/ui";

Icon.view({ icon: Send, size: 20, label: "Send" }, h);

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

All catalog entries use the same namespace-style surface:

```ts
import { Alert, Dialog, Progress, Table, Tabs } from "@foldworks/ui";

Alert.view({ title: "Saved", description: "Your changes are live." }, h);
Progress.view({ value: 72, ariaLabel: "Upload progress" }, h);
Tabs.view({ id: "settings", value, tabs, onChange: Message.SelectedTab }, h);
```

Stateful families with a Foldkit engine are also available under `Headless`. Use that
surface when an application needs the complete state machine, including focus
management, keyboard navigation, floating-element anchoring, commands, and
subscriptions:

```ts
import { Headless } from "@foldworks/ui";

const model = Headless.Dialog.init({ id: "edit-profile", isAnimated: true });
const update = Headless.Dialog.update;
const view = Headless.Dialog.view;
```

`Icon.view` converts Lucide's framework-neutral icon data into Foldkit SVG
nodes. Static icon imports remain tree-shakeable, decorative icons are hidden
from assistive technology by default, and a `label` makes a standalone icon an
accessible image. Buttons render their icons decoratively and keep their
accessible name on the button label or `ariaLabel`.

StyleX consumers can import semantic token groups directly. These constants
resolve to the public CSS variables at runtime:

```ts
import * as stylex from "@stylexjs/stylex";
import { colors, radii, space, typography } from "@foldworks/ui";

const styles = stylex.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    color: colors.foreground,
    gap: space.md,
    fontFamily: typography.fontFamily,
  },
});
```

## Boundaries

- `@foldkit/ui` owns headless behavior and accessibility.
- This package owns reusable visual language and composition.
- `@lucide/icons` supplies framework-neutral icon data; Foldkit owns the rendered SVG.
- Feature packages own workflow, grid, and form semantics.
- Applications map domain states onto generic variants such as `success`, `warning`, and `danger`.

Start with existing primitives. Add a new primitive only after the same visual or composition pattern appears in multiple real views.

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
