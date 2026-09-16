# @foldworks/diff-viewer

A controlled Foldkit view for rendering Git-style patches in unified or
side-by-side layouts. The package parses unified patches, aligns replacement
blocks for split rendering, exposes single-line and range-selection callbacks
for review tools, and leaves comment storage and repository transport to the
host application.

```ts
import { DiffViewer, parseUnifiedDiff } from "@foldworks/diff-viewer";
import "@foldworks/diff-viewer/styles.css";

const [file] = parseUnifiedDiff(patch);

DiffViewer.view({
  file,
  mode: "Split",
  selectedRange: { path: file.path, side: "new", startLine: 20, endLine: 24 },
  onSelectLine: (selection) => Message.SelectedLine(selection),
  onStartSelection: (selection) => Message.StartedSelection(selection),
  onExtendSelection: (selection, method) => Message.ExtendedSelection({ ...selection, method }),
  onEndSelection: () => Message.EndedSelection(),
  onCancelSelection: () => Message.CancelledSelection(),
}, h);
```

Drag across line-number gutters to select a range, or focus a gutter and use
Shift+Arrow Up/Down. Escape cancels the selection. The view is deliberately
controlled: view mode, reviewed state, selected range, and thread metadata all
belong to the application. This keeps the renderer useful with local Git,
GitHub, GitLab, or agent-authored review workflows.
