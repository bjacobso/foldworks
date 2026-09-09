# Stateful UI integration

Import `Stateful` from `@foldworks/ui` for styled Tabs, Dialog, Select, and Command
submodels. Import the base CSS and a theme and configure the StyleX transform as
described in the package README. The adapters use the existing theme; their
appearance is shared with the root primitives.

The application owns selected values and business actions. Foldkit models own
temporary interaction state. Render through `h.submodel`, forward messages with
`Update.foldChild`, and let the application runtime execute the returned commands.
These four components require no application subscriptions. Keep slot IDs stable
and unique. Call `create` once at module scope, never during rendering.

## Complete tabs module

This module can be embedded as a child of a Foldkit application. Its model stores
both the selected value and the engine's private focus state. Arrow keys update
the selection through an OutMessage; the same update forwards the focus command.

```ts
import { Stateful } from "@foldworks/ui";
import { Option, Schema as S } from "effect";
import { Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { defineView } from "foldkit/submodel";

const Tab = S.Literals(["overview", "settings"]);
type Tab = typeof Tab.Type;
const AccountTabs = Stateful.Tabs.create<Tab>();

export const Model = S.Struct({
  selected: Tab,
  tabs: Stateful.Tabs.Model,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  GotTabsMessage: { message: Stateful.Tabs.Message },
});
export type Message = typeof Message.Type;

export const init = (): Model => ({
  selected: "overview",
  tabs: Stateful.Tabs.init({ id: "account-tabs" }),
});

const foldTabs = Update.foldChild({
  update: AccountTabs.update,
  read: (model: Model) => Option.some(model.tabs),
  write: (model, tabs) => ({ ...model, tabs }),
  toParentMessage: (message) => Message.GotTabsMessage({ message }),
  foldOutMessage: (outMessage) => (model: Model) => ({
    model: { ...model, selected: outMessage.value },
  }),
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    GotTabsMessage: ({ message }) => foldTabs(model, message),
  });

export const view = defineView<Model, Message>((model, h) => h.submodel({
  slotId: model.tabs.id,
  model: model.tabs,
  view: AccountTabs.view,
  viewInputs: Stateful.Tabs.styledViewInputs({
    selectedValue: model.selected,
    ariaLabel: "Account views",
    tabs: [
      { value: "overview", label: "Overview", content: ["Account overview"] },
      { value: "settings", label: "Settings", content: ["Account settings"] },
    ],
  }, h),
  toParentMessage: (message) => Message.GotTabsMessage({ message }),
}));
```

Set `activationMode: "Manual"` in `init` to move focus with arrow keys while
requiring Enter or Space to select. Set `orientation: "Vertical"` in the adapter
for vertical layout and Up/Down navigation. Set `isDisabled: true` on an item to
skip it. Panels remain mounted and inactive panels are hidden.

## Dialog

Store `Stateful.Dialog.Model`, initialize with `Stateful.Dialog.init({ id,
isAnimated: true })`, and forward `Stateful.Dialog.Message` to
`Stateful.Dialog.update`. Handle its `Opened` and `Closed` OutMessages through
`foldOutMessage`, even if the handler just returns `{ model }`.

Open by forwarding `Stateful.Dialog.Message.RequestedOpen()` through the same
parent message wrapper. Keep `h.submodel` mounted while closed so its lifecycle
commands can find the dialog element. Use `Stateful.Dialog.view` with these inputs:

```ts
Stateful.Dialog.styledViewInputs({
  title: "Edit profile",
  description: "Changes apply to your public profile.",
  content: ({ initialFocus }, h) => [
    h.input([...initialFocus, h.AriaLabel("Display name")]),
  ],
  footer: ({ closeButton }, h) => [
    h.button(closeButton, ["Cancel"]),
  ],
}, h)
```

The content callback uses the parent's builder: application actions can dispatch
parent messages. Spread `initialFocus` onto the intended input and `closeButton`
onto the dismiss control. `Button.view` and catalog controls accept these child
attribute bundles through `attributes`, preserving their event ownership.
An explicit `focusSelector` in Dialog `init` takes precedence over the focus marker.
Transitions respect `prefers-reduced-motion`.

## Select

Create `const DepartmentSelect = Stateful.Select.create<Department>()` once.
Store `Stateful.Select.Model` and initialize with `Stateful.Select.init({ id })`.
Forward `Stateful.Select.Message` to `DepartmentSelect.update`; its `Selected`
OutMessage provides `value: Department`. Store that value in the parent.
Render `DepartmentSelect.view` through `h.submodel` with:

```ts
Stateful.Select.styledViewInputs({
  value: model.department,
  ariaLabel: "Department",
  name: "department",
  options: [
    { value: "Engineering", label: "Engineering" },
    { value: "Operations", label: "Operations", isDisabled: true },
    { value: "People", label: "People" },
  ],
}, h)
```

Omit `value` for no selection. `name` adds the engine's hidden form input.
Read-only mode permits navigation while preventing selection. Disabled mode
prevents opening. This styled adapter supports a flat, single-selection list.

## Command

Store `Stateful.Command.Model`, initialize with `Stateful.Command.init({ id })`,
and forward `Stateful.Command.Message` to `Stateful.Command.update`. Embed
`Stateful.Command.view` with `{ ariaLabel, items }` as `viewInputs`. Each item has
a unique `value`, `label`, and optional `group`, `keywords`, `media`, or
`isDisabled`. Handle `Selected({ value })` in the parent to perform the action.
Selection preserves the search; closing a containing dialog is application-owned.

Search is case-insensitive and supports subsequences and keywords. Exact and
prefix matches rank higher. Set `loop: true` to wrap keyboard navigation;
otherwise it stops at the ends. Pass a `filter(query, item)` returning positive
scores for custom ranking. For remote results, use `shouldFilter: false`, handle
`SearchChanged({ query })` to fetch, and pass the resulting items back. The parent
must discard stale responses. Removed active results fall back to the first
enabled match.

## Working application and migration

The demo wires all four components end to end:

- [Model and initialization](https://github.com/bjacobso/foldworks/blob/main/apps/demo/src/ui-kit/model.ts)
- [Messages](https://github.com/bjacobso/foldworks/blob/main/apps/demo/src/ui-kit/message.ts)
- [Update forwarding and OutMessages](https://github.com/bjacobso/foldworks/blob/main/apps/demo/src/ui-kit/update.ts)
- [Typed bundles](https://github.com/bjacobso/foldworks/blob/main/apps/demo/src/ui-kit/components.ts)
- [Views](https://github.com/bjacobso/foldworks/blob/main/apps/demo/src/ui-kit/catalog-view.ts)

Existing root `Tabs.view`, `Dialog.view`, `Select.view`, and `Command.view` remain
source-compatible. Migrate an interactive instance by adding its engine model,
message wrapper, and update fold, then replacing the view call with `h.submodel`.
Keep native select helpers for native controls. See [capabilities](./capabilities.md)
for the specific behavior and remaining limits of each API.
