# Tree explorer

`Tree` renders an application-owned hierarchy and manages navigation, expansion,
single selection, inline rename, and move requests. The form builder uses it for
sections and pages; the code-editor demo uses it for an in-memory file navigator.

## Data and integration

Supply a flat forest of `Tree.Node` records. Each record has a stable `id`, a
`label`, a `parentId` (`null` for a root), and explicit `branch`, `renamable`, and
`movable` flags. Array order determines sibling order. Parents must exist and
have `branch: true`. Duplicate IDs, missing parents, and cycles throw before
rendering or traversal so data does not silently disappear.

```ts
import { Tree } from "@foldworks/ui";

const nodes: ReadonlyArray<Tree.Node> = [
  { id: "src", label: "src", parentId: null,
    branch: true, renamable: true, movable: true },
  { id: "main", label: "main.ts", parentId: "src",
    branch: false, renamable: true, movable: true },
];

const tree = Tree.init({ id: "file-tree", expandedIds: ["src"], selectedId: "main" });

Tree.view({
  model: tree,
  nodes,
  label: "Files",
  toParentMessage: message => Message.Tree({ message }),
}, h);
```

Include `Tree.Model` in the parent schema and `Tree.Message` in its message union.
Forward commands and outgoing requests using `Update.foldChild`. Pass the same
current nodes and movement policy to both `view` and `update`:

```ts
const foldTree = (model: Model, message: Tree.Message) => Update.foldChild({
  update: (tree: Tree.Model, event: Tree.Message) =>
    Tree.update(tree, event, { nodes: model.nodes }),
  read: (parent: Model) => Option.some(parent.tree),
  write: (parent, tree) => ({ ...parent, tree }),
  toParentMessage: message => Message.Tree({ message }),
  foldOutMessage: (event: Tree.OutMessage) => (parent: Model) => {
    switch (event._tag) {
      case "Selected": return { model: { ...parent, openedId: event.id } };
      case "Renamed": return { model: { ...parent,
        nodes: parent.nodes.map(node => node.id === event.id ? { ...node, label: event.label } : node),
      } };
      case "Moved": return { model: { ...parent, nodes: Tree.moveNodes(parent.nodes, event) } };
    }
  },
})(model, message);
```

Import `Update` from `foldkit` and `Option` from `effect` in the parent. Hosts own
validation, authorization, persistence, and undo. Requests do not change node data
until the host accepts them. The form demo applies them through its existing
document operations and history; file titles and folders in the code demo are
local demonstration data, not operations on the user's filesystem.

## Keyboard and pointer behavior

- Up/Down: move focus among visible nodes. Home/End: first/last visible node.
- Right: expand a branch, then move to its first child. Left: collapse a branch,
  then move to its parent.
- Enter or Space: select the active node. Pointer clicks on a label also select it.
  Selection is separate from focus, so arrow navigation does not open records.
- Type letters to find a label prefix. The buffer expires after 700 ms; repeating
  a letter cycles matching nodes.
- F2: rename the active node. Enter/Save name commits; Escape/Cancel rename cancels.
  Blank names remain editable, and a concurrent label change cancels a stale rename.
- Alt+Up/Down: move among siblings. Alt+Right: indent beneath the preceding branch.
  Alt+Left: outdent immediately after the parent. Equivalent buttons are provided.

The tree has a single tab stop and uses `aria-activedescendant` for navigation,
with nested `treeitem`/`group` roles and explicit selection/expansion metadata.
Rename temporarily moves DOM focus to a labeled input. Forwarding commands is
required for focus recovery and scrolling the active item into view. No mount
listeners or parent subscriptions are required.

## Moves and external changes

`Moved` requests contain `{ id, parentId, index }`. The index refers to the
destination sibling list **after removing the moved node**. `moveNodes` retains
descendant parent references and rejects invalid indices, leaf destinations,
cycles, and moves of an immovable node. Set `canMove` to enforce domain constraints;
it controls both button availability and keyboard-generated requests.

For example, forms can allow sections only at the root and pages only under
sections. Indent/outdent buttons are then disabled where those operations would
violate the document schema. Do not map Tree indices directly to a drag-and-drop
API that uses positions in the original list without adjusting them.

Call `Tree.reconcile(model, nodes)` after external changes if you want to persist
clean navigation state. Rendering and updates also reconcile defensively: removed
IDs are discarded, and a hidden active descendant falls back to a visible ancestor.
Keep IDs stable across rename and reordering. Give each mounted tree a unique ID.

The first version is a single-select, eagerly rendered tree for small and medium
hierarchies. Lazy loading, virtualization, multi-selection, and tree drag-and-drop
are not included. The form builder retains its existing Card view for drag-and-drop.
