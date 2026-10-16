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
