# @foldworks/ui

Opinionated application chrome for Foldkit, built with StyleX and the accessible behavior from `@foldkit/ui`.

The package owns semantic tokens, focus treatment, control density, and reusable visual primitives. Product concepts and feature behavior stay in their application or feature package.

## Setup

Import the theme once from the application stylesheet:

```css
@import "@foldworks/ui/theme.css";
```

The theme exposes the default shadcn semantic roles (`--background`,
`--foreground`, `--card`, `--primary`, `--muted`, `--accent`, `--destructive`,
`--border`, `--input`, `--ring`, and `--sidebar-*`) in OKLCH. Foldkit-specific
tokens alias those roles, so consumers can override the familiar variables
without rewriting components. Add `.dark` to a root ancestor to use the
included dark palette.

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

## Boundaries

- `@foldkit/ui` owns headless behavior and accessibility.
- This package owns reusable visual language and composition.
- `@lucide/icons` supplies framework-neutral icon data; Foldkit owns the rendered SVG.
- Feature packages own workflow, grid, and form semantics.
- Applications map domain states onto generic variants such as `success`, `warning`, and `danger`.

Start with existing primitives. Add a new primitive only after the same visual or composition pattern appears in multiple real views.
