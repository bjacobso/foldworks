# Mentions and tags: shared contract

A reference is a recognizable range in ordinary text. `@maya` remains five
editable characters; `#field-guide` is a tag
spelling. Recognition does not create a node, contact a person, or persist a
relationship. All coordinates are UTF-16 offsets with an exclusive end.

## Package boundary

`@foldworks/text-intelligence` owns `Mentions`: recognition, a caret query over
the whole token, synchronous lookup, completion items, semantic tokens,
optional unknown-mention diagnostics, and a hover description. These outputs
compose its existing completion helpers, geometry, accessible popups, and theme
stylesheet. The feature depends on no document engine, parser, or demo data.
A separate package would add a dependency boundary around the same vocabulary
without introducing an independent responsibility.

| Owner           | Responsibility                                                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host            | Entity IDs, unique spellings per kind, display labels, descriptions, permissions, lookup data, document-derived tags, optional unknown-mention policy     |
| Shared contract | Unicode recognition, configurable trigger boundaries and syntax exclusions, matching and replacement ranges, serializable lookup/presentation data        |
| Surface         | Selection, geometry, native input and composition, completion state, keys, acceptance transactions, focus, read-only policy, history and syntax knowledge |

The outliner demo walks its Items and adds per-row usage counts. Its crew lives
in `apps/demo/src/references/crew.ts`. The native Markdown example in
`apps/demo/src/editor/references.ts` supplies exclusions from heading/code
blocks and code/link/literal runs, and derives tags from the eligible leaves.
Both adapters use the same shared algorithms and hover content.

## Identity and document representation

Hosts supply `{ id, kind, name, label, description? }`. `name` is the token
spelling; `id` is the stable host identity. Comparison normalizes NFC and ignores
case. Unicode letters, combining marks, numbers, underscores and hyphens are
supported; a name starts with a letter, number or underscore. Duplicate host
spellings resolve to the last supplied entity; host tags override derived tags.

Acceptance inserts the spelling as plain text. Resolving it later uses the
host's current lookup. Renaming a handle can therefore change resolution: a
host should retain aliases when that matters. No identity metadata is persisted
by these APIs. A future application that needs bound identities must explicitly
version and maintain a sidecar over document ranges, with edit mapping and
export semantics; passing an ID today does not silently create such metadata.

Editor JSON remains marked text runs. The additive `literal` mark, with empty
`value`, records only explicitly escaped `@`/`#` punctuation on Markdown import.
It preserves literal interpretation across formatting, editing, undo, JSON save,
and Markdown export; it is editable text and never a mention node. It does not
spread to newly typed text. Applying inline code supersedes this redundant mark:
code already makes every marker literal, and Markdown code has no escape metadata. Plain clipboard transfer intentionally drops marks,
including literal provenance, as it already drops bold and links. Markdown
continues to promise semantic round trips, rather than identical source spelling.

## Interaction and exclusions

The query range includes the full token even when the caret is in its middle;
filtering considers the prefix up to the caret. Names and display-label words
are searchable. An insertion adds a space only at the end of the addressed
text; existing whitespace and punctuation are retained. The surface handles a
noncollapsed selection through its normal replacement input before querying.

The outliner retains its own completion/hover key protocol. The native editor
opens suggestions after input or committed composition, and on Ctrl+Space;
Up/Down wrap, Enter/Tab accept, and Escape dismisses. Alt+Enter requests keyboard
hover. Selection changes, blur, source/link panels, read-only mode and composition
close transient intelligence. Hover and diagnostics remain available while
reading. Live announcements, listbox options, active-descendant and described-by
relationships use the existing shared popups.

`Options.boundary` lets each surface decide which preceding characters permit a
trigger. `Options.excluded` takes ranges from a syntax tree. `markdownOptions`
is a conservative raw-source helper for headings, code fences/spans, indented
code, URLs, email addresses, escapes and link destinations; it is not a Markdown
parser. Parsed Markdown hosts should use their block/run information as the
native example does. There are no queries inside headings, code, links, emails,
URLs, or explicitly escaped markers in that example.

## Results and stale state

Providers in this release are synchronous; no promise, network request or
background service is supported by the shared feature or editor hooks. Functions
stay in `Editor.define` configuration; model state and entity data are serializable.
Editor lists record the target leaf, revision and caret. Acceptance checks these
against the current model, and click messages carry their expected revision.
Outliner suggestions are computed in the same update from the resulting Items
and focus, using its existing completion protocol.

An asynchronous host using the outliner's `ShowCompletions` message must identify
requests by a monotonically increasing request ID plus surface/row ID, document
revision, source text, replacement range and collapsed selection/caret. Compare
all of these before dispatching a result; discard obsolete or dismissed requests.
`ShowCompletions` itself does not supply a network freshness check. The native
editor provider contract intentionally does not expose asynchronous results yet.
