# Foundational UI primitives

These APIs cover recurring application jobs rather than mirroring another
component catalog. They preserve Foldworks' `view(config, h)` convention,
semantic tokens, and application-owned state.

## Responsive layout

`Layout.Container`, `Layout.Grid`, `Layout.Stack`, and `Layout.Row` accept
mobile-first responsive values with `base`, `sm` (640px), `md` (768px), `lg`
(1024px), and `xl` (1280px) keys. Omitted breakpoint values inherit the nearest
smaller value. Scalars apply from `base` onward. Values respond to the viewport
by default; a query container can make them respond to local inline size.

```ts
Layout.Container.view({
  size: "lg",
  query: true,
  padding: { base: "sm", md: "lg" },
  children: [Layout.Grid.view({
    columns: { base: 1, sm: 2, lg: 3 },
    responsiveTo: "container",
    gap: { base: "sm", lg: "xl" },
    children: cards,
  }, h)],
}, h)
```

Grid supports one through twelve explicit columns. Use `minColumnWidth` for an
auto-fitting grid. Stack and Row support responsive `direction` and `gap`, all
flex alignment and distribution modes, wrapping, custom attributes, and StyleX
overrides. Exported `breakpoints`, `containerBreakpoints`, and `contentWidths`
constants let application recipes use the same geometry.

## Semantic content

`Text` separates size, tone, weight, alignment, and truncation from whether the
element is a paragraph, span, or div. `Heading` keeps the semantic `level`
independent from visual `size`. `Link` adds consistent focus treatment and
secure defaults for external links. `VisuallyHidden` provides screen-reader-only
content and an optional focus-revealed skip-link treatment.

## Tags, numbers, and progress

`Tag` can be static, selectable, removable, or both. Selection and removal are
separate buttons so every action has a native accessible target.

`NumberField` renders a labelled native number input with decrement/increment
controls. The exported `normalize` and `stepValue` helpers clamp boundaries and
avoid ordinary decimal stepping drift. The parent owns the numeric value.

`Stepper` renders an ordered journey with current, complete, upcoming, and error
states. It derives statuses from `currentStepId` unless a step overrides its
status. Provide `onSelect` for nonlinear journeys; omit it for read-only progress.

## Floating layers

`Stateful.Layer` centralizes the portal-first anchor defaults used by Menu,
Popover, Tooltip, and Combobox: bottom-start placement, viewport collision
padding, a six-pixel gap, and portaling to the containing root. Override any
anchor field per instance. The underlying Foldkit engines own positioning,
dismissal, focus, keyboard behavior, and animation lifecycle.

See [stateful integration](./stateful.md) for wiring examples.
