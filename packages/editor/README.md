# @foldworks/editor

A native Foldkit document editor. Its own immutable document engine handles text
edits, marks, selection, block transactions, and undo. The browser surface uses
contenteditable and a scoped renderer; there is no Tiptap or ProseMirror dependency.

This is an initial editor preview. The `/editor` demo includes the complete
Markdown → visual editing → custom blocks → Markdown workflow.

## Integration

```ts
import { Editor } from "@foldworks/editor";
import "@foldworks/ui/theme.css";
import "@foldworks/editor/styles.css";

const Article = Editor.define();
const editor = Article.init({
  id: "article",
  markdown: "# Hello\n\nStart here.",
});

// In the parent's schema:
// editor: Article.Model
// In its message union:
// GotEditor: { message: Article.Message }

// In the parent's view:
h.submodel({
  slotId: "article",
  model: model.editor,
  view: Article.view,
  toParentMessage: (message) => ParentMessage.GotEditor({ message }),
});
```

Lift `Article.update` with `Update.foldChild`, writing its model into the parent.
Handle `Article.OutMessage.Changed` to persist `{ document, revision }`. The package
does not save to a backend or localStorage automatically. Instance IDs must be
unique. Browser listeners belong to the mounted view; `Article.subscriptions` is
provided as an empty integration facade because the surface owns those listeners.

`Article.init` accepts `document`, `markdown`, and `editable`. Use the exported
`Document` schema to decode saved JSON before passing it to `init`. Invalid native
documents throw at initialization; invalid Markdown initializes an empty document
with diagnostics. Existing-document imports fail without replacing content.

`Article.Message.Load({ document, expectedRevision })` explicitly loads another
document and clears history. Ordinary snapshot persistence must never echo a
load back to the editor. Source apply/import are undoable; a stale source draft,
file import, or explicit load cannot overwrite a newer revision.

## Custom blocks

Definitions are static configuration outside the serializable model:

```ts
import { Editor, Message, type BlockDefinition } from "@foldworks/editor";

const Project: BlockDefinition = {
  name: "project",
  label: "Project reference",
  kind: "atom",
  defaults: { label: "New project", projectId: "draft" },
  validate: (attrs) => Boolean(attrs.label) && Boolean(attrs.projectId),
  view: (node, h) =>
    h.input([
      h.AriaLabel("Project label"),
      h.Value(node.attrs.label ?? ""),
      h.OnChange((value) =>
        Message.Attributes({ id: node.id, key: "label", value }),
      ),
    ]),
  portable: (node) => node.attrs.label ?? "Project",
};

const Article = Editor.define({ blocks: [Project] });
```

Use `kind: "container"` for a custom block with editable child blocks and `"text"`
for an inline-content leaf. `view` supplies non-editable Foldkit chrome; the engine
owns the editable content beneath it. Chrome is a scoped `Runtime.makeElement`
with an inbound node port. Compatible attribute updates preserve its runtime,
and removal destroys it. Never put editor-managed text content into custom chrome.
Use `validate` to call an application Effect Schema validator when needed.

The built-in callout demonstrates a container and editable tone control. The demo's
project reference demonstrates an independently registered atom. Names must be
unique, alphanumeric identifiers beginning with a letter; built-ins cannot be
redefined. Custom definitions and schemas cannot change during an editor session.

## Document and Markdown contracts

Saved JSON is `{ version: 1, blocks }`. Blocks have stable IDs, a registered type,
string attributes, marked text runs, and children. Documents are schema-validated,
with limits of 20 levels and 10,000 blocks. Selection, history, and browser objects
are not part of the document. Custom directives currently support version 1.

```ts
import { importMarkdown, exportMarkdown } from "@foldworks/editor";

const imported = importMarkdown(source, Article.registry);
// imported.value is absent when diagnostics reject the import.
const native = exportMarkdown(document, Article.registry);
const strictPortable = exportMarkdown(document, Article.registry, "portable");
const portableWithFallbacks = exportMarkdown(
  document,
  Article.registry,
  "portable",
  true,
);
```

Foldworks Markdown uses versioned directives:

```markdown
:::foldworks-callout{tone="info" version="1"}
A **rich-text** note.
:::

::foldworks-project{label="Launch" projectId="launch" version="1"}
```

Registered blocks retain content and attributes in this dialect. Portable export
converts containers to blockquotes and atoms to descriptive text, and reports
lost custom attributes. Strict portable export fails on those losses. The demo's
Portable export button explicitly selects fallbacks and displays the diagnostics.

The codecs promise semantic round trips for supported content, not identical
source spelling/whitespace or stable IDs across Markdown conversion. The current
schema does not support arbitrary HTML, images, tables, frontmatter, footnotes,
unknown directives, or reference-style link definitions; imports containing them
are rejected. Original source remains available for correction. File imports are
limited to 1 MB.

## Available behavior

- Paragraphs, headings, bold/italic/strike/inline code, safe links, quotes, code
  blocks, bullet/numbered/task lists, rules, and custom blocks.
- Toolbar, floating selection menu, block insertion menu (`/` at a paragraph's start), and Markdown heading,
  quote, bullet/numbered/task-list typing shortcuts.
- Forward/backward cross-block selection, range replacement, split/join, grapheme
  deletion, list-item split/empty-item exit, Tab/Shift+Tab indent/outdent, and bounded undo/redo with typing groups.
- Top-level drag handles and keyboard-accessible move up/down, duplicate, and
  delete controls. Lists and containers move as units. Duplicates get fresh IDs.
- `.md` import, export/download, source Apply/Cancel, and read-only mode.
- Native Foldkit custom block chrome and semantic token-based styling.

The exported document operations and codecs are DOM-independent. `toolbarView` and
`contentView` are available for custom presentation. `contentView` needs the model,
registry, a Foldkit message builder, and optionally an accessible label.

## Browser boundary and current limits

The surface owns the editable host's children through Foldkit VNode lifecycle
hooks. It projects the same pure reducer synchronously between browser events;
Foldkit remains the owner of the committed model. Editing controls use that same
surface dispatch path so immediate typing sees current DOM and selection. Each
frame reconciles the projection with the parent model.

Composition preserves the native text DOM until commit. A revision conflict
retains the newer application document and reports the rejected native commit.
After-input reconciliation handles native edits within a text leaf. General
browser-generated structural mutations are not a supported editing API.

Clipboard copy/cut/paste currently transfers plain text, deliberately excluding
untrusted HTML. Use Markdown source/file import when preserving structure matters.
There is no rich-HTML import, so no unsanitized HTML is injected. Link protocols are
allowlisted, and custom imports never execute code.

This preview does not yet include nested drag,
multi-block drag, rich clipboard fragments, arbitrary inline
atoms, tables, images/uploads, or collaboration. Read-only mode still mounts the
surface; it is not a server-rendering API. These remain follow-up work in PLAN.md.

Automated browser tests pass in Chromium and Firefox, including a simulated
composition sequence. The narrow-screen layout has been inspected at 390 px.
Native IME, mobile keyboards, screen readers, and Safari still require verification.
WebKit could not launch in the Amazon Linux sandbox because its system libraries
were unavailable.

Unchanged document subtrees and DOM nodes are retained across edits. A six-character
Chromium sample in this sandbox measured 33–55 ms per character with 1,000 paragraphs,
including Playwright dispatch and two animation frames. This is a smoke measurement,
not an input-to-paint guarantee; long text leaves and deeply nested documents need
separate profiling. The browser fixture accepts `?blocks=100` or `?blocks=1000`.

## Validation

```sh
pnpm --filter @foldworks/editor test
pnpm --filter @foldworks/editor typecheck
pnpm run build:packages
pnpm --filter @foldworks/demo exec vitest run --config vitest.e2e.config.ts e2e/editor.e2e.test.ts
EDITOR_BROWSER=firefox pnpm --filter @foldworks/demo exec vitest run --config vitest.e2e.config.ts e2e/editor.e2e.test.ts
```

The browser suite builds `e2e/fixtures/editor.html` into
`.context/editor-e2e-dist` alongside the demo. Serve that directory to profile the
two-instance fixture. Package/release checks also compile and bundle the editor
from its packed npm artifact in a clean Vite consumer.
