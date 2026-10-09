# @foldworks/ui

## 0.3.0

### Minor Changes

- 0d75dc8: Add a composable Loader for labeled inline and block loading states or groups
  of decorative placeholders. Extend Skeleton with text and circle shapes, and
  Spinner with sizes and decorative mode. Both support disabling animation and
  respect reduced motion. Export loading config types and slot customization.
  Use the shared Skeleton for data-table loading rows.
- 0f16fd8: Add `TreeDiff`, a structural diff for any two versions of a tree whose nodes
  keep their ids. It marks nodes added, removed, moved, or edited, reports a
  reordering with the fewest moves, keeps removed nodes where they were, and
  shows only the region that changed, folding unchanged runs into a count.
  `diffTrees`, `changedRegion`, and `summarizeDiff` are exported. `ChangeSetPreview`
  gains a `content` slot for such a view, and its `changes` and `consequences`
  are now optional.
- 0f16fd8: Add `ValueTree`, a keyboard-navigable tree for nested values with lazily
  loaded branches. Expanding a node without loaded children sends
  `RequestedChildren` and shows “Loading…” until the host supplies them, and
  “Show N more” sends `RequestedMore`, so values can live behind handles in
  another process. `ValueTree.fromValue` builds nodes from plain values.

## 0.2.0

### Minor Changes

- 6e05824: Add styled Foldkit animation primitives for conditional content, fades, and directional slides. Animate dialogs and sheets with shared backdrop and panel motion recipes.
- c7b54c5: Add a consistent StyleX composition contract with root `sx` overrides and typed
  `slotProps` for component internals. Remove the former `style` override property;
  consumers should migrate those values directly to `sx`.
- ff6f731: Add a controlled Tree explorer with stable IDs, expansion, keyboard navigation,
  typeahead, explicit selection, inline rename, and sibling/indent/outdent move
  requests. Include immutable move helpers, host-defined move restrictions,
  focus recovery, and accessible nested tree semantics.
- 4db505c: Add keyed, configurable table rows and cells; native interactive item buttons and links; and CSS-driven stateless tooltips with custom triggers. Preserve the existing simple table, static item, and controlled tooltip APIs.
- 61cf008: Add typed scoped keyboard commands and shared trigger metadata, reusable box
  measurement and overflow composition, controlled inline editing, token entry,
  panel stacks, nested/context menus, stateful modal variants, and a styled
  single-date picker with typed date input. Reuse Foldkit lifecycle and selection
  engines, retain host-owned data/actions, and document integration boundaries.
- e071f6a: Add DescriptionList, Stat, Legend, and CodeBlock components; expand Badge, Tag,
  Progress, and Card presentation options; and expose read-only syntax highlighting
  from the code editor for CodeBlock consumers.
- 473c187: Replace the overlapping Neutral, Zinc, Blue, and Soft presets with a focused
  theme gallery: Shadcn as the default plus Blueprint, Office, Google, and
  Apple-inspired themes. Each includes light and dark palettes with distinct
  typography, geometry, and elevation.
- 3227682: Add a Fluent 2 web theme with light and dark token mappings and expose it in the demo theme selector.
- 05759a5: Add portal-first styled Menu, Popover, Tooltip, single/multi Combobox, and Toast
  submodels over Foldkit's complete interaction engines. Add responsive Container,
  Grid, Stack, and Row layout; semantic Text, Heading, Link, and VisuallyHidden;
  actionable Tag, controlled NumberField, and journey Stepper primitives. Export
  shared viewport/container breakpoints, content widths, and floating-layer policy.
- 69b5b21: Add responsive SplitView panes and a composable AppHeader with breadcrumbs, status, and actions. Preserve breadcrumb styling on message-driven buttons.
- e768f17: Add `TabBar`, a stateless tab strip for applications that swap whole screens.
  Tabs render no panels and accept a `hint`, a `badge`, and an optional `href`.
  Disabled navigation tabs stay focusable and explain why ("Not added", "Planned"), and a
  `trailing` slot holds status such as a release `Badge`. The default navigation
  semantics mark the current tab with `aria-current="page"`; `semantics:
"tablist"` provides a single-tab-stop tablist with Arrow, Home, and End
  selection. `TabBar.tabId` links an application-rendered panel.

  `Sidebar` items now accept an `onClick` message in place of, or alongside, an
  `href`, plus a `count` with an optional accessible `countLabel`. The current
  item is now highlighted. `Toggle` accepts a `count`; `ToggleGroup` and
  `SegmentedControl` options accept a `count`, a `badge`, `isDisabled`, and a
  `needsAttention` state with an announced `attentionLabel`.

- a974220: Add a Shopify Polaris 2 theme with light and dark palettes, pill-shaped actions,
  rounded containers, and Polaris-inspired elevation.
- 140b35f: Add controlled value inspector, explanation tree, change-set preview, and transaction timeline compositions for operational applications.
- c049320: Add read-only value presentation for form controls, commit handlers for text
  inputs, and icon-only and link-styled Button variants.
- 398d432: Add controlled, nestable Workspace panes with horizontal and vertical splits,
  pointer and keyboard resizing, minimum sizes, collapse/restore with focus recovery,
  and explicit scrolling boundaries. Pane preferences remain serializable and
  application-owned.
- de1cbea: Add actionable and collapsing breadcrumbs, label-shaped button triggers, adorned fields with multiline and keyboard ergonomics, composable stateful tooltip triggers, and richer stateful dialog anatomy with close actions, dividers, and width presets.
- 7c9ef65: Expose shared shape and shadow tokens and align button typography to a 12px
  compact, 13px default, and 14px large scale while preserving control heights.
- 1a632ef: Add styled Stateful Tabs, Dialog, Select, and Command submodels with Foldkit
  message/update integration, keyboard behavior, and focus handling. Preserve the
  existing view-only APIs with migration guidance and document their capability
  limits. Allow child attribute bundles in Button and catalog controls, expose
  matching surface foreground tokens, and include stateful integration documentation.
- 15f9d0a: Add `@foldworks/ui/vite` with `foldworksLayers`, which ranks the Foldworks reset
  below StyleX in `vite dev` through `useCSSLayers: { before: foldworksLayers }`,
  and `foldworksStylexTest()`, a Vitest plugin that renders StyleX views without
  the compiler through the new `@foldworks/ui/testing/stylex` runtime. Add
  `@foldworks/ui/layers.css` for setups that declare the layer order themselves,
  and document cascade layers, control typography under the reset, and adopting
  the tokens in application StyleX.

### Patch Changes

- 05217a5: Allow applications to supply compatible Effect, Foldkit, and StyleX versions
  through peer dependencies while keeping exact workspace build versions.
- c42f7c0: Give light themes a darker gray sidebar, a lighter gray application background, and white cards to establish three distinct surface layers.
- 1015b7a: Emit declarations with TypeScript 7. The JavaScript is unchanged, and the
  public types are equivalent. The declaration files are laid out differently:
  local helpers are declared once and referenced with `typeof`, named aliases are
  reused, and union members may be ordered differently. The field records of
  `defineMessageUnion` schemas (`Message.X.fields`) no longer print `readonly` on
  some keys; the Message types themselves are identical.
- Updated dependencies [61cf008]
- Updated dependencies [05217a5]
  - @foldworks/keyboard@0.2.0

## 0.1.0

### Minor Changes

- Publish the initial Foldworks package suite with controlled Foldkit behavior, StyleX styling, themeable UI components, and application primitives for data grids, forms, queries, workflows, navigation, document history, and PDF annotation.
