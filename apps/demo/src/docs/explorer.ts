import { Sidebar } from "@foldworks/sidebar";
import { EditableText } from "@foldworks/ui";

export type Transition = Readonly<{
  from: string;
  to: string;
  event: string;
  commands: number;
  outMessage: string;
}>;
export type Explorer = Readonly<{
  id: string;
  title: string;
  description: string;
  initial: string;
  states: ReadonlyArray<string>;
  transitions: ReadonlyArray<Transition>;
  events: ReadonlyArray<string>;
  replay: (events: ReadonlyArray<string>) => Readonly<{
    state: string;
    model: unknown;
    trace: ReadonlyArray<Transition>;
  }>;
}>;

/** Enumerate a finite projection by executing real reducers. Commands are described, never executed. */
export const exploreReducer = <Model, Message>(
  config: Readonly<{
    id: string;
    title: string;
    description: string;
    init: () => Model;
    project: (model: Model) => string;
    events: ReadonlyArray<Readonly<{ label: string; message: Message }>>;
    update: (
      model: Model,
      message: Message,
    ) => Readonly<{
      model: Model;
      commands?: ReadonlyArray<unknown>;
      outMessage?: unknown;
    }>;
  }>,
): Explorer => {
  const initialModel = config.init();
  const initial = config.project(initialModel);
  const known = new Map([[initial, initialModel]]);
  const queue = [initialModel];
  const transitions: Transition[] = [];
  const step = (model: Model, event: (typeof config.events)[number]) => {
    const result = config.update(model, event.message);
    return {
      model: result.model,
      transition: {
        from: config.project(model),
        to: config.project(result.model),
        event: event.label,
        commands: result.commands?.length ?? 0,
        outMessage: result.outMessage === undefined ? "" : JSON.stringify(result.outMessage),
      },
    };
  };
  while (queue.length) {
    const model = queue.shift()!;
    for (const event of config.events) {
      const result = step(model, event);
      transitions.push(result.transition);
      if (!known.has(result.transition.to)) {
        if (known.size >= 32)
          throw new Error(`${config.id}: projection must have at most 32 states`);
        known.set(result.transition.to, result.model);
        queue.push(result.model);
      }
    }
  }
  return {
    id: config.id,
    title: config.title,
    description: config.description,
    initial,
    states: [...known.keys()],
    transitions,
    events: config.events.map((event) => event.label),
    replay: (events) => {
      let model = config.init();
      const trace: Transition[] = [];
      for (const label of events) {
        const event = config.events.find((candidate) => candidate.label === label);
        if (!event) continue;
        const result = step(model, event);
        model = result.model;
        trace.push(result.transition);
      }
      return { state: config.project(model), model, trace };
    },
  };
};

export const explorers: ReadonlyArray<Explorer> = [
  exploreReducer<Sidebar.Model, Sidebar.Message>({
    id: "sidebar",
    title: "Sidebar",
    init: () => Sidebar.init({ id: "docs-sidebar-example" }),
    description:
      "Complete projection of isCollapsed × isMobileOpen. Every edge executes Sidebar.update; announcements remain in the model snapshot.",
    project: (model) =>
      `${model.isCollapsed ? "Collapsed" : "Expanded"} · ${model.isMobileOpen ? "Mobile open" : "Mobile closed"}`,
    events: [
      { label: "ToggledCollapsed", message: Sidebar.Message.ToggledCollapsed() },
      { label: "ToggledMobile", message: Sidebar.Message.ToggledMobile() },
      { label: "ClosedMobile", message: Sidebar.Message.ClosedMobile() },
    ],
    update: Sidebar.update,
  }),
  exploreReducer<EditableText.Model, EditableText.Message>({
    id: "editable-text",
    title: "EditableText",
    init: () => EditableText.init("docs-editable-example"),
    description:
      "Sampled projection of mode, draft validity, and validation error. Policy: initial value “Foldworks”, nonempty validation, commit on blur. Includes valid and empty drafts; emitted focus commands are shown without running them.",
    project: (model) =>
      model.mode === "view"
        ? "Viewing"
        : model.error
          ? "Editing · error"
          : model.draft.trim()
            ? "Editing · valid"
            : "Editing · empty",
    events: [
      { label: "Started", message: EditableText.Message.Started() },
      {
        label: 'Changed("Foldworks")',
        message: EditableText.Message.Changed({ value: "Foldworks" }),
      },
      { label: 'Changed("")', message: EditableText.Message.Changed({ value: "" }) },
      { label: "Committed", message: EditableText.Message.Committed({ returnFocus: false }) },
      { label: "Cancelled", message: EditableText.Message.Cancelled({ returnFocus: false }) },
      { label: "Blurred", message: EditableText.Message.Blurred() },
      { label: "Focused", message: EditableText.Message.Focused() },
    ],
    update: (model, message) =>
      EditableText.update(model, message, {
        value: "Foldworks",
        validate: (value) => (value.trim() ? undefined : "A value is required."),
      }),
  }),
];
