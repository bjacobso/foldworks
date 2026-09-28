# Anchored review threads: implementation plan

## Choice

Implement anchored review threads next. The [diff-review demo](../apps/demo/src/diff-viewer)
already has line and range selection, comment markers, a comment inspector, and
resolve controls. It provides a real workflow for testing the missing thread
behavior. The [data-grid demo](../apps/demo/src/data-grid) has stable row and
column IDs, giving the same thread view a second, different anchor shape.

The other near-term proposals remain valuable: charting needs a concrete
review-dashboard data contract, while collection views and boards span a larger
filtering, grouping, and movement model. Threads can establish a reusable
contract through two existing views with a smaller first release.

## Target behavior

In the diff review, a user selects a line or range, starts a thread, replies,
resolves or reopens it, and opens it from a line marker. After the patch changes,
the thread retains its original location and visibly becomes stale until the
host reattaches it to a new selection. On a narrow screen, the thread panel
remains reachable and focus returns to the marker or selection after closing.

The worksheet demo uses the same thread view for a selected cell. Its anchor is
`{ rowId, columnId }`, independent of sorting, filtering, and displayed cell
addresses.

## Contract and ownership

Add `@foldworks/review-thread` for the surface-neutral thread model and
controlled Foldkit view. A thread has a stable ID, an application-supplied
anchor, an ordered list of posts with stable IDs, author labels and timestamps,
and an open or resolved state. The view receives the selected thread, draft,
anchor label/state, pending/error state, and callbacks for reply, resolve,
reopen, focus, and reattach requests. The host accepts or rejects every change,
generates IDs and timestamps, and owns storage, transport, and permissions.

The core shape stays generic over its anchor:

```ts
type Thread<Anchor> = {
  id: string;
  anchor: Anchor;
  posts: readonly { id: string; author: string; body: string; createdAt: string }[];
  resolved: boolean;
};

type AnchorResolution =
  | { state: "Current"; label: string }
  | { state: "Stale"; label: string; reason: string };
```

Keep anchor interpretation in small host adapters. A diff anchor records path,
side, normalized line range, and patch revision. A grid anchor records row and
column IDs. An adapter resolves an anchor against the current surface to either
`Current` or `Stale`, with a display label and reason. Revision mismatch or
missing diff lines makes a diff anchor stale; a missing row or column makes a
grid anchor stale. Stale threads remain readable in the thread list. They do
not create a marker at a possibly unrelated new location. Reattachment is an
explicit host-accepted request.

The new package owns thread presentation and interaction only. `@foldworks/ui`
continues to own shared visual tokens and controls. `@foldworks/diff-viewer`
continues to own diff rendering and line selection; it receives marker data and
reports marker activation. It does not store thread content.

## Implementation sequence

1. **Thread contract and view.** Add typed thread, post, and anchor-resolution
   contracts; a controlled thread list, thread detail, reply composer, resolve
   controls, stale-location notice, and accessible labels. Keep drafts and
   selected-thread state in the host. Test that host-supplied IDs survive
   replies and resolution, and cover stale, empty, and pending states.
2. **Diff integration.** Adapt the demo's `ReviewComment` data to threads and
   keep its existing selection flow. Give diff markers their own keyboard
   reachable button and an activation callback; preserve the line-selection
   button. Aggregate multiple open threads on one line into one marker whose
   activation opens the matching thread list. Add a patch-revision fixture,
   stale-thread display, and host-driven reattachment. Restore focus after
   closing the thread panel.
3. **Responsive and second-surface proof.** Replace the diff inspector's
   current `display: none` narrow-screen behavior with an openable panel. Add a
   small selected-cell thread panel to the worksheet demo using `{ rowId,
   columnId }`. Keep worksheet ordering and edit behavior in `@foldworks/data-grid`.
4. **Documentation and verification.** Document both integrations and the host
   ownership boundary. Add browser scenarios for keyboard marker-to-thread
   navigation, reply, resolve/reopen, stale reattachment, and narrow-screen
   access. Run affected package tests, type checks, and demo browser tests.

## Completion criteria

- A thread with multiple posts works in both diff and grid demos through the
  same public view and model contract.
- Selecting a marker opens the intended thread or grouped thread list with a
  keyboard-only path and predictable focus return.
- A changed patch never makes an old thread appear on a different line; the
  user can read and explicitly reattach the stale thread.
- The diff thread workflow remains usable at narrow viewport widths.
- Thread state and side effects remain controlled by each host application.
