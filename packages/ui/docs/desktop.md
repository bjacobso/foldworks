# Desktop application primitives

These APIs use controlled Foldkit models, messages, commands, and mount streams.
Host applications own records, authorization, async requests, persistence, and
command execution. See `/ui-kit` → **Desktop workspace** for a complete integration
in `apps/demo/src/ui-kit/desktop.ts`.

## Architecture decisions

The audit started from the styled adapters added after PR #15:

- Tree owns hierarchy reconciliation, selection, rename conflict detection, and
  move requests. DataGrid owns rectangular selection, clipboard validation and
  cell editing. Neither is a general command dispatcher or inline editor.
- Stateful.Command already owns search/ranking and result selection. Its result
  IDs can route into a shared host command handler without replacing that engine.
- Foldkit Menu provides flat navigation, typeahead, pointer activation, anchors,
  scroll locking and return focus. Its item API has no nested-item or checked-item
  attributes. The flat adapter remains intact; `Stateful.Menu.Nested` adds a
  small typed hierarchy controller. `Stateful.ContextMenu` uses the same controller
  with pointer-coordinate/Shift+F10 entry.
- Foldkit Dialog already owns focus trap, return focus, scroll lock, a nested
  dialog stack and unmount cleanup. AlertDialog, Drawer and Sheet reuse it.
- Combobox.Multi owns input/listbox interaction, suggestion selection, anchoring,
  and native form values. TokenField composes that engine with Tag; it does not
  create another async option store.
- Workspace had a private ResizeObserver stream. New general measurement is
  exposed independently of the visual OverflowList, through `Measurement` and
  `Headless.Measurement`. Workspace retains its pointer-resize bridge.
- `@foldworks/keyboard` is a separate dependency-free-of-UI package because both
  UI and feature packages need command definitions. It depends only on Effect, avoiding a feature → UI → feature dependency cycle.
- Date parsing is an explicit small codec boundary over Foldkit CalendarDate.
  No date dependency or timezone database is added, so a separate datetime
  package would add packaging cost without a useful boundary. DatePicker and
  DateInput stay in UI. Range/time/timezone engines are deferred.

## Shared keyboard commands

```ts
const save = {
  id: "save",
  label: "Save workspace",
  shortcut: Shortcuts.shortcut("s", "Mod", "Shift"),
};
// Add this hidden registration marker as a child in the view.
Shortcuts.registration(
  {
    bindings: [save],
    platform: "other",
    toParentMessage: (message) => Message.Invoked({ id: message.id }),
  },
  h,
);
Button.view(
  {
    command: {
      definition: save,
      platform: "other",
      toMessage: (id) => Message.Invoked({ id }),
    },
  },
  h,
);
Stateful.Menu.fromCommand(save);
Stateful.Command.fromCommand(save);
```

For an application-wide registry independent of rendered UI, use
`Keyboard.events(bindings, platform)` inside `Subscription.make`; derive bindings
from subscription dependencies. Use one registry per application. Mount streams
are an alternative for a route or feature whose registry should disappear on
unmount. Do not install both for the same bindings. `Shortcuts.registration`
keys a hidden marker by the binding definitions and platform: changing either
replaces its stream without remounting surrounding controls. Retiring markers
ignore events immediately and finalizers remove listeners. The lower-level
`Register` mount captures arguments only on insertion, so use it directly only
for static bindings. `Keyboard.events` also accepts a getter for live bindings.

Scopes are stable ancestor element IDs, ordered nearest-first from the event's
composed path. Scope wins over priority, then higher priority wins, then declaration
order. `conflicts` reports ambiguous same-scope bindings. Disabled bindings do not
reserve a combination. `Mod` means Meta on Mac and Control elsewhere. Hosts supply
the platform explicitly so SSR and labels agree. `display` and `aria` produce
platform labels and `aria-keyshortcuts`; they never infer application actions.
`fromCommand` derives result/item IDs and labels from the definition. Toolbar
accepts command Buttons in its existing actions slot.

Editable targets (input, textarea, select, contenteditable), composing, prevented,
and repeating events are suppressed by default. Bindings can explicitly set
`allowEditable`, `repeat`, and `preventDefault: false`. Matching requires exact
modifiers and uses logical `event.key`. Operating-system and browser-reserved
shortcuts remain outside application control. The shortcut reference is an
accessible list of host-routed actions; scope annotations explain local bindings.

## Measurement and OverflowList

Forward `Measurement.Message` into `Measurement.update`, then pass its model to
`OverflowList.view`. Measurement's mount stream observes the root content box as
`$root` and marked descendant border boxes. ResizeObserver values are published
once per animation frame; mutation observation reconciles added/removed probes.
Cleanup disconnects both observers and cancels pending frames. No synchronous
read/write loop is used during resize.

`OverflowList.partition` is pure and deterministic. Items need unique stable IDs
not beginning with `$`; widths must be finite nonnegative CSS pixels. Missing
measurements render all items in an accessible horizontal scroller. This is also
the SSR/no-observer presentation. Start/end collapse preserves original order;
`minVisible` wins over fitting when the container is too small.

`renderItem` renders live content. `measureItem` must render visually equivalent,
non-interactive sizing content **without IDs, effects, mounts, portals, or form
names**. Probes are inert and hidden from accessibility APIs. Rendered items must
have intrinsic, non-shrinking widths; percentage widths, transforms, margins and
vertical writing modes are outside this horizontal measurement contract. Specify
spacing through `gap`, not child margins. The built-in overflow uses a native
More disclosure and an ordinary list of actions, with native keyboard behavior.
It deliberately does not advertise ARIA menu navigation. `renderOverflow` permits
a host-controlled menu composition; supply `measureOverflow` with equivalent sizing markup for a custom trigger.
The demo applies measurement to a breadcrumb row and a toolbar action row.

## EditableText

`init(id)` creates view mode. `update(model, message, policy)` owns only editing
mode, draft, error and focus commands; a successful commit emits `Committed` for
the host to accept. Pass the current committed `value` and the same policy on
update and view. `validate` returns error copy or undefined. Disabled, read-only,
and pending policies block edit requests. Pending content stays readable.

Single-line Enter commits. Multiline defaults to Mod+Enter, preserving Enter for
newlines. `enter`, `escape` and `blur` select explicit policies; blur defaults to
commit without stealing focus. Cancel and keyboard commit return focus to the
view button. Validation keeps the draft and exposes a status/error description.
Hosts may keep edits open on blur and provide explicit Save/Cancel actions.
`control` is the rendering adapter used by Tree rename: Tree retains its
application-owned conflict, validation and focus rules.

## TokenField

Pass controlled `values` and `options` to update and view. `Changed` requests a
replacement value array. Suggestions and custom candidates use Combobox.Multi;
selected values use Tag. Backspace/Left in an empty field selects the last tag,
Left/Right moves through tags, Backspace/Delete removes the focused tag, and
pointer remove returns focus to the input. An input with text retains native text
editing. Selected tags remain visible when suggestions change.

Paste is atomic: split using configured delimiters (default comma, semicolon,
newline), optionally trim, deduplicate using a host identity function, validate,
and enforce `maxCount`. Invalid batches preserve the prior values and announce an
error. Custom values require `allowCustom`. Disabled/read-only fields cannot add
or remove values. `name` submits repeated selected form values. Async options and
stale response handling stay entirely in the host.

## PanelStack

Panels have stable IDs plus a `returnFocusId`. `RequestedPush`/`RequestedPop`
emit host requests without mutating history. The host accepts with `push`/`pop`
and forwards returned commands. Push focuses the new heading; pop restores the
origin control, falling back to the heading if the control disappeared. Only the
active panel renders. Back and Alt+Left request a pop (the shortcut suppresses editable targets, repeat, and IME composition); Escape remains available to
an enclosing overlay. Duplicate IDs and an empty stack are rejected. The stack
is serializable; persistence is host-owned. Transition styles respect reduced
motion and do not delay focus or keep outgoing content interactive.

## Stateful menus and overlays

`Stateful.Menu.Nested` and `Stateful.ContextMenu` share Model/Message/update/view.
Pass the same item tree to update and view. Children open with Right/Enter or
pointer intent; Left/Escape returns one level before closing the root. Home/End,
Up/Down, and single-character typeahead skip disabled items. Check/radio state is
controlled by item props; selections emit `{ id, isChecked }`. Check/radio entries
stay open. Host item removal reconciles the active path. Radio-group exclusivity is a host responsibility. Context entry uses
right click or Shift+F10/ContextMenu key and restores focus to the context trigger.

The menu uses a native manual popover to escape clipping, clamps the root
to the viewport as nested content changes, and closes on viewport resize. Submenus render as nested groups
inside the same scrollable popover; there are no independent floating submenu
windows or diagonal safe-polygon algorithm. Pointer activation waits 160ms and
cancels on leave. A document-local stack gives the latest menu outside-dismissal
ownership. Keyboard handling consumes Escape before the enclosing dialog sees
it. Native popover support is required for this menu family.

`Stateful.AlertDialog`, `.Drawer` and `.Sheet` use the same model/update/view as
Dialog and variant-specific `styledViewInputs`. Keep their submodels mounted
while closed, forward commands, and retain every generated lifecycle attribute.
AlertDialog uses `role=alertdialog`; choose a safe initial-focus action. Drawer
opens from the bottom and Sheet from the right by default. `placement` supports
left/right/bottom/center. Nested dialog ordering and Escape ownership come from
Foldkit's existing dialog stack. Applications own confirm actions and persistence.

## DateInput and DatePicker

`Stateful.DatePicker` styles Foldkit's complete single-date calendar, including
keyboard day, month and year navigation. `DateInput` embeds that picker and a text
draft in one submodel; the host owns one `CalendarDate | null` value. Text commits
and calendar selections share min/max, disabled dates and disabled weekdays.
Changing constraints does not silently overwrite an existing host value.

A codec has `format`, `parse` and `hint`. ISO is strict YYYY-MM-DD. `numericLocale`
uses explicit locale ordering and separators with Gregorian calendar and Latin
digits; it rejects guessed or malformed dates. Supply a codec for other numbering
systems, calendars or parsing policies. Use `calendarLocale(locale, firstDayOfWeek)` or supply Foldkit's locale config at init
for translated calendar month/day names and first weekday; the text codec alone
does not translate calendar labels. Hidden form values are date-only ISO strings,
never timestamps; disabled fields omit their value.

Complete: single date selection, keyboard calendar navigation, typed input,
validation/constraints, locale boundaries and form values. Deferred: range
selection, time input, timezone selection, alternate calendar systems and async
availability fetching. No cosmetic replacement calendar is introduced.
