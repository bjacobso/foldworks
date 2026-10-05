# @foldworks/code-editor

A native Foldkit code editor with syntax highlighting, model-owned undo history,
find/replace, suggestions, hover information, and versioned diagnostics. A host's
language service can supply highlighting, hover, and completions. The browser
textarea handles text input and selection; Foldkit owns the editor state and
highlighted UI.

```sh
pnpm add @foldworks/code-editor
```

```ts
import { CodeEditor } from "@foldworks/code-editor";
import "@foldworks/code-editor/styles.css";

const editor = CodeEditor.init({
  id: "configuration", // Unique among mounted editors.
  uri: "file:///configuration.json",
  languageId: "json",
  text: '{"enabled":true}',
});

// Inside your parent view:
CodeEditor.view(
  {
    model: model.editor,
    label: "Configuration",
    meta: "JSON · validated configuration", // Optional; null removes header detail.
    showToolbar: true, // Optional; defaults to true.
    showInspector: false,
    toParentMessage: (message) => Message.Editor({ message }),
  },
  h,
);
```

Add `CodeEditor.Model` to the parent model schema and `CodeEditor.Message` to its
message union. Fold child updates using Foldkit's normal pattern:

```ts
const foldEditor = Update.foldChild({
  update: CodeEditor.update,
  read: (model: Model) => Option.some(model.editor),
  write: (model, editor) => ({ ...model, editor }),
  toParentMessage: (message) => Message.Editor({ message }),
  foldOutMessage: (event: CodeEditor.OutMessage) => (model: Model) => {
    // ChangedDocument: persist/validate event.document according to app policy.
    // ChangedSelection: track event.selection if needed.
    // RejectedOperation: display or handle event.reason.
    return { model };
  },
});
```

No custom element registration or parent subscription is required. Mount streams
own the browser listeners and release them on unmount. Returning to a route
restores document, selection, and history from the model. Importing the package
and initializing a model do not access browser globals; mounting the view requires
a browser. Import Foldworks theme CSS if desired; the editor has fallback colors.

## Host operations

Use `CodeEditor.execute(operation)` to turn a shared operation into an editor
message. The same operations and outgoing events are available independently at
`@foldworks/code-editor/contracts`.

```ts
CodeEditor.execute(
  CodeEditor.Operation.ApplyEdits({
    expected: CodeEditor.documentVersion(model.editor.document),
    edits: [{ from: 0, to: 0, insert: "// Note\n" }],
    // Optional selection in the resulting document; otherwise mapped through edits.
  }),
);

CodeEditor.execute(CodeEditor.Operation.Undo());
CodeEditor.execute(
  CodeEditor.Operation.SetOptions({
    ...model.editor.options,
    lineWrapping: true,
  }),
);
```

`ApplyEdits` is atomic and undoable, and leaves focus and scrolling where they
are; send `Focus` after it to move focus. `Select({ expected, selection })` focuses
and reveals a range. Both check the expected URI, session, and revision; commands also
check the live input's mount identity and revision, including unacknowledged input.
Stale operations report `RejectedOperation`. Recompute against the latest snapshot.
Edits reject read-only mode and composition; finish composing before retrying.

Other operations are `Focus`, `Undo`, `Redo`, `ReplaceDocument`, `SetLanguage`,
`SetOptions`, and `SetDiagnostics`. Replacement starts a new session and clears
history. Language changes retain history. Options control wrapping, line numbers,
read-only mode, tab size, and theme. `ChangedDocument` includes an origin of `input`,
`external`, `undo`, or `redo`. Loading a document or changing its language emits
an `external` change. These are acknowledgements, not requests to replace text again.

Ranges use zero-based UTF-16 offsets with exclusive `to`, and edit ranges refer
to the same base document in ordered, nonoverlapping batches. Splitting surrogate
pairs is rejected. Internal text uses LF; `normalizeText` converts external text.
`exportText` restores the CRLF preference detected at load. `positionAt` and
`offsetAt` convert between offsets and zero-based UTF-16 line/character positions.

## Highlighting and validation

JSON, YAML, JavaScript, and TypeScript use a small stateful lexer; unknown language IDs
fall back to plain text. This does not perform type checking or parse full JSX/TSX
syntax. JSON syntax validation runs locally and shows squiggles and a navigable
problems list. It does not validate JSON Schema.

For a read-only snippet, `highlight(code, language)` returns tokenized lines
without creating an editor model. Pass it to `@foldworks/ui`'s `CodeBlock`:

```ts
import { highlight } from "@foldworks/code-editor";
import { CodeBlock } from "@foldworks/ui";

CodeBlock.view({ code: '{"enabled": true}', language: "json", highlight }, h);
```

### JSON and YAML with an Effect Schema

Wrap an implementation with `withSchema` and use the resulting `init` and `update`
when composing your app. Its model, messages, view, and operations stay the same:

```ts
import { Schema as S } from "effect";
import { CodeEditor } from "@foldworks/code-editor";
import { withSchema, validate } from "@foldworks/code-editor/structured";

const Configuration = S.Struct({
  name: S.String.check(S.isMinLength(1)),
  enabled: S.Boolean,
  retries: S.Number.check(S.isInt(), S.isBetween({ minimum: 0, maximum: 10 })),
});
const ConfigurationEditor = withSchema(CodeEditor.implementation, Configuration);
const editor = ConfigurationEditor.init({
  id: "configuration",
  uri: "file:///configuration.yaml",
  languageId: "yaml", // Or "json"; "yml" is also accepted.
  text: "name: Demo\nenabled: true\nretries: 3\n",
});

// Use ConfigurationEditor.update in Update.foldChild; keep CodeEditor.Model/Message.
// You can also validate a document directly, independently of any editor:
const diagnostics = validate(Configuration, editor.document);
```

Validation runs on initialization and document changes, including undo/redo,
replacement, and language changes. It checks strict JSON syntax or a single YAML
1.2 document before decoding the parsed value with the Effect Schema. All schema
errors are collected; unknown properties are errors by default. Pass
`{ onExcessProperty: "ignore" }` to either helper to allow them. Other languages
are left alone. Schema transformations validate the encoded input without rewriting
the source text or applying defaults to it.

Errors point to field values and array elements using source offsets. Missing
fields point to the nearest existing container, and paths through YAML aliases
point to the alias. The problems list includes the schema path and supports jumping
to its range. YAML comments, block scalars, and ordinary aliases are supported;
cyclic aliases and excessive alias expansion produce errors. YAML mapping keys
must be strings. The wrapper owns the `json` and `yaml` diagnostic sources and
preserves other sources when applying results. Editing and saving remain available
even when the document is invalid.

The schema stays in the composition closure, outside the serializable Foldkit
model. This helper accepts synchronous decoders without required Effect services;
asynchronous checks belong in a host command or worker that returns versioned
diagnostics. Parsing and decoding currently scan the complete document per edit.
The separate `/structured` entry imports the `yaml` parser; the default editor and
`/contracts` entries do not load it. The demo's JSON and YAML configuration examples
share one schema; select either from **Example language** at `/code-editor`.

External diagnostics use `Operation.SetDiagnostics({ uri, session, revision,
languageId, source, diagnostics })`. Each issue has `from`, `to`, `severity`,
`message`, and optional `code`. Batches replace results for their source; empty
batches clear that source. Old results are discarded, and new edits clear previous
results. Diagnostics do not prevent editing or saving.

For asynchronous validation or LSP, react to `ChangedDocument` in the parent and
return a diagnostic batch tagged with the original document version. Debouncing,
cancellation, worker/server lifecycle, and transport belong to that integration.
The exported `Validator` type and `jsonValidator` are engine-independent helpers;
there is no automatic asynchronous validator runner or LSP client bundled yet.

## Language services

The editor speaks the vocabulary of
[`@foldworks/text-intelligence`](../text-intelligence), so a language service
written for it also serves outline rows. Import
`@foldworks/text-intelligence/styles.css` for the suggestion and hover popups.
Requests go out as `OutMessage`s and answers come back as operations tagged with
the document version they were computed for, so a late answer is ignored. A
synchronous service answers in the same update; an asynchronous one answers when
its result arrives.

- **Highlighting.** `Operation.SetSemanticTokens({ uri, session, revision,
tokens })` paints `{ from, to, kind }` ranges over the built-in lexer, as
  `data-kind` on `.native-token--semantic`. Common kinds such as `keyword`,
  `string`, `number`, `comment`, `type`, `function`, and `property` follow the
  editor's palette; style others in the host. Later edits shift tokens along
  until the next batch, so most highlighting stays put while a service catches
  up; a token an edit touches, such as the word being typed, drops back to the
  lexer's color until then. Tokens cover any language, including ones the lexer
  does not know.
- **Completion.** Ctrl+Space and the Suggest button send
  `RequestedCompletion({ version, offset })`. Answer with
  `Operation.ShowCompletions({ expected, from, to, items })`, where `from` and
  `to` are the text an item replaces. A host can also offer suggestions as it
  sees `ChangedDocument`. The list opens at the start of the range; ↑ and ↓
  choose, Return or Tab accept, and Esc closes it. Typing narrows it, and moving
  the caret out of the range closes it. With the default `suggestions: "words"`
  option the editor also suggests words from the document; set
  `suggestions: "host"` to show only what the host offers.
- **Hover.** When the pointer rests on a character, or Ctrl+Shift+Space asks
  about the caret, the editor sends `Hovered({ version, offset, source })` and
  calls the `hover` view config. It returns the range it describes and content
  built with the parent's `h`, or `null`. Diagnostics at the offset are listed
  first, so problems explain themselves on hover.
- **Highlights.** `highlights: [{ from, to, kind? }]` in the view config paints
  ranges that another view corresponds to, such as the line for a selected row,
  with `data-highlight` set to `kind`. `Operation.Reveal({ expected, range })`
  scrolls a range into view without moving focus or the selection.

```ts
CodeEditor.view(
  {
    model: model.source,
    label: "Source",
    toParentMessage: (message) => Message.Source({ message }),
    highlights: selectedLine === undefined ? [] : [{ ...selectedLine, kind: "selection" }],
    hover: ({ offset, document }) => describe(document.text, offset, h),
  },
  h,
);
```

## Implementation boundary

`CodeEditor.implementation` is the native implementation of
`EditorImplementation<State, Message>`. The interface provides:

- `Model` and `Message` schemas for composing the parent Foldkit application.
- `init(config)` to create implementation state.
- `execute(operation)` to encode a shared host operation as an implementation message.
- `update(model, message)` to return Foldkit state, commands, and shared events.
- `view(config, h)` to render and own the implementation's browser lifecycle.
- `snapshot(model)` to expose document, selection, options, diagnostics, and status.

The contracts entry contains only shared data, operation/event schemas, and types.
It imports no native renderer. The native implementation satisfies this interface
in code, and the demo uses the shared operations for document loading and options.

A future implementation supplies its own model/message schemas and these methods.
Choose it when composing the parent Foldkit model and update. Concrete history,
lexer caches, and mount state stay implementation-specific; applications should use
snapshots and operations at integration boundaries. This is a typed composition
point, not a runtime engine registry or a promise to transfer history between engines.
Only the native implementation ships today.

## Current scope

Tab moves focus; Ctrl/Cmd + ] and [ indent/outdent. The editable toolbar exposes
history, editing, find/replace, and suggestions. Read-only documents remain selectable
and copyable, with Find and Go to line in a compact toolbar. The header defaults to
the language and read-only status; `meta` overrides it, and `meta: null` hides it.
Set `showToolbar: false` when the host supplies its own commands. The optional state
inspector defaults to visible for exploration; set `showInspector: false` in application
forms.

Unwrapped highlighted lines are virtualized, but the browser still lays out the
full textarea. Wrapped mode renders all lines. Full strings, lexer scans, and
model serialization limit large-file performance. Multi-cursor editing, an LSP
transport, and full international text layout remain future work.
Real IME, screen-reader, Safari, and mobile-device checks are still needed.

See [the native architecture and roadmap](./NATIVE.md) for the full-fidelity path.
Try the demo at `/code-editor`, including two independent editors and a 2,000-line
sample. CodeMirror and its implementation-specific configuration have been removed;
use the default package entry instead of the former `/native` entry.
