# @foldworks/ui

Opinionated application chrome for Foldkit, built with StyleX and the accessible behavior from `@foldkit/ui`.

The package owns semantic tokens, focus treatment, control density, and reusable visual primitives. Product concepts and feature behavior stay in their application or feature package.

It currently wraps Foldkit's button, input, textarea, select, checkbox,
switch, fieldset, and disclosure behavior. Layout, panel, badge, segmented
control, toolbar, and Lucide icon helpers cover the shared visual composition
used by the demo packages.

## Setup

Import the base contract and the themes your application supports:

```css
@import "@foldworks/ui/base.css";
@import "@foldworks/ui/themes/neutral.css";
@import "@foldworks/ui/themes/zinc.css";
@import "@foldworks/ui/themes/blue.css";
```

For a neutral-only application, `@foldworks/ui/theme.css` remains a convenient
backward-compatible import.

The theme contract exposes the familiar shadcn semantic roles (`--background`,
`--foreground`, `--card`, `--primary`, `--muted`, `--accent`, `--destructive`,
`--border`, `--input`, `--ring`, and `--sidebar-*`) in OKLCH. StyleX component
recipes consume those native variables through `tokens.stylex.ts`, so changing
a variable updates every component without rebuilding or rewriting styles.

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
`--foldworks-ui-overlay`. They are intentionally distinct from success, warning,
danger, and information status colors, and include contrast-adjusted dark
values. The same roles are available through the exported StyleX `colors`
constants.

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
