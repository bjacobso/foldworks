# Workspace panes

`Workspace` provides a controlled split between two labeled panes. Nest splits
for a structure/editor/inspector layout. It owns resizing, collapse controls,
focus recovery, and scroll boundaries; applications own content and persistence.

```ts
import { Workspace } from "@foldworks/ui";
import { Option } from "effect";
import { Update } from "foldkit";

// Include Workspace.Model in the parent schema and Workspace.Message in its union.
const workspace = Workspace.init({
  id: "documents", // Unique across mounted workspaces.
  size: 280,
  minSize: 180,
  maxSize: 480,
  secondaryMinSize: 360,
  orientation: "Horizontal",
  side: "Start",
});

const foldWorkspace = Update.foldChild({
  update: Workspace.update,
  read: (model: Model) => Option.some(model.workspace),
  write: (model, workspace) => ({ ...model, workspace }),
  toParentMessage: (message) => Message.Workspace({ message }),
});
// In the parent's update: Workspace: ({ message }) => foldWorkspace(model, message)

Workspace.view({
  model: model.workspace,
  toParentMessage: (message) => Message.Workspace({ message }),
  primary: { label: "Files", children: [fileTree] },
  secondary: { label: "Document", children: [editor], scroll: "Contained" },
}, h);
```

The parent must provide a bounded height and allow the workspace to shrink
(`min-height: 0; min-width: 0` in a flex/grid layout). The root fills that height.
`Horizontal` lays panes alongside each other; `Vertical` stacks them.
`side: "End"` puts the resizable primary pane at the end. Horizontal Start/End
follow the inherited text direction; arrow keys follow physical screen direction.

## Sizing and scrolling

Sizes and limits are CSS pixels. The primary pane has a preferred `size`; the
secondary pane fills the remaining space. On smaller containers, the effective
primary size shrinks without overwriting that preference. If both minimum sizes
cannot fit, the workspace scrolls along the split axis instead of clipping content.
Do not hide that overflow in an intermediate wrapper.

- `scroll: "Auto"` (default) gives pane content its own horizontal and vertical scrolling.
- `scroll: "Contained"` fills the pane with one child that owns scrolling, such as
  another `Workspace`. That child must implement its own scroll boundaries.

Use `showHeader: false` for a pane whose content already supplies its heading.
The secondary header reappears when needed to offer the primary pane's Show button.
The separator's Enter key remains available if the primary header is hidden.

Collapse is explicit and does not occur automatically during dragging. Collapsed
content remains mounted, with `display: none`, to retain editor and submodel state.
Applications with expensive hidden work can observe `model.collapsed` to suspend it.
Set `collapsible: false` for an always-open primary pane.

## Input and state

- Drag a separator with a mouse, pen, or touch. Escape or pointer cancellation
  cancels the current drag; pointer capture keeps movement active outside the handle.
- Arrow keys move by 10 pixels; Shift+Arrow moves by 50.
- Home/End move to the smallest/largest expanded size.
- Enter collapses/restores the primary pane. Labeled Hide/Show buttons offer the
  same action and move focus to the separator after the layout changes.

Separators expose their label, controlled pane, orientation, current pixel size,
and limits to assistive technology. The keyboard model follows the
[WAI-ARIA window splitter pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/).
Forward commands from `Workspace.update` through `Update.foldChild`; dropping them
breaks focus recovery. No parent subscriptions are required. Scoped mount effects
clean up pointer listeners and observers on unmount.

`Message.Resized({ size })` and `Message.Toggled()` provide the same operations to
application controls and agents. `currentSize(model)` returns the effective size.
`model.size` retains the preferred expanded size; `model.extent` is a measured value.
For saved layout preferences, persist `size` and `collapsed`, then pass them to
`init` along with the application's current limits. The package does not write storage.

The first version supports two panes per split, with nesting for larger layouts.
It does not provide tab docking, pane reordering, or automatic breakpoint collapse.
See the form-builder and code-editor demos for nested and stacked integrations.
