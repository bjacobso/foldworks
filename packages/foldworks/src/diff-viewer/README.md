# foldworks/diff-viewer

A controlled Foldkit view for rendering Git-style patches in unified or
side-by-side layouts. The package parses unified patches, aligns replacement
blocks for split rendering, exposes single-line and range-selection callbacks
for review tools, and leaves comment storage and repository transport to the
host application.

```ts
import { DiffViewer, parseUnifiedDiff } from "foldworks/diff-viewer";
import "foldworks/diff-viewer/styles.css";

const [file] = parseUnifiedDiff(patch);

DiffViewer.view(
  {
    file,
    mode: "Split",
    selectedRange: { path: file.path, side: "new", startLine: 20, endLine: 24 },
    onSelectLine: (selection) => Message.SelectedLine(selection),
    onStartSelection: (selection) => Message.StartedSelection(selection),
    onExtendSelection: (selection, method) => Message.ExtendedSelection({ ...selection, method }),
    onEndSelection: () => Message.EndedSelection(),
    onCancelSelection: () => Message.CancelledSelection(),
  },
  h,
);
```

Drag across line-number gutters to select a range, or focus a gutter and use
Shift+Arrow Up/Down. Escape cancels the selection. The view is deliberately
controlled: view mode, reviewed state, selected range, and thread metadata all
belong to the application. This keeps the renderer useful with local Git,
GitHub, GitLab, or agent-authored review workflows.

## Prose comparison

```ts
import { diffText, ProseDiff } from "foldworks/diff-viewer";

const parts = diffText(originalClause, revisedClause);
ProseDiff.view(
  {
    oldText: originalClause,
    newText: revisedClause,
    mode: "split", // "inline" by default
    oldLabel: "Reference",
    newLabel: "Rider",
  },
  h,
);
```

`diffText` returns compact `equal`, `addition`, and `removal` parts with exact
text and UTF-16 `oldFrom`/`newFrom` offsets. Filtering out additions reconstructs
the original; filtering out removals reconstructs the revision, including all
whitespace and punctuation. Word mode handles Unicode words and separate
punctuation. `{ granularity: "sentence", locale: "en" }` uses `Intl.Segmenter`.
It does not classify moved sentences or align unrelated sections.

Myers' search is bounded by `maxSearchCells` (default 1,000,000). If that budget
is exhausted, the changed middle becomes a removal plus an addition; common
prefix and suffix tokens remain equal. This retains exact source text while
avoiding unbounded diff-search memory on long, unrelated inputs. The view is
controlled and read-only, uses semantic `<ins>`/`<del>` markup and theme tones,
and needs the same package stylesheet as `DiffViewer`.

## Text sources and line extensions

`diffFile({ path, oldPath?, oldText, newText, context: 3 })` produces a bounded
Myers line diff without requiring a patch. `formatUnifiedDiff(file)` serializes
it. Empty sources imply added/deleted status; `oldPath` selects rename status.
CRLF is normalized to LF. Missing final newlines are represented by
`DiffLine.noNewline` and preserved in patches. Paths must be plain paths without
newlines or quoted patch escapes. Binary content is not inferred. Search uses
`maxSearchCells` (default one million), then falls back to a replacement.

`lineWidgets(ref)` inserts host Html below a line, spanning both columns in
split mode. Context rows expose both old and new refs; return a widget for only
the side on which it belongs. `annotations` adds gutter tones and accessible
labels, with optional messages beneath the range's last line. `lineGutterId`
provides a stable focus-return target. Paired replacement rows use semantic
`ins`/`del` word highlights; unequal blocks pair by index, without move detection.

`highlight(content, language)` can supply text-intelligence `SemanticToken`
ranges (UTF-16, exclusive end, open string kinds). Invalid or overlapping tokens
are ignored. The hook receives complete lines even on replacement rows; token ranges are
clipped to unchanged fragments and changed spans retain their change markup. The default is a small regex tokenizer.

## Revision anchors and context

`mapLine(file, side, line)` returns `mapped` with the opposite-side line,
`deleted` for removed/replaced lines, or `unknown` for invalid coordinates.
Unchanged lines outside hunks follow cumulative offsets. Parsed patches cannot
validate coordinates beyond the represented source; hosts must supply valid
line numbers.

`mapRange(fromFile, range, toFile)` maps to the later file's **new** side and
returns `{ state: 'current' | 'moved', range }` or
`{ state: 'outdated', reason }`. Every source line must survive contiguously.
`diffFile` retains full `source` snapshots, allowing exact revision-to-revision
mapping even for added lines. Serialization omits snapshots. Without both
snapshots, mapping requires a shared base path and surviving base-side lines;
newly added anchors conservatively become outdated. No fuzzy or move matching.
Hosts retain original anchors/snapshots for outdated threads and decide which
revision to reveal.

`contextGaps(file)` describes hidden context before/between hunks. Supply
`onExpandGap` to render an expansion button.
`expandContext(file, { oldText, newText }, gap, lines)` adds context preceding
the next hunk and joins touching hunks. It validates visible source content and
requested gap lines, rejecting stale gaps or mismatched sources. It does not
expand the trailing file region. Counts and file totals remain unchanged.

## Decoded configuration values and diagnostics

`diffValues(before, after, { key? })` accepts finite, acyclic JSON-like values and
returns added/removed/changed paths. Objects compare own string keys. Arrays with
unique `id` values on every item match by identity; `key(value, arrayPath)` can
supply host identity. Duplicate/missing keys fall back to indexes. Pure reorder
in an identity-matched array is ignored. Matched/added paths use after indexes;
removed paths use before indexes. This is a review summary, not an executable
patch. Non-JSON values and cycles throw. Inputs should fit in memory and within
the JavaScript call stack; there is no streaming or depth virtualization.

`ValueDiff.view({ changes, onSelectPath? }, h)` groups by parent path and renders
before/after JSON with semantic deletion/insertion markup. The optional path
callback lets a host use parser source maps; the package does not infer source
locations from decoded values.

`diagnosticsToAnnotations(path, text, diagnostics)` accepts code-editor /
text-intelligence diagnostics with UTF-16 offsets and exclusive `to`. It clamps
offsets, handles CRLF and point diagnostics, and maps error/warning/info/hint to
gutter tones on the new side. EOF points map to the last real line (line 1 for
empty text); an empty diff has no line on which to paint the annotation, so show
file-level validation in the host checks view as well.

## Change-request reference

The demo at `/diff-viewer` compares synthetic JSON configuration with `diffFile`,
offers line/semantic views, and maps schema diagnostics into gutters. Review
threads and suggestions are composed through line slots using
`foldworks/review`. The host retains source revisions and reanchors an applied
suggestion to its explicit replacement range; unrelated deleted anchors remain
outdated. This is a browser-local simulation.
