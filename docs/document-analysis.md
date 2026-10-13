# Document analysis primitives

A document analysis workspace reads a corpus of long documents, extracts values
from them, and lets a reviewer check every value against the exact words that
support it. It also compares the same clause across documents and maps how
documents and their parts relate. A labor-relations team working with hundreds
of collective bargaining agreements is the motivating workload. Their
agreements run to about 60 pages, and each one carries up to a few hundred
attributes.

This note records which pieces of that workspace belong in Foldworks and which
stay with the application. The five generic primitives below are implemented,
along with per-cell grid tones. The [document-analysis demo](https://foldworks.dev/document-analysis)
composes them using a synthetic 12-page agreement. Application record UI and the
items under “Later” remain design work.

## Boundary

The `@foldworks/ui` rule decides the split: product concepts and feature
behavior stay in their application or feature package. Foldworks gets generic
text, PDF, graph, and diff building blocks. Claims, attributes, confidence, and
review stay with the application.

| Layer                 | Owns                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foldworks             | PDF highlights, text layers, and page rendering; text with highlighted ranges; graph views; text diffs; citation markers                                     |
| Application record UI | A value card (value, quote, status, confidence), a source pane that keeps the PDF and text in sync, a review queue and its actions, and an attribute catalog |
| Application product   | Domain wording, branding, specific maps, extraction, inference, clustering, ontology storage, queries, policy languages and evaluation                       |

The first consumer is a document corpus explorer in the WorldVM family. It
should keep its record UI in a package beside its data layer, not in Foldworks
and not in its demo. The [WorldVM developer tools](./worldvm-devtools.md#boundary)
rules apply: no Foldworks package names WorldVM or its products, and each
primitive below needs a second use outside that explorer.

## Available primitives

The order follows value to the first consumer. Items 1 and 2 make extracted
values checkable against their source, which is the workspace's core promise.

### 1. PDF highlights, text layer, and on-demand rendering

Packages: `@foldworks/pdf` and `@foldworks/pdf-viewer`.

`PdfOverlay` keeps its single-rectangle API. `PdfHighlight` adds
`regions: [{ pageIndex, rects }]`, translucent tones, selection, and activation.
The first rectangle owns one accessible control; all rectangles dispatch the
same message. PDF geometry and placeholders exist before rasterization, so
`scrollTo` works on unrendered pages.

`readPdfText` and the pure `pdfTextItems` conversion expose text item bounds in
PDF user space. `locateQuote` normalizes whitespace, compatibility characters
(including ligatures), and explicit line-end hyphenation. It reports missing,
empty, and ambiguous quotes rather than guessing. Bounds cover **whole PDF.js
items**, not individual glyphs; partial-item quotes can highlight extra words.
The host may filter headers or provide OCR positions before matching.

`selectableText` mounts PDF.js' native text layer. `onSelectText` reports text
and user-space rectangles for selections across rendered pages. The mounted
viewer renders near the viewport from one shared PDF.js document, releases it
on unmount or document replacement, and retains at most `maxCachedPages`
images and associated text layers (default 8). It still mounts lightweight
wrappers for every page. See the [PDF viewer guide](../packages/pdf-viewer/README.md)
for cache behavior and selection limits.

Second uses: form review, contract and invoice checking, and any grounded answer
that cites a PDF.

### 2. Text with highlighted ranges

Package: `@foldworks/text-intelligence`, which already owns `TextRange`,
`segments`, the hover popup, and the shared token stylesheet.

`HighlightedText.view` displays read-only text with character ranges marked: clauses,
transcripts, and Markdown converted from PDFs. Each range has a key, a tone, an
optional label, an optional activation message, and optional tooltip text.

- Ranges may overlap. Painting splits the text with `segments`; a segment covered
  by several ranges shows that depth and activates the innermost range.
- Each activatable range is one keyboard stop in reading order, including fully
  covered ranges. Enter and Space activate it; `selectedKey` controls painting.
- A pure `snippets` helper cuts keyword-in-context windows around ranges, with
  ellipses and merged neighbors. Search-term highlighting uses the same view.

The application's source pane composes this view with item 1: activating a
range in the text highlights the same quote in the PDF, and the reverse.

### 3. Graph view

Package: `@foldworks/diagram`. It already has a normalized compound graph
document, layered layout, edge routing with label positions, and a `Diagram`
interaction submodel for selection, panning, and zoom. A ready-made, read-only view for exploration is available as
`@foldworks/diagram/graph`, also exported as `Graph` from the root.

- Themed node labels and edges using the shared UI CSS tokens, with edge labels
  and tones, replacing hand-picked coordinates and colors.
- Keyboard movement between nodes along edges and between siblings. Today's
  arrow keys nudge the selected element, which suits editing, not reading.
- Expand and collapse for compound nodes and for neighborhoods, so a large
  ontology can be explored from one node outward.
- Selection and activation messages, fit-to-content, and focus on a node.
- An accessible list or tree fallback that presents the same nodes and edges.

Uses in the first consumer: the component map, the automation graph, the
ontology map, rider-to-master edges, and the lineage view. Outside it: the
[developer tools](./worldvm-devtools.md#surfaces) ontology browser and program
view, and dependency graphs.

### 4. Text diff

Package: `@foldworks/diff-viewer`, alongside its line-based patch renderer.

- `diffText` preserves exact whitespace and punctuation, with word or sentence
  granularity and a bounded search fallback for large replacements.
- `ProseDiff.view` supports inline and side-by-side views with semantic
  addition/removal markup and theme tones. It does not infer moved sentences.

Uses: comparing a clause with a reference clause, rider replacements of master
sections, and language variants. A platform workbench already hand-builds form
and change-review diffs, so a second consumer exists.

### 5. Citation marker

Package: `@foldworks/ui`.

`Citation.styledViewInputs` creates a superscript number or chip with a
hover/focus preview and an activation message. The preview is application content,
often a snippet built with item 2. It reuses the `Stateful.Tooltip` engine; `Citation.popoverViewInputs` uses
`Stateful.Popover` for interactive previews with a separate source button. Any grounded answer
or AI interface needs it.

### Smaller additions

- **Timeline.** Date ranges and point events on a horizontal axis, for
  effective windows and expiration calendars. `Calendar` picks dates and does
  not display ranges. This belongs with
  [time and scheduling](./planned-primitives.md#time-and-scheduling).
- **Per-cell tone in `DataGrid` is available.** A column
  `tone(context)` callback provides neutral, info, success, warning, or danger
  styling while preserving selection and editing errors. The host supplies
  status labels such as conflict, unresolved, and verified.
- **Filter bar with facet counts** that can be serialized into the URL. This
  belongs with [collection views](./planned-primitives.md#collection-views-and-boards).

## Already available

The first consumer should use these now rather than hand-build them:

| Need                                       | Foldworks API                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Documents × attributes matrix              | `@foldworks/data-grid`: sticky headers, pinned columns, row virtualization, row groups, TSV clipboard                        |
| Article and section navigation             | `Tree` in `@foldworks/ui`                                                                                                    |
| Source in one pane, values in another      | `Workspace` for split panes and `PanelStack` for an inspector to drill into                                                  |
| Search across everything                   | `Stateful.Command`                                                                                                           |
| Citation preview engines                   | `Stateful.Popover` and `Stateful.Tooltip`                                                                                    |
| Charts, stat tiles, meters, and app chrome | `@foldworks/ui` and `@foldworks/sidebar`; richer charts are [planned](./planned-primitives.md#charts-and-data-visualization) |

The data grid virtualizes rows, not columns, so put documents in rows and
attributes in columns. Hand-built graph code should sit behind one module whose
input is shaped like a `DiagramDocument`, so it can move to item 3 without
touching its callers.

## Later

These came up while exploring the workload. Each waits for a host that needs it.

- **Annotated Markdown.** The application may store converted documents as
  Markdown with `{#id}` section IDs, `<!-- page N -->` markers, links to
  ontology terms with a host scheme such as `[seniority](term:seniority)`, and
  fenced policy blocks. Item 2 can display that text without Foldworks knowing
  the conventions. A source-mapped, virtualized Markdown reader with host
  renderers for link schemes and fenced blocks would follow if the application
  needs one.
- **Anchors that survive edits.** Re-anchoring a quote after its text changes is
  shared with [anchored review threads](./planned-primitives.md#anchored-review-threads)
  and the stable node attachments in the
  [outline workspace backlog](./outline-workspace.md#primitive-backlog). Design
  them together once documents are edited rather than only read.
- **Term references with an identity.** `Mentions` inserts plain spellings by
  design. Completion that inserts a link with a stable ID would extend it.
- **Policy editing.** Fenced policy blocks in an s-expression language need
  bracket matching and structural selection in `@foldworks/code-editor`.
- **Clause variants across many documents.** Grouping near-identical wording
  and diffing each group against a baseline is record UI built on item 4.
