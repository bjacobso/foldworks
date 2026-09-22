# UI capabilities

The catalog covers component names and visual compositions. It does not promise
behavioral parity with shadcn/ui. Choose an API by the interaction it supports.

| Family | Recommended API | Included behavior | Current limits |
| --- | --- | --- | --- |
| Tabs | `Stateful.Tabs` | Arrow keys, Home/End, disabled-item skipping, automatic/manual activation, vertical orientation, focus commands, linked panels | Values must be unique; parent owns selection; no tab removal/reordering UI |
| Dialog and modal variants | `Stateful.Dialog`, `.AlertDialog`, `.Drawer`, `.Sheet` | Initial focus, focus trap, Escape/backdrop/close-button dismissal, return focus, scroll lock, unmount cleanup, optional transitions, rich title/actions, dividers, `sm`/`md` widths | Centered, bottom, left or right placement; application owns confirmation and form submission; keep the submodel mounted while closed |
| Custom select | `Stateful.Select` | Typeahead, arrow keys, disabled options, read-only mode, anchored popup, selection closes popup, return focus, hidden form input | Styled adapter supports a flat single-selection list; use `Headless.Listbox.Multi` for multiple selection |
| Command palette | `Stateful.Command` | Fuzzy/keyword search, ranked groups, arrow keys, Home/End, Enter, pointer selection, disabled-item skipping, active-result scrolling | Inline palette; compose with Dialog for a modal; application owns actions, fetching and stale-request handling; no typo correction |
| Button, checkbox, switch, fields, disclosure | Existing root helpers | Foldkit helper behavior and native semantics; label-shaped upload triggers; field adornments, keyboard handlers, helper/error text, and multiline minimum rows | Application owns validation and state; input `isRequired` currently marks the label and is not a substitute for native required validation |
| Breadcrumb | `Breadcrumb.view` | Native links, message-driven buttons, current-page semantics, middle collapsing, actionable overflow | Expansion state is application-owned through `onExpand`; callers replace or relax `maxItems` after activation |
| Native select | `Select.control`, `NativeSelect.view`, `Field.select` | Native browser keyboard/selection behavior | Native popup appearance is browser-controlled |
| Legacy tabs | `Tabs.view` | Controlled selection, linked panels, click handling | Does not run keyboard focus commands; migrate interactive tab interfaces to `Stateful.Tabs` |
| Legacy overlays | `Dialog.view`, `AlertDialog.view`, `Sheet.view`, `Drawer.view` | Controlled visibility and visual placement | No managed modal focus trap, focus restoration or scroll lock; `initialFocusId` is not implemented; use `Stateful.Dialog` for modal behavior |
| Legacy custom select | `Select.view` | Controlled popup and click selection | No managed typeahead, roving focus or dismissal lifecycle; use `Stateful.Select` |
| Flat menus | `Stateful.Menu` | Arrow/Home/End navigation, typeahead, disabled items, groups, pointer intent, anchored portal, dismissal and focus return | Use `.Nested` / `Stateful.ContextMenu` for nested or checked items; root DropdownMenu, ContextMenu and Menubar remain presentation APIs |
| Popover | `Stateful.Popover` | Anchored portal, viewport collision handling, focus transfer/return, Escape/outside dismissal, optional modal behavior and transitions | Application owns content focus rules when `contentFocus` is enabled; root Popover remains presentational |
| Tooltip | `Stateful.Tooltip` | Hover delay, keyboard/pointer modality, focus and Escape behavior, anchored non-interactive portal, custom trigger renderer | Non-interactive content only; compose rich interactive content with Popover |
| Combobox | `Stateful.Combobox` / `.Multi` | Editable search, single/multiple selection, keyboard navigation, groups, disabled/read-only modes, form values, anchored portal | Parent passes `model.inputValue` as `query` for filtering and owns async request freshness; root Combobox remains native datalist |
| Keyboard commands | `@foldworks/keyboard`, `Shortcuts` | Platform-aware display/ARIA, global/scoped bindings, priority and deterministic conflicts, editable/IME/repeat policies, lifecycle cleanup, shared command Buttons/Menu/Command/reference | One registry per application; host owns execution and platform; browser/OS reserved keys cannot be guaranteed |
| Measurement and overflow | `Measurement`, `OverflowList` | ResizeObserver batching/cleanup, stable start/end partitions, minimum visibility, item changes, intrinsic probes, accessible native overflow disclosure | Horizontal intrinsic widths; caller provides inert ID-free sizing renderers; minimum visibility may require scrolling; native disclosure uses list semantics |
| Inline editing | `EditableText` | Single/multiline modes, controlled commits, validation/status, Enter/Escape/blur policy, IME guard, disabled/read-only/pending, focus entry/return; used by Tree rename | Host owns accepted values and async save state; specialized Tree conflict policies remain in Tree |
| Token entry | `TokenField` | Tag + Combobox.Multi composition, controlled suggestions, custom entries, atomic paste/deduplication/validation/count limits, keyboard and pointer removal, repeated form values | Async search and stale-result handling remain host-owned; deduplication defaults to exact strings |
| Inspectors | `PanelStack` | Host-accepted push/pop requests, stable IDs, back/Alt+Left, focus entry/return, reduced-motion animation | Only active panel renders; host owns persistence and authorization |
| Nested/context menus | `Stateful.Menu.Nested`, `Stateful.ContextMenu` | Pointer coordinates, Shift+F10, nested keyboard/pointer intent, checkbox/radio roles, nearest Escape ownership, outside dismissal and cleanup | Nested groups share one scrollable native popover; 160ms pointer delay, no separate floating windows/safe polygon; host owns radio exclusivity; native popover required |
| Date input/picker | `DateInput`, `Stateful.DatePicker` | Shared controlled single date, typed locale codec, keyboard day/month/year calendar, min/max/disabled dates/weekdays, ISO form values | Date only; ranges, time input, timezone selection deferred; Gregorian/Latin numeric codecs built in; host supplies alternate codecs |
| Calendar | `Calendar.view` | Single-date click selection and month callbacks | Weekday labels/start-of-week are fixed; no full calendar keyboard navigation; use `Headless.Calendar` |
| Toasts | `Stateful.Toast` | Queueing, six positions, timed/sticky entries, hover pause, stale-timer protection, live regions, manual dismissal and transitions | Standard adapter payload is title/optional description; use `Headless.Toast.make` for domain-specific payload rendering |
| Layout and display | Responsive Container/Grid/Stack/Row, semantic content, Card, Panel, Table, tags and operational compositions | Mobile-first responsive geometry and presentation of application-owned data | Table is presentational; use `@foldworks/data-grid` for grid behavior. Resizable uses native CSS resizing; Carousel uses native scrolling |
| Workspace panes | `Workspace` | Nested horizontal/vertical splits, pointer capture, keyboard resizing, collapse/restore, focus recovery, controlled pixel sizes and scroll boundaries | Two panes per split; parent provides bounded height and owns persistence; no docking or automatic breakpoint collapse |
| Tree explorer | `Tree` | Stable-ID hierarchy, expansion, keyboard navigation, typeahead, single selection, inline rename and restricted move requests | Eager rendering; host owns node changes and persistence; no multi-selection, lazy loading or tree drag-and-drop |

`Headless.Select` is Foldkit's native select helper. `Headless.Listbox` is the
custom selection engine underlying `Stateful.Select`.

The new stateful adapters retain Foldkit's public model/message surface. The
parent must forward updates and commands; rendering an adapter alone does not
install behavior. See the [integration guide](./stateful.md).

Tests exercise rendered keyboard events with Foldkit Scene and real browser
focus/dismissal through the UI kit. Browser tests also cover reduced motion,
dialog unmount cleanup, native form values, and custom popover colors. These
checks establish the tested behaviors above, not a complete accessibility audit.

This capability guide and the styled-adapter approach were informed by
[Foldcn](https://foldcn.elianiva.com/). Foldworks continues to use its own StyleX
recipes and package distribution.

See [Desktop primitives](./desktop.md) for the architecture audit, package boundaries,
integration contracts, measurement constraints, and date/time assessment.
