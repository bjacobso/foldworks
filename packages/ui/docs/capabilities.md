# UI capabilities

The catalog covers component names and visual compositions. It does not promise
behavioral parity with shadcn/ui. Choose an API by the interaction it supports.

| Family | Recommended API | Included behavior | Current limits |
| --- | --- | --- | --- |
| Tabs | `Stateful.Tabs` | Arrow keys, Home/End, disabled-item skipping, automatic/manual activation, vertical orientation, focus commands, linked panels | Values must be unique; parent owns selection; no tab removal/reordering UI |
| Dialog | `Stateful.Dialog` | Initial focus, focus trap, Escape/backdrop/close-button dismissal, return focus, scroll lock, unmount cleanup, optional enter/leave transitions | Centered modal only; application owns form submission; keep the submodel mounted while closed |
| Custom select | `Stateful.Select` | Typeahead, arrow keys, disabled options, read-only mode, anchored popup, selection closes popup, return focus, hidden form input | Styled adapter supports a flat single-selection list; use `Headless.Listbox.Multi` for multiple selection |
| Command palette | `Stateful.Command` | Fuzzy/keyword search, ranked groups, arrow keys, Home/End, Enter, pointer selection, disabled-item skipping, active-result scrolling | Inline palette; compose with Dialog for a modal; application owns actions, fetching and stale-request handling; no typo correction |
| Button, checkbox, switch, fields, disclosure | Existing root helpers | Foldkit helper behavior and native semantics; description/label attribute bundles | Application owns validation and state; input `isRequired` currently marks the label and is not a substitute for native required validation |
| Native select | `Select.control`, `NativeSelect.view`, `Field.select` | Native browser keyboard/selection behavior | Native popup appearance is browser-controlled |
| Legacy tabs | `Tabs.view` | Controlled selection, linked panels, click handling | Does not run keyboard focus commands; migrate interactive tab interfaces to `Stateful.Tabs` |
| Legacy overlays | `Dialog.view`, `AlertDialog.view`, `Sheet.view`, `Drawer.view` | Controlled visibility and visual placement | No managed modal focus trap, focus restoration or scroll lock; `initialFocusId` is not implemented; use `Stateful.Dialog` for modal behavior |
| Legacy custom select | `Select.view` | Controlled popup and click selection | No managed typeahead, roving focus or dismissal lifecycle; use `Stateful.Select` |
| Menus | `DropdownMenu`, `ContextMenu`, `Menubar` | Controlled presentation and click callbacks | No complete menu keyboard model, submenu navigation or pointer anchoring; use `Headless.Menu` for behavior |
| Popover, tooltip, hover card | Existing root views | Controlled rendering; hover callbacks where exposed | No complete focus/keyboard/anchoring lifecycle; use corresponding `Headless` engines |
| Combobox | `Combobox.view` | Native datalist suggestions | Browser-controlled popup, no custom option rendering or strict selection; `Headless.Combobox` supplies the stateful engine |
| Calendar | `Calendar.view` | Single-date click selection and month callbacks | Weekday labels/start-of-week are fixed; no full calendar keyboard navigation; use `Headless.Calendar` |
| Toasts | `Sonner.view` | Supplied messages, actions, live region, explicit dismissal | No auto-dismiss/hover-pause lifecycle; use `Headless.Toast` |
| Layout and display | Card, Panel, Table, badges, operational compositions | Presentation of application-owned data | Table is presentational; use `@foldworks/data-grid` for grid behavior. Resizable uses native CSS resizing; Carousel uses native scrolling |

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
