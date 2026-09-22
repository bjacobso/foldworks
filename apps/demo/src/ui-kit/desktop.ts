import { Option, Schema as S } from "effect";
import { Calendar, Command as Cmd, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { defineView } from "foldkit/submodel";
import {
  Breadcrumb,
  Button,
  DateInput,
  EditableText,
  Layout,
  OverflowList,
  Panel,
  PanelStack,
  Shortcuts,
  Stateful,
  TokenField,
  Toolbar,
} from "@foldworks/ui";

export const commands: ReadonlyArray<Shortcuts.Binding> = [
  {
    id: "save",
    label: "Save workspace",
    shortcut: Shortcuts.shortcut("s", "Mod", "Shift"),
  },
  {
    id: "inspect",
    label: "Inspect selection",
    shortcut: Shortcuts.shortcut("i", "Mod", "Shift"),
  },
  {
    id: "global-preview",
    label: "Preview workspace",
    shortcut: Shortcuts.shortcut("Enter", "Mod"),
  },
  {
    id: "preview",
    label: "Preview inspector",
    shortcut: Shortcuts.shortcut("Enter", "Mod"),
    scope: "desktop-inspector",
    allowEditable: true,
  },
];
const Menu = Stateful.Menu.create<string>();
export const Model = S.Struct({
  platform: Shortcuts.Platform,
  commandsEnabled: S.Boolean,
  menu: Stateful.Menu.Model,
  palette: Stateful.Command.Model,
  context: Stateful.ContextMenu.Model,
  sheetMenu: Stateful.ContextMenu.Model,
  nested: Stateful.ContextMenu.Model,
  editable: EditableText.Model,
  name: S.String,
  multiline: EditableText.Model,
  description: S.String,
  tokens: TokenField.Model,
  values: S.Array(S.String),
  stack: PanelStack.Model,
  breadcrumbs: OverflowList.Model,
  actions: OverflowList.Model,
  drawer: Stateful.Dialog.Model,
  sheet: Stateful.Dialog.Model,
  alert: Stateful.Dialog.Model,
  date: DateInput.Model,
  deadline: S.NullOr(Calendar.CalendarDate),
  compact: S.Boolean,
  sort: S.String,
  announcement: S.String,
  saveCount: S.Number,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Invoked: { id: S.String },
  ToggledCommands: {},
  Registered: { message: Shortcuts.Message },
  Menu: { message: Stateful.Menu.Message },
  Palette: { message: Stateful.Command.Message },
  SheetMenu: { message: Stateful.ContextMenu.Message },
  Context: { message: Stateful.ContextMenu.Message },
  Nested: { message: Stateful.ContextMenu.Message },
  Editable: { message: EditableText.Message },
  Multiline: { message: EditableText.Message },
  Tokens: { message: TokenField.Message },
  Stack: { message: PanelStack.Message },
  Breadcrumbs: { message: OverflowList.Message },
  Actions: { message: OverflowList.Message },
  Drawer: { message: Stateful.Dialog.Message },
  Sheet: { message: Stateful.Dialog.Message },
  Alert: { message: Stateful.Dialog.Message },
  Date: { message: DateInput.Message },
  Open: { kind: S.Literals(["drawer", "sheet", "alert"]) },
});
export type Message = typeof Message.Type;
export const initialModel: Model = {
  commandsEnabled: true,
  platform:
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? "mac"
      : "other",
  menu: Stateful.Menu.init({ id: "desktop-menu" }),
  palette: Stateful.Command.init({ id: "desktop-palette" }),
  sheetMenu: Stateful.ContextMenu.init("desktop-sheet-menu"),
  context: Stateful.ContextMenu.init("desktop-context"),
  nested: Stateful.ContextMenu.init("desktop-nested"),
  editable: EditableText.init("desktop-name"),
  name: "Launch readiness",
  multiline: EditableText.init("desktop-description"),
  description: "Review the release checklist with the platform team.",
  tokens: TokenField.init("desktop-tags"),
  values: ["Platform", "Design"],
  stack: PanelStack.init("desktop-stack", "project"),
  breadcrumbs: OverflowList.init(),
  actions: OverflowList.init(),
  drawer: Stateful.Dialog.init({ id: "desktop-drawer", isAnimated: true }),
  sheet: Stateful.Dialog.init({ id: "desktop-sheet", isAnimated: true }),
  alert: Stateful.Dialog.init({ id: "desktop-alert", isAnimated: true }),
  date: DateInput.init({
    id: "desktop-date",
    locale: DateInput.calendarLocale("en-GB", "Monday"),
    today: { year: 2026, month: 9, day: 22 },
  }),
  deadline: { year: 2026, month: 9, day: 24 },
  compact: true,
  sort: "name",
  announcement: "Workspace ready.",
  saveCount: 0,
};
const tokenConfig = (model: Model): TokenField.Config => ({
  values: model.values,
  options: ["Platform", "Design", "Operations", "Engineering"].map((value) => ({
    value,
    label: value,
  })),
  allowCustom: true,
  maxCount: 5,
  deduplicate: (value) => value.toLowerCase(),
  validate: (value) =>
    value.length > 24 ? "Tags must be 24 characters or fewer." : undefined,
});
const deadlineCodec = DateInput.numericLocale("en-GB");
const dateConfig = (model: Model): DateInput.Config => ({
  value: model.deadline,
  codec: deadlineCodec,
  min: { year: 2026, month: 9, day: 22 },
  max: { year: 2026, month: 12, day: 31 },
  disabledDates: [{ year: 2026, month: 9, day: 25 }],
});
const activeCommands = (model: Model) =>
  commands.map((command) => ({
    ...command,
    isDisabled: !model.commandsEnabled,
  }));
const menuItems = (model: Model): ReadonlyArray<Stateful.ContextMenu.Item> => [
  { id: "save", label: "Save workspace", command: activeCommands(model)[0]! },
  {
    id: "view",
    label: "View options",
    children: [
      {
        id: "compact",
        label: "Compact rows",
        kind: "checkbox",
        isChecked: model.compact,
      },
      {
        id: "sort",
        label: "Sort by",
        children: [
          {
            id: "name",
            label: "Name",
            kind: "radio",
            isChecked: model.sort === "name",
          },
          {
            id: "date",
            label: "Modified date",
            kind: "radio",
            isChecked: model.sort === "date",
          },
        ],
      },
      { id: "locked", label: "Administrator settings", isDisabled: true },
    ],
  },
];
const invoke = (model: Model, id: string): Model => ({
  ...model,
  saveCount: model.saveCount + (id === "save" ? 1 : 0),
  announcement:
    id === "save"
      ? `Workspace saved (${model.saveCount + 1}).`
      : id === "preview"
        ? "Inspector preview requested."
        : `${id} requested.`,
});
export const update = (
  model: Model,
  message: Message,
): Update.Return<Model, Message> => {
  switch (message._tag) {
    case "ToggledCommands":
      return { model: { ...model, commandsEnabled: !model.commandsEnabled } };
    case "Invoked":
      return { model: invoke(model, message.id) };
    case "Registered":
      return { model: invoke(model, message.message.id) };
    case "Menu": {
      const r = Menu.update(model.menu, message.message);
      return {
        model: r.outMessage
          ? invoke({ ...model, menu: r.model }, r.outMessage.value)
          : { ...model, menu: r.model },
        commands: (r.commands ?? []).map((c) =>
          Cmd.mapMessage(c, (message) => Message.Menu({ message })),
        ),
      };
    }
    case "Palette": {
      const r = Stateful.Command.update(model.palette, message.message);
      return {
        model:
          r.outMessage?._tag === "Selected"
            ? invoke({ ...model, palette: r.model }, r.outMessage.value)
            : { ...model, palette: r.model },
        commands: (r.commands ?? []).map((c) =>
          Cmd.mapMessage(c, (message) => Message.Palette({ message })),
        ),
      };
    }
    case "Context":
    case "Nested":
    case "SheetMenu": {
      const key =
        message._tag === "Context"
          ? "context"
          : message._tag === "SheetMenu"
            ? "sheetMenu"
            : "nested";
      const r = Stateful.ContextMenu.update(
        model[key],
        message.message,
        menuItems(model),
      );
      let next = { ...model, [key]: r.model };
      if (r.outMessage) {
        const { id, isChecked } = r.outMessage;
        next =
          id === "compact"
            ? { ...next, compact: isChecked }
            : id === "name" || id === "date"
              ? { ...next, sort: id }
              : invoke(next, id);
      }
      return {
        model: next,
        commands: (r.commands ?? []).map((c) =>
          Cmd.mapMessage(c, (m) =>
            key === "context"
              ? Message.Context({ message: m })
              : key === "sheetMenu"
                ? Message.SheetMenu({ message: m })
                : Message.Nested({ message: m }),
          ),
        ),
      };
    }
    case "Editable":
    case "Multiline": {
      const key = message._tag === "Editable" ? "editable" : "multiline";
      const valueKey = key === "editable" ? "name" : "description";
      const r = EditableText.update(model[key], message.message, {
        value: model[valueKey],
        blur: "keep",
        validate: (value) => (value.trim() ? undefined : "Enter a name."),
      });
      return {
        model: {
          ...model,
          [key]: r.model,
          [valueKey]:
            r.outMessage?._tag === "Committed"
              ? r.outMessage.value
              : model[valueKey],
        },
        commands: (r.commands ?? []).map((c) =>
          Cmd.mapMessage(c, (message) =>
            key === "editable"
              ? Message.Editable({ message })
              : Message.Multiline({ message }),
          ),
        ),
      };
    }
    case "Tokens": {
      const r = TokenField.update(
        model.tokens,
        message.message,
        tokenConfig(model),
      );
      return {
        model: {
          ...model,
          tokens: r.model,
          values: r.outMessage?.values ?? model.values,
        },
        commands: (r.commands ?? []).map((c) =>
          Cmd.mapMessage(c, (message) => Message.Tokens({ message })),
        ),
      };
    }
    case "Stack": {
      const r = PanelStack.update(model.stack, message.message);
      const step =
        r.outMessage?._tag === "Push"
          ? PanelStack.push(r.model, r.outMessage)
          : r.outMessage?._tag === "Pop"
            ? PanelStack.pop(r.model)
            : r;
      return {
        model: { ...model, stack: step.model },
        commands: (step.commands ?? []).map((c) =>
          Cmd.mapMessage(c, (message) => Message.Stack({ message })),
        ),
      };
    }
    case "Breadcrumbs":
      return {
        model: {
          ...model,
          breadcrumbs: OverflowList.update(model.breadcrumbs, message.message)
            .model,
        },
      };
    case "Actions":
      return {
        model: {
          ...model,
          actions: OverflowList.update(model.actions, message.message).model,
        },
      };
    case "Open": {
      const r = Stateful.Dialog.open(model[message.kind]);
      return {
        model: { ...model, [message.kind]: r.model },
        commands: (r.commands ?? []).map((c) =>
          Cmd.mapMessage(c, (m) =>
            message.kind === "drawer"
              ? Message.Drawer({ message: m })
              : message.kind === "sheet"
                ? Message.Sheet({ message: m })
                : Message.Alert({ message: m }),
          ),
        ),
      };
    }
    case "Drawer":
    case "Sheet":
    case "Alert": {
      const key =
        message._tag === "Drawer"
          ? "drawer"
          : message._tag === "Sheet"
            ? "sheet"
            : "alert";
      const r = Stateful.Dialog.update(model[key], message.message);
      return {
        model: { ...model, [key]: r.model },
        commands: (r.commands ?? []).map((c) =>
          Cmd.mapMessage(c, (m) =>
            key === "drawer"
              ? Message.Drawer({ message: m })
              : key === "sheet"
                ? Message.Sheet({ message: m })
                : Message.Alert({ message: m }),
          ),
        ),
      };
    }
    case "Date": {
      const r = DateInput.update(
        model.date,
        message.message,
        dateConfig(model),
      );
      return {
        model: {
          ...model,
          date: r.model,
          deadline: r.outMessage ? r.outMessage.value : model.deadline,
        },
        commands: (r.commands ?? []).map((c) =>
          Cmd.mapMessage(c, (message) => Message.Date({ message })),
        ),
      };
    }
  }
};
export const view = defineView<Model, Message>((model, h) => {
  const bindings = activeCommands(model);
  const paths = [
    "Foldworks",
    "Workspaces",
    "Platform",
    "Projects",
    model.name,
  ].map((label, index) => ({
    id: `crumb-${index}`,
    label,
    current: index === 4,
  }));
  const actions = [
    "Save workspace",
    "Inspect selection",
    "Export",
    "Duplicate",
    "Archive",
  ].map((label, index) => ({ id: `action-${index}`, label }));
  const inspector = h.div(
    [h.Id("desktop-inspector")],
    [
      PanelStack.view(
        {
          model: model.stack,
          toParentMessage: (message) => Message.Stack({ message }),
          title: (id) =>
            id === "project"
              ? "Project inspector"
              : id === "permissions"
                ? "Permissions"
                : "Advanced permissions",
          render: (id) =>
            id === "project"
              ? Layout.stack(
                  {
                    gap: "sm",
                    children: [
                      EditableText.view(
                        {
                          model: model.editable,
                          value: model.name,
                          label: "project name",
                          blur: "keep",
                          toParentMessage: (message) =>
                            Message.Editable({ message }),
                        },
                        h,
                      ),
                      EditableText.view(
                        {
                          model: model.multiline,
                          value: model.description,
                          label: "description",
                          multiline: true,
                          blur: "keep",
                          toParentMessage: (message) =>
                            Message.Multiline({ message }),
                        },
                        h,
                      ),
                      Button.view(
                        {
                          label: "Permissions",
                          attributes: [h.Id("desktop-permissions")],
                          variant: "outline",
                          onClick: Message.Stack({
                            message: PanelStack.Message.RequestedPush({
                              id: "permissions",
                              returnFocusId: "desktop-permissions",
                            }),
                          }),
                        },
                        h,
                      ),
                    ],
                  },
                  h,
                )
              : id === "permissions"
                ? Layout.stack(
                    {
                      gap: "sm",
                      children: [
                        h.p(
                          [],
                          ["Platform and Design can edit this workspace."],
                        ),
                        Button.view(
                          {
                            label: "Advanced permissions",
                            attributes: [h.Id("desktop-advanced")],
                            variant: "outline",
                            onClick: Message.Stack({
                              message: PanelStack.Message.RequestedPush({
                                id: "advanced",
                                returnFocusId: "desktop-advanced",
                              }),
                            }),
                          },
                          h,
                        ),
                      ],
                    },
                    h,
                  )
                : h.p(
                    [],
                    [
                      "Only workspace owners can change retention and export policy.",
                    ],
                  ),
        },
        h,
      ),
    ],
  );
  return h.section(
    [h.Id("desktop-primitives")],
    [
      Shortcuts.registration(
        {
          bindings,
          platform: model.platform,
          toParentMessage: (message) => Message.Registered({ message }),
        },
        h,
      ),
      Panel.view(
        {
          title: "Desktop workspace",
          description:
            "Shared commands, measured action rows, controlled editing, and nested inspectors.",
          children: [
            Layout.stack(
              {
                gap: "md",
                children: [
                  OverflowList.view(
                    {
                      model: model.breadcrumbs,
                      items: paths,
                      label: "Workspace path",
                      direction: "start",
                      minVisible: 1,
                      toParentMessage: (message) =>
                        Message.Breadcrumbs({ message }),
                      renderItem: (item) =>
                        item.current
                          ? Breadcrumb.view(
                              { items: [], current: item.label },
                              h,
                            )
                          : h.button(
                              [
                                h.Type("button"),
                                h.OnClick(Message.Invoked({ id: item.label })),
                              ],
                              [item.label, " / "],
                            ),
                      measureItem: (item) =>
                        item.current
                          ? Breadcrumb.view(
                              { items: [], current: item.label },
                              h,
                            )
                          : h.button([h.Type("button")], [item.label, " / "]),
                    },
                    h,
                  ),
                  Toolbar.view(
                    {
                      title: model.name,
                      description: `${model.values.length} teams · ${model.compact ? "Compact" : "Comfortable"} · Sort by ${model.sort}`,
                      actions: [
                        Button.view(
                          {
                            command: {
                              definition: bindings[0]!,
                              platform: model.platform,
                              toMessage: (id) => Message.Invoked({ id }),
                            },
                          },
                          h,
                        ),
                      ],
                    },
                    h,
                  ),
                  OverflowList.view(
                    {
                      model: model.actions,
                      items: actions,
                      label: "Workspace actions",
                      minVisible: 1,
                      toParentMessage: (message) =>
                        Message.Actions({ message }),
                      renderItem: (item) =>
                        Button.view(
                          {
                            label: item.label,
                            variant: "outline",
                            ...(["action-0", "action-1"].includes(item.id)
                              ? {
                                  command: {
                                    definition:
                                      bindings[item.id === "action-0" ? 0 : 1]!,
                                    platform: model.platform,
                                    toMessage: (id: string) =>
                                      Message.Invoked({ id }),
                                  },
                                }
                              : {
                                  onClick: Message.Invoked({ id: item.label }),
                                }),
                          },
                          h,
                        ),
                      measureItem: (item) =>
                        Button.view(
                          { label: item.label, variant: "outline" },
                          h,
                        ),
                    },
                    h,
                  ),
                  Layout.Grid.view(
                    {
                      columns: { base: 1, lg: 2 },
                      gap: "lg",
                      children: [
                        Layout.stack(
                          {
                            gap: "md",
                            children: [
                              h.submodel({
                                slotId: model.menu.id,
                                model: model.menu,
                                toParentMessage: (message) =>
                                  Message.Menu({ message }),
                                view: Menu.view,
                                viewInputs: Stateful.Menu.styledViewInputs(
                                  {
                                    items: bindings
                                      .slice(0, 2)
                                      .map(Stateful.Menu.fromCommand),
                                    trigger: ["Workspace commands"],
                                    ariaLabel: "Workspace commands",
                                    platform: model.platform,
                                  },
                                  h,
                                ),
                              }),
                              h.submodel({
                                slotId: model.palette.id,
                                model: model.palette,
                                toParentMessage: (message) =>
                                  Message.Palette({ message }),
                                view: Stateful.Command.view,
                                viewInputs: {
                                  items: bindings
                                    .slice(0, 2)
                                    .map(Stateful.Command.fromCommand),
                                  ariaLabel: "Search workspace commands",
                                  platform: model.platform,
                                },
                              }),
                              Button.view(
                                {
                                  label: model.commandsEnabled
                                    ? "Disable workspace commands"
                                    : "Enable workspace commands",
                                  variant: "outline",
                                  onClick: Message.ToggledCommands(),
                                },
                                h,
                              ),
                              h.details(
                                [],
                                [
                                  h.summary(
                                    [],
                                    ["Keyboard shortcut reference"],
                                  ),
                                  Shortcuts.reference(
                                    {
                                      bindings,
                                      platform: model.platform,
                                      onInvoke: (id) => Message.Invoked({ id }),
                                    },
                                    h,
                                  ),
                                ],
                              ),
                              Stateful.ContextMenu.view(
                                {
                                  model: model.context,
                                  items: menuItems(model),
                                  label: "Project context menu",
                                  context: true,
                                  trigger: [
                                    "Right-click this project · Shift+F10",
                                  ],
                                  platform: model.platform,
                                  toParentMessage: (message) =>
                                    Message.Context({ message }),
                                },
                                h,
                              ),
                              Stateful.Menu.Nested.view(
                                {
                                  model: model.nested,
                                  items: menuItems(model),
                                  label: "View settings",
                                  platform: model.platform,
                                  toParentMessage: (message) =>
                                    Message.Nested({ message }),
                                },
                                h,
                              ),
                            ],
                          },
                          h,
                        ),
                        Layout.stack(
                          {
                            gap: "md",
                            children: [
                              inspector,
                              h.form(
                                [
                                  h.Id("desktop-form"),
                                  h.OnSubmit(Message.Invoked({ id: "save" })),
                                ],
                                [
                                  TokenField.view(
                                    {
                                      ...tokenConfig(model),
                                      model: model.tokens,
                                      label: "Project teams",
                                      name: "teams",
                                      toParentMessage: (message) =>
                                        Message.Tokens({ message }),
                                    },
                                    h,
                                  ),
                                  DateInput.view(
                                    {
                                      ...dateConfig(model),
                                      model: model.date,
                                      label: "Deadline",
                                      name: "deadline",
                                      toParentMessage: (message) =>
                                        Message.Date({ message }),
                                    },
                                    h,
                                  ),
                                ],
                              ),
                            ],
                          },
                          h,
                        ),
                      ],
                    },
                    h,
                  ),
                  Layout.row(
                    {
                      gap: "sm",
                      wrap: true,
                      children: [
                        Button.view(
                          {
                            label: "Open activity drawer",
                            variant: "outline",
                            onClick: Message.Open({ kind: "drawer" }),
                          },
                          h,
                        ),
                        Button.view(
                          {
                            label: "Open settings sheet",
                            variant: "outline",
                            onClick: Message.Open({ kind: "sheet" }),
                          },
                          h,
                        ),
                      ],
                    },
                    h,
                  ),
                  h.p(
                    [h.Role("status"), h.Id("desktop-announcement")],
                    [model.announcement],
                  ),
                ],
              },
              h,
            ),
          ],
        },
        h,
      ),
      h.submodel({
        slotId: model.drawer.id,
        model: model.drawer,
        toParentMessage: (message) => Message.Drawer({ message }),
        view: Stateful.Drawer.view,
        viewInputs: Stateful.Drawer.styledViewInputs(
          {
            title: "Workspace activity",
            content: ({ initialFocus, closeButton }, child) => [
              child.button(
                [
                  ...initialFocus,
                  child.OnClick(Message.Open({ kind: "alert" })),
                ],
                ["Clear activity"],
              ),
              child.p(
                [],
                ["All changes are persisted by the host application."],
              ),
              child.button(closeButton, ["Close activity"]),
            ],
          },
          h,
        ),
      }),
      h.submodel({
        slotId: model.sheet.id,
        model: model.sheet,
        toParentMessage: (message) => Message.Sheet({ message }),
        view: Stateful.Sheet.view,
        viewInputs: Stateful.Sheet.styledViewInputs(
          {
            title: "Workspace settings",
            content: ({ initialFocus, closeButton }, child) => [
              child.input([
                ...initialFocus,
                child.AriaLabel("Settings name"),
                child.Value(model.name),
              ]),
              Stateful.Menu.Nested.view(
                {
                  model: model.sheetMenu,
                  items: menuItems(model),
                  label: "Sheet view options",
                  toParentMessage: (message) => Message.SheetMenu({ message }),
                },
                child,
              ),
              child.button(closeButton, ["Close settings"]),
            ],
          },
          h,
        ),
      }),
      h.submodel({
        slotId: model.alert.id,
        model: model.alert,
        toParentMessage: (message) => Message.Alert({ message }),
        view: Stateful.AlertDialog.view,
        viewInputs: Stateful.AlertDialog.styledViewInputs(
          {
            title: "Clear activity?",
            description:
              "This demo requests confirmation without deleting records.",
            content: ({ initialFocus, closeButton }, child) => [
              child.button(
                [...initialFocus, ...closeButton],
                ["Keep activity"],
              ),
              child.button(closeButton, ["Confirm clear"]),
            ],
          },
          h,
        ),
      }),
    ],
  );
});
