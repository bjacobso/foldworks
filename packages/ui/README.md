# @foldworks/ui

Opinionated application chrome for Foldkit, built with StyleX and the accessible behavior from `@foldkit/ui`.

The package owns semantic tokens, focus treatment, control density, and reusable visual primitives. Product concepts and feature behavior stay in their application or feature package.

## Setup

Import the theme once from the application stylesheet:

```css
@import "@foldworks/ui/theme.css";
```

## Usage

Primitives follow Foldkit's `view(config, h)` convention:

```ts
import { Badge, Button, Toolbar } from "@foldworks/ui";

Toolbar.view(
  {
    title: "Candidate workflow",
    description: "5 nodes · structured auto-layout",
    actions: [
      Badge.view({ label: "Draft saved", tone: "success", dot: true }, h),
      Button.view(
        {
          label: "Publish",
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

## Boundaries

- `@foldkit/ui` owns headless behavior and accessibility.
- This package owns reusable visual language and composition.
- Feature packages own workflow, grid, and form semantics.
- Applications map domain states onto generic variants such as `success`, `warning`, and `danger`.

Start with existing primitives. Add a new primitive only after the same visual or composition pattern appears in multiple real views.
