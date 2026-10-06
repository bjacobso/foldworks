import { Schema as S } from "effect";
import { Agent } from "@foldworks/agent";
import { Items, Outliner, item, find, ancestors } from "@foldworks/outliner";
import { DateInput } from "@foldworks/ui";

export const ContextSource = S.Struct({ id: S.String, text: S.String });
export const Thread = S.Struct({
  agent: Agent.Model,
  context: S.Array(ContextSource),
  prompt: S.String,
  summary: S.String,
  result: S.String,
});
export type Thread = typeof Thread.Type;
// Persist durable conversation state; restore UI submodels rather than JSON-encoding
// runtime Option values inside model pickers and transient DOM state.
const SavedAgent = S.Struct({
  id: S.String,
  transcript: S.Array(Agent.Turn),
  draft: S.String,
  selectedModel: S.String,
  runState: Agent.RunState,
  nextRunNumber: S.Int,
});
const SavedThread = S.Struct({ ...Thread.fields, agent: SavedAgent });
export const Document = S.Struct({
  version: S.Literal(1),
  items: Items,
  threads: S.Record(S.String, SavedThread),
  dates: S.Record(S.String, S.String),
});
export type Document = typeof Document.Type;
export const DetailView = S.Literals(["Thread", "Context", "Result"]);
export const Model = S.Struct({
  outline: Outliner.Model,
  threads: S.Record(S.String, Thread),
  dates: S.Record(S.String, S.String),
  dateInputs: S.Record(S.String, DateInput.Model),
  selectedId: S.NullOr(S.String),
  detailView: DetailView,
  showFoldedViews: S.Boolean,
  saveState: S.Literals(["Saved", "Error"]),
  announcement: S.String,
});
export type Model = typeof Model.Type;

export const STORAGE_KEY = "foldworks-outline-workspace-v1";
export const dateInputFor = (id: string, value = ""): DateInput.Model => {
  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  return DateInput.init({
    id: `outline-date-${id}`,
    today,
    initialViewDate: DateInput.iso.parse(value) ?? today,
    locale: DateInput.calendarLocale("en-US", "Monday"),
  });
};
export const sampleItems = [
  item("launch", "Launch the new workspace", [
    item("principle", "Keep the first version quiet and keyboard-first. #context"),
    item("audience", "People arrive with an existing project. #context"),
    item(
      "onboarding",
      "Explore onboarding",
      [
        item("onboarding-note", "Compare a guided setup with opening straight into the outline."),
        item("onboarding-scope", "Bring back a recommendation before building anything."),
      ],
      { collapsed: true },
    ),
    item(
      "keyboard",
      "Fix keyboard navigation",
      [item("keyboard-note", "Tab should indent. Enter should make a new bullet.")],
      { collapsed: true },
    ),
    item("invite", "Ask Maya about the invitation flow. @maya"),
  ]),
  item("scratch", "Scratchpad", [
    item("thought", "What if the outline became the place we think and work?"),
    item("try", "Write a task, then type /agent to attach a thread."),
  ]),
  item(
    "later",
    "Later",
    [
      item("multiplayer", "Shared presence, comments, and ownership. #idea"),
      item("scheduling", "Dates first. Scheduling when we need it."),
    ],
    { collapsed: true },
  ),
];

export const newThread = (id: string): Thread => ({
  agent: Agent.init({ id: `outline-agent-${id}`, selectedModel: "local-balanced" }),
  context: [],
  prompt: "",
  summary: "Ready when you are.",
  result: "",
});

/** Parent briefs and explicitly marked sibling context, followed by this node's notes.
 * Other threads' outputs are excluded unless explicitly marked #context. */
export const contextFor = (model: Model, id: string): Thread["context"] => {
  const node = find(model.outline.items, id);
  if (!node) return [];
  const path = ancestors(model.outline.items, id).map(
    (ancestorId) => find(model.outline.items, ancestorId)!,
  );
  const sources = path.flatMap((parent) => [
    { id: parent.id, text: parent.text },
    ...parent.children
      .filter((child) => child.id !== id && /(?:^|\s)#context\b/.test(child.text))
      .map((child) => ({ id: child.id, text: child.text })),
  ]);
  const notes = (children: Items): Thread["context"] =>
    children.flatMap((child) =>
      model.threads[child.id] || child.text.startsWith("Result: ")
        ? []
        : [{ id: child.id, text: child.text }, ...notes(child.children)],
    );
  sources.push(...notes(node.children));
  return sources.filter(
    (source, index) => sources.findIndex((other) => other.id === source.id) === index,
  );
};

export const statusOf = (thread: Thread): string => {
  switch (thread.agent.runState._tag) {
    case "Streaming":
      return "Working";
    case "AwaitingPermission":
      return "Needs you";
    case "Failed":
      return "Failed";
    case "Idle":
      return thread.result ? "Ready" : thread.agent.transcript.length ? "Paused" : "Thread";
  }
};

export const documentOf = (model: Model): Document => ({
  version: 1,
  items: model.outline.items,
  threads: Object.fromEntries(
    Object.entries(model.threads).map(([id, thread]) => {
      const {
        id: agentId,
        transcript,
        draft,
        selectedModel,
        runState,
        nextRunNumber,
      } = thread.agent;
      return [
        id,
        {
          ...thread,
          agent: { id: agentId, transcript, draft, selectedModel, runState, nextRunNumber },
        },
      ];
    }),
  ),
  dates: model.dates,
});

export const restore = (document: Document): Model => ({
  outline: Outliner.init({ id: "orchestrator", items: document.items }),
  threads: Object.fromEntries(
    Object.entries(document.threads).map(([id, thread]) => [
      id,
      {
        ...thread,
        agent:
          thread.agent.runState._tag === "Streaming" ||
          thread.agent.runState._tag === "AwaitingPermission"
            ? Agent.update(
                { ...Agent.init(thread.agent), ...thread.agent },
                Agent.Message.Stopped(),
              ).model
            : { ...Agent.init(thread.agent), ...thread.agent },
        summary:
          thread.agent.runState._tag === "Streaming" ||
          thread.agent.runState._tag === "AwaitingPermission"
            ? "Paused after reopening. Send a new direction to continue."
            : thread.summary,
      },
    ]),
  ),
  dates: document.dates,
  dateInputs: {},
  selectedId: null,
  detailView: "Thread",
  showFoldedViews: true,
  saveState: "Saved",
  announcement: "Outline workspace ready.",
});

export const initialModel = (): Model => {
  try {
    const json = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    if (json) return restore(S.decodeUnknownSync(Document)(JSON.parse(json)));
  } catch {
    /* Invalid or unavailable storage falls back to the example. */
  }
  return restore({
    version: 1,
    items: sampleItems,
    threads: { onboarding: newThread("onboarding"), keyboard: newThread("keyboard") },
    dates: {},
  });
};
