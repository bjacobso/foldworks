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
