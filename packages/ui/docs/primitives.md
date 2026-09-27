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
Layout.Container.view(
  {
    size: "lg",
    query: true,
    padding: { base: "sm", md: "lg" },
    children: [
      Layout.Grid.view(
        {
          columns: { base: 1, sm: 2, lg: 3 },
          responsiveTo: "container",
          gap: { base: "sm", lg: "xl" },
          children: cards,
        },
        h,
      ),
    ],
  },
  h,
);
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

## Dense lists and tables

`Item.view` accepts a static item with `actions`, a button item with `onClick`,
or a link item with `href`. Interactive items use native buttons or links, with
`isSelected`, `isDisabled`, and non-interactive `trailing` content. Use `isPressed`
on button items for toggle state. Keep nested controls in a static item's
`actions` instead of putting them inside an interactive item.

`Table.view` still accepts simple string columns and array rows. Object columns
add width and alignment. Object rows require a stable `key` and can have
selection, tone, click handling, and an accessible label. Set `rowHeaders` to
make the first cell of each body row a row header; cell objects can override
that choice and add spans, width, alignment, attributes, and StyleX styles.

```ts
Table.view(
  {
    caption: "Recent invoices",
    rowHeaders: true,
    columns: [
      { label: "Invoice", width: "12rem" },
      { label: "Amount", align: "end" },
    ],
    rows: invoices.map((invoice) => ({
      key: invoice.id,
      cells: [invoice.number, { content: invoice.amount }],
      onClick: Message.OpenedInvoice({ id: invoice.id }),
      ariaLabel: `Open invoice ${invoice.number}`,
      isSelected: invoice.id === selectedInvoiceId,
    })),
  },
  h,
);
```

The row's first cell contains a keyboard-focusable button when `onClick` is
provided. `slotProps` styles the root, table, caption, head, body, header cells,
rows, and body cells. Use `@foldworks/data-table` or `@foldworks/data-grid` for
sorting, selection controls, and grid behavior.

## Stateless tooltips

`Tooltip.view({ mode: "stateless", ... })` displays a plain-text panel on hover
or focus without adding tooltip state to the application model. The default
trigger is a focusable span; `renderTrigger` lets an existing button or link own
focus. An `id` connects the trigger with `aria-describedby`; without one, the
label is attached with `aria-description`.

```ts
Tooltip.view(
  {
    mode: "stateless",
    id: "save-help",
    trigger: ["Save"],
    label: "Save the current draft",
    placement: "bottom",
    renderTrigger: (attributes, children, h) =>
      h.button([...attributes, h.Type("button"), h.OnClick(Message.Saved())], children),
  },
  h,
);
```

The stateless panel uses CSS positioning and supports `top`, `bottom`, `start`,
and `end`. Use `Stateful.Tooltip` for hover delay, Escape handling, and viewport
collision. Tooltip labels are non-interactive text; use a popover for controls.

## Floating layers

`Stateful.Layer` centralizes the portal-first anchor defaults used by Menu,
Popover, Tooltip, and Combobox: bottom-start placement, viewport collision
padding, a six-pixel gap, and portaling to the containing root. Override any
anchor field per instance. The underlying Foldkit engines own positioning,
dismissal, focus, keyboard behavior, and animation lifecycle.

See [stateful integration](./stateful.md) for wiring examples.
