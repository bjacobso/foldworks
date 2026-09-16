# @foldworks/diff-viewer

A controlled Foldkit view for rendering Git-style patches in unified or
side-by-side layouts. The package parses unified patches, aligns replacement
blocks for split rendering, exposes line-selection callbacks for review tools,
and leaves comment storage and repository transport to the host application.

```ts
import { DiffViewer, parseUnifiedDiff } from "@foldworks/diff-viewer";
import "@foldworks/diff-viewer/styles.css";

const [file] = parseUnifiedDiff(patch);

DiffViewer.view({
  file,
  mode: "Split",
  onSelectLine: (selection) => Message.SelectedLine(selection),
}, h);
```

The view is deliberately controlled: view mode, reviewed state, selected line,
and thread metadata all belong to the application. This keeps the renderer
useful with local Git, GitHub, GitLab, or agent-authored review workflows.
