# Code review and change-request primitives

A configuration-as-code system stores product configuration (forms, rules,
workflows, access policies, feature flags) as files and changes it through
reviewed proposals. Each team that builds one ends up rebuilding the same loop:

**edit → see the change → open a change request → discuss it line by line →
suggest fixes → run checks → approve → merge → read the history.**

This note proposes the Foldworks primitives for that loop, so a host can compose
its own review process instead of building a GitHub clone. A host may read from
local Git, from GitHub or GitLab, from an agent's proposed edits, or from a
database of versioned documents. Foldworks never names a provider. The scopes
below are proposals until each one passes in the reference demo described at the
end.

## Boundary

The [language workbench principles](./language-workbench.md#principles) apply:
surfaces own geometry, focus, keys, and drafts; hosts own meaning and policy.

| Layer     | Owns                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foldworks | Producing and rendering diffs, line and range selection, comment threads and their drafts, mapping anchors to new revisions, suggested-change math, and views for checks, reviewers, and merge requirements |
| Host      | Repository transport, storage, identity, permissions, notifications, CODEOWNERS-style ownership, which checks run and how, merge policy evaluation, the merge itself, and domain-specific validation        |

The views render what the host provides and report user intent as messages. A
Foldworks view never decides whether a change may merge. It shows the
requirements the host evaluated and their outcomes.

## Already available

| Need                                       | Foldworks API                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Render a Git patch, unified or split       | `parseUnifiedDiff` and `DiffViewer.view` in `@foldworks/diff-viewer`, with line and range selection, thread count markers, and a reviewed toggle |
| Compare prose                              | `diffText` and `ProseDiff.view` in `@foldworks/diff-viewer`                                                                                      |
| Compare structure                          | `diffTrees` and `TreeDiff.view` in `@foldworks/ui`                                                                                               |
| Summarize consequences and history         | `ChangeSetPreview`, `TransactionTimeline`, and `ExplanationTree` in `@foldworks/ui`                                                              |
| Edit configuration with schema diagnostics | `CodeEditor` and `withSchema`/`validate` in `@foldworks/code-editor/structured`                                                                  |
| Undo and redo                              | `@foldworks/history`                                                                                                                             |
| Browse a real checkout                     | `@foldworks/codebase` (read-only server and workbench)                                                                                           |
| File trees, split panes, command palette   | `Tree`, `Workspace`, `SplitView`, and `Stateful.Command` in `@foldworks/ui`                                                                      |
| Mentions in comment drafts                 | `Mentions` in `@foldworks/text-intelligence`                                                                                                     |
| Agent-proposed edits                       | `@foldworks/agent` permission checkpoints with `allowLabel`/`denyLabel` and `renderDetails`                                                      |

The [diff-viewer demo](../apps/demo/src/diff-viewer/) already hand-builds a
comment model (`ReviewComment` with path, side, and line range), viewed files,
and resolution. That state is the starting point for the reusable thread model.

## Gaps

### 1. Diffs from two texts, and richer line rendering

Package: `@foldworks/diff-viewer`.

A configuration host usually has a saved version and a draft, not a Git patch.

- **`diffFile({ path, oldPath?, oldText, newText, context? })`** returns the same
  `DiffFile` that `parseUnifiedDiff` produces: a line-level Myers diff with
  hunks, headers, and `context` unchanged lines (default 3), status
  `added`/`deleted`/`modified`/`renamed`, and the same bounded search fallback as
  `diffText`. A pure `formatUnifiedDiff(file)` turns it back into patch text, so
  hosts can store or send it.
- **Intraline highlights.** Paired deletion and addition lines in a replacement
  block highlight their changed words using `diffText`. The view keeps semantic
  `<ins>`/`<del>` markup for the changed spans.
- **Line slots.** `lineWidgets?: (line: DiffLineRef) => Html | undefined` renders host Html below a line in unified and split modes,
  spanning the full row. Inline threads, composers, and check annotations go
  here. `DiffLineRef` is `{ path, side, line }`.
- **Line annotations.** `annotations?: readonly DiffAnnotation[]`, each
  `{ path, side, startLine, endLine, tone, label, message? }`, marks lines with a
  gutter tone and an accessible label. Schema diagnostics, lint results, and
  check failures map to these.
- **Expandable context.** Hidden lines between hunks render as an expander when
  the host supplies `onExpandGap(gap)`. A pure `expandContext(file, { oldText,
newText }, gap, lines)` returns a new `DiffFile` with those lines added as
  context, so expansion stays host-owned data.
- **Highlighting hook.** `highlight?: (content, language) => readonly Highlight[]`
  replaces the built-in regex tokenizer when provided. It uses the
  `@foldworks/text-intelligence` semantic token kinds so the code editor's
  language service can serve both.
- **Mapping anchors to a new revision.** `mapLine(file, side, line)` and
  `mapRange(fromFile, range, toFile)` report where a line on one side lands on
  the other, or that it was deleted. A thread created on revision 1 can then be
  shown on revision 2 as current, moved, or outdated.

### 2. Review threads

Package: new `@foldworks/review`. This is the
[anchored review threads](./planned-primitives.md#anchored-review-threads)
exploration, with a diff line as the first anchor and the anchor type left
generic so document ranges, grid cells, diagram nodes, and PDF regions can use
it later.

- **Schemas.** `Comment` `{ id, author: { id, name, avatarUrl? }, body,
createdAt, editedAt?, pending? }` and `Thread<Anchor>` `{ id, anchor, status:
"open" | "resolved", comments }`. The thread's display state
  (`current | moved | outdated`) is computed by the host or by the diff-viewer
  mapping helpers, not stored.
- **Submodel.** `ReviewThreads` owns UI state only: which composer is open, draft
  text per thread and per new anchor, which comment is being edited, and which
  resolved threads are expanded. It follows the existing `Model`/`Message`/
  `update` and `OutMessage` pattern. The host receives
  `RequestedCreateThread`, `RequestedReply`, `RequestedEdit`, `RequestedDelete`,
  `RequestedResolve`, and `RequestedReopen`, and answers by updating the thread
  data it passes back in. Drafts survive a host round trip and are cleared only
  when the host confirms with `Committed({ draftKey })`, so a failed save keeps
  the text.
- **Views.** `ReviewThreads.threadView` renders one thread with its comments, a
  reply composer, and resolve/reopen. `ReviewThreads.composerView` renders the
  new-thread composer for a selected range. `ReviewThreads.listView` renders all
  threads grouped by file with open/resolved/outdated filters and an activation
  message to reveal the anchor. Comment bodies render through a host
  `renderBody` (default: preserved plain text), so Markdown rendering, mentions,
  and links stay host choices.
- **Keyboard and focus.** The composer submits with Mod+Enter and cancels with
  Escape, returning focus to the gutter that opened it. Thread lists are a
  single tab stop with arrow-key movement. Status changes are announced through
  a polite live region.

### 3. Suggested changes

Package: `@foldworks/review`, using `@foldworks/diff-viewer` for rendering.

A suggestion is a comment that carries replacement text for its anchored range
on the new side.

- `Suggestion` `{ path, startLine, endLine, replacement }` is an optional field
  on `Comment`.
- `applySuggestions(text, suggestions)` applies one or more suggestions to a
  file's text, rejects overlapping ranges, and reports suggestions whose range
  no longer matches (`stale`) rather than guessing.
- The comment view shows the suggestion as a small diff and offers "Apply" when
  the host passes `onApplySuggestion`. Applying is a host action: the host
  commits the new text and resolves the thread.

### 4. Review submission

Package: `@foldworks/review`.

- Comments may be `pending` until the reviewer submits a review. `ReviewSubmit`
  is a view with a summary composer, the pending count, and a verdict choice of
  `comment | approve | request-changes`. The host decides which verdicts the
  current user may choose and passes the allowed set.
- `ReviewerList` shows requested reviewers and reviewers who responded, with a
  verdict tone per reviewer and optional "required" and "owner of N files"
  labels supplied by the host.

### 5. Change-request chrome

Package: `@foldworks/review`.

- **`ChangedFiles`.** A file tree built on `Tree`: status icons, additions and
  deletions, viewed checkboxes, open-thread counts, annotation tones, a text
  filter, and "show only unviewed". Directory rows aggregate counts. Selecting a
  file sends `SelectedFile`. A flat list mode suits small changes.
- **`CheckList`.** Rows of `{ id, name, status: queued | running | passed |
failed | skipped | cancelled | neutral, summary?, duration?, detailsHref? }`
  with an aggregate summary ("2 failed, 5 passed"), a re-run action when the
  host provides one, and expandable host-rendered details. Checks are whatever
  the host runs: schema validation, policy evaluation, a dry-run preview, or CI.
- **`MergeReadiness`.** The requirements the host evaluated, each with outcome
  `met | unmet | pending | bypassable`, a reason, and an optional action. A merge
  button with an optional strategy menu (merge, squash, rebase, or host-defined
  labels) is enabled only when the host says so. It reuses `ExplanationTree`
  for nested requirements.
- **`ChangeRequestHeader`.** Title, status (`draft | open | merged | closed`),
  author, base and head labels, and actions. It composes `AppHeader`-level
  pieces rather than replacing them.
- **Activity.** `TransactionTimeline` covers applied changes. A change request
  also needs comments, reviews, pushes, check results, and status changes in
  one stream. Prefer extending `TransactionTimeline` with an entry `kind` and a
  host body slot over adding a second timeline component.

### 6. Configuration-aware review

Packages: `@foldworks/diff-viewer` for the pure parts, the demo for the
composition.

Line diffs are honest but do not say what changed in a configuration value.

- **`diffValues(before, after)`** compares two decoded JSON-like values and
  returns path-level changes `{ path: readonly (string | number)[], kind:
"added" | "removed" | "changed", before?, after? }`. Arrays of objects with an
  `id` (or a host `key` function) are matched by identity; other arrays are
  compared by index.
- **`ValueDiff.view`** renders those changes grouped by path with before and
  after values, as a "semantic" alternative to the line view of the same file.
  A host that has source maps from its parser can link a path change to its
  lines through `annotations`.
- **Diagnostics in review.** A helper converts `@foldworks/code-editor`
  `Diagnostic`s (offset ranges in the new text) into new-side
  `DiffAnnotation`s, so schema errors from `withSchema` appear in the review
  without the host re-implementing offset-to-line math.
- **Impact.** A host that can compute consequences of the change (affected
  users, generated tasks, a plan like `terraform plan`) shows them with
  `ChangeSetPreview`. No new component.

## Reference demo

Replace or extend the existing [diff-viewer demo](../apps/demo/src/diff-viewer/)
with a **change request** reference app on a synthetic, browser-local
configuration repository: a few YAML or JSON files for feature flags and access
rules, with an Effect schema for each. It must say on screen that it is a local
simulation, not a Git provider integration.

The scenario, also the e2e test:

1. Open a file and edit a flag in `CodeEditor`; a schema error shows inline.
2. Fix it; the working change shows as a diff produced by `diffFile`, with the
   semantic `ValueDiff` view available as a toggle.
3. Open a change request; `ChangedFiles`, `CheckList` (local schema and policy
   validators, labeled as such), and `MergeReadiness` reflect it.
4. As a second reviewer, select lines, leave a pending comment and a suggestion,
   and submit "Request changes".
5. As the author, apply the suggestion; the thread moves to the new revision
   and an unrelated thread becomes outdated.
6. Approve, see every requirement met, merge, and read the activity timeline.
   State survives a reload.

Also cover keyboard-only commenting, narrow screens, and dark mode, following
the [workers workbench](./workbench/README.md) conventions for screenshots.

## Sequence

Each step ships with tests, README documentation of behavior and limits, a
changeset, and demo coverage:

1. `diffFile`, `formatUnifiedDiff`, intraline highlights, line slots,
   annotations, and the highlighting hook in `@foldworks/diff-viewer`.
2. `@foldworks/review` with `Comment`, `Thread`, the `ReviewThreads` submodel,
   thread, composer, and list views, wired into the demo through line slots.
3. `mapLine`/`mapRange` and outdated threads; `expandContext`.
4. Suggestions and `applySuggestions`; pending comments, `ReviewSubmit`, and
   `ReviewerList`.
5. `ChangedFiles`, `CheckList`, `MergeReadiness`, `ChangeRequestHeader`, and the
   timeline extension.
6. `diffValues`, `ValueDiff.view`, and the diagnostics-to-annotations helper.
7. The full change-request reference demo and its e2e scenario.

## Later

These wait for a host that needs them.

- **Three-way merge and conflict resolution.** A view that shows base, ours,
  and theirs and lets the user choose or edit each conflict.
- **Revision picker and commit list.** Choosing base and head, and comparing
  any two revisions of a change request.
- **Blame.** Line attribution beside source in `@foldworks/codebase`.
- **Very large diffs.** Virtualized hunks and lazy file loading. The data grid
  virtualization is the model.
- **Presence and realtime.** Who is viewing, live comment arrival, and typing
  indicators. Transport stays with the host.
- **Thread anchors outside diffs.** Document ranges in `@foldworks/editor`,
  grid cells, diagram nodes, and PDF regions, designed with the
  [anchors that survive edits](./document-analysis.md#later) work.
