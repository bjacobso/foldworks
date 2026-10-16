# @foldworks/review

Provider-neutral review UI for Foldkit. The host owns transport, persistence,
identity, permissions, policy, and merging. Import `@foldworks/review/styles.css`
once for the package CSS. This package uses the same Effect and Foldkit peers as
the other Foldworks primitives.

## Threads and drafts

`Comment` is an Effect schema. `Thread(AnchorSchema)` builds a schema for any
host anchor; `Thread<Anchor>` is its TypeScript shape. Thread data stays in the
host. Pass it to `ReviewThreads.threadView({ model, thread, toMessage }, h)`.
The default body renderer preserves plain text. Supply `renderBody(comment)`
for Markdown, mentions or links, and `canEdit`/`canDelete` for visible actions.
The host must enforce permissions for every request.

Initialize `ReviewThreads.init({ id })`; fold its `update` with
`Update.foldChild`. It returns `RequestedCreateThread`, `RequestedReply`,
`RequestedEdit`, `RequestedDelete`, `RequestedResolve`, `RequestedReopen`, or
`RequestedActivate` out-messages. These express intent and never mutate host data.
New anchors use a host `anchorKey`, so the submodel is independent of anchor
shape. Use stable, unique draft keys per anchor, reply or edit.

`OpenedComposer({ draftKey, returnFocusId })` opens and focuses a composer.
`composerView({ model, draftKey, targetId, kind, toMessage }, h)` renders it.
Mod+Enter submits, Escape closes and returns focus. Closing retains drafts.
After saving, send `Committed({ draftKey, body })` with the exact saved body;
only a matching draft clears. A failed save needs no acknowledgement. A delayed
acknowledgement cannot clear newer typing. Hosts should serialize concurrent
saves per draft key and assign their own request IDs if needed.

`listView` groups threads using `groupBy`, supports all/open/resolved/outdated
filters, and has one list tab stop with Arrow/Home/End movement and Enter to
reveal the active thread. Hosts provide anchor display state; resolved threads
collapse until expanded. Request and save status use a polite live region.
Focus targets must still exist when a command executes. Thread IDs, UI IDs and
draft keys must be stable and unique within the surface.

## Outdated threads

Pass `anchorState: 'current' | 'moved' | 'outdated'` to `threadView` and an
`anchorState(thread)` function to `listView`. These are derived host display
inputs, never persisted in `Thread`. For diff anchors use `mapRange` from
`@foldworks/diff-viewer`; retain the original anchor and source revision when
mapping reports outdated, so discussion stays available in the list even if
its line no longer exists.

## Suggestions and pending reviews

A `Comment` may carry a `Suggestion` with path, inclusive 1-based start/end
lines, replacement and **expected** original content. Capture expected content
when proposing it, joined with LF without the range's terminal newline.
`applySuggestions(text, suggestions)` returns `applied` with new text, or
`rejected` with `stale`, `overlap`, or `mixed-paths`. A rejection changes nothing;
stale results identify invalid ranges and mismatching expected text. It never
searches for similar content. The host verifies the path, commits the returned
text, remaps anchors and resolves threads.

Application normalizes CRLF to LF, preserves the source's final newline
convention and treats empty replacement as deletion of complete lines. A single
terminal newline on replacement is ignored. Zero-width insertions are not
supported; replace an existing range with the desired complete lines instead.
`threadView` previews the suggestion as a diff; `onApplySuggestion` exposes the
host action. Omit the callback when applying is unavailable.

`pending` on comments is host data. `ReviewSubmit.view` takes controlled summary,
verdict, pending count, allowed verdicts and submission callbacks. Unsupported
verdicts cannot be selected; submission disables for a disallowed current
choice or `isSubmitting`. Hosts must also validate submission intent and retain
drafts on failure. `ReviewerList.view` displays requested/returned verdicts,
required labels, and optional ownership counts. Neither view evaluates policy.

## Change-request composition

`ChangedFiles.init({ id, files })` and `ChangedFiles.update(model, message,
{ files, mode })` wrap the UI `Tree` submodel. Pass the same file inputs to
`ChangedFiles.view({ model, files, mode, toMessage }, h)`. The host handles
`SelectedFile` and `RequestedViewed` out-messages. Directories aggregate additions,
deletions and open threads. Status letters and annotation tones have text
labels. The filter and unviewed toggle affect display, never host file data.
`mode: 'flat'` removes directories. Tree Arrow/Home/End keys navigate; Space
toggles the active file's viewed checkbox. Paths must be unique. Initial files
expand all directories; hosts can reconcile expansion for newly arriving paths.

`CheckList.view` summarizes queued/running/passed/failed/skipped/cancelled/neutral
checks, with optional `onRerun(check)` and native expandable `renderDetails(check)`.
Duration is a host-formatted string; details links and their access policy belong
to the host. No network requests or execution happen in the view.

`MergeReadiness.view` takes host-evaluated requirements (including nested
requirements and optional actions), `canMerge`, `onMerge`, and optional controlled
strategy choices. Nested requirements reuse `ExplanationTree`. `canMerge` is
authoritative; the view never derives authorization from requirement labels.
The host must check policy again when processing the merge message. Strategies
use arbitrary host IDs and labels.

`ChangeRequestHeader.view` composes `AppHeader` and `Badge` with title, status,
author, base/head labels and host action Html. Use UI `TransactionTimeline`
entries with `kind` and `renderBody(entry)` for one ordered activity stream.
