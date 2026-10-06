import { Effect, Option, Schema as S } from "effect";
import { Command, Update } from "foldkit";
import { Agent } from "@foldworks/agent";
import { Outliner, find, item, updateItem } from "@foldworks/outliner";
import { Completion } from "@foldworks/text-intelligence";
import { DateInput } from "@foldworks/ui";
import { contextFor, dateInputFor, documentOf, newThread, STORAGE_KEY, type Model } from "./model";
import { Message } from "./message";
import { nextEvent } from "./scenario";

type Return = Update.Return<Model, Message>;

const Save = Command.define("SaveOutlineWorkspace", {
  args: { json: S.String },
  messages: [Message.CompletedSave],
  execute: ({ json }) =>
    Effect.sync(() => {
      try {
        localStorage.setItem(STORAGE_KEY, json);
        return Message.CompletedSave({ succeeded: true });
      } catch {
        return Message.CompletedSave({ succeeded: false });
      }
    }),
});

const foldOutline = Update.foldChild({
  update: Outliner.update,
  read: (model: Model) => Option.some(model.outline),
  write: (model, outline) => ({ ...model, outline }),
  toParentMessage: (message) => Message.GotOutlineMessage({ message }),
});

const attach = (model: Model, id: string): Model => {
  const node = find(model.outline.items, id);
  if (!node) return model;
  return {
    ...model,
    selectedId: id,
    detailView: "Thread",
    threads: model.threads[id] ? model.threads : { ...model.threads, [id]: newThread(id) },
    announcement: `Thread attached to ${node.text}.`,
  };
};

const threadMessage = (model: Model, id: string, message: Agent.Message): Return => {
  const before = model.threads[id];
  if (!before || !find(model.outline.items, id)) return { model };
  const fold = Update.foldChild({
    update: Agent.update,
    read: (parent: Model) => Option.some(parent.threads[id]!.agent),
    write: (parent, agent) => ({
      ...parent,
      threads: { ...parent.threads, [id]: { ...parent.threads[id]!, agent } },
    }),
    toParentMessage: (child) => Message.GotThreadMessage({ id, message: child }),
  });
  const result = fold(model, message);
  let thread = result.model.threads[id]!;
  if (
    thread.agent.runState._tag === "Streaming" &&
    thread.agent.runState.segment === "Initial" &&
    (before.agent.runState._tag !== "Streaming" ||
      before.agent.runState.runId !== thread.agent.runState.runId)
  ) {
    thread = {
      ...thread,
      context: contextFor(result.model, id),
      prompt: Agent.latestUserPrompt(thread.agent),
      result: "",
      summary: "Reading the brief and attached context…",
    };
  }
  if (message._tag === "ReceivedStreamEvent") {
    const state = before.agent.runState;
    // Do not derive summaries from stale or out-of-order provider events.
    if (
      state._tag === "Streaming" &&
      message.envelope.event.runId === state.runId &&
      message.envelope.sequence > state.lastSequence
    ) {
      const event = message.envelope.event;
      if (event._tag === "PermissionRequested")
        thread = { ...thread, summary: "A recommendation is ready for your review." };
      if (event._tag === "Finished") {
        const denied = thread.agent.transcript
          .at(-1)
          ?.parts.some((part) => part._tag === "Tool" && part.status === "Denied");
        const text = thread.agent.transcript
          .at(-1)
          ?.parts.filter((part) => part._tag === "Text")
          .at(-1);
        thread = {
          ...thread,
          result: denied ? "" : text?._tag === "Text" ? text.text : "",
          summary: denied
            ? "Discarded. Send a new direction to try again."
            : "Result ready. Keep it here or promote it into the outline.",
        };
      }
    }
  }
  if (message._tag === "Stopped")
    thread = { ...thread, summary: "Paused. Send a new direction when you are ready." };
  if (message._tag === "Reset")
    thread = { ...thread, context: [], prompt: "", summary: "Ready when you are.", result: "" };
  return {
    ...result,
    model: { ...result.model, threads: { ...result.model.threads, [id]: thread } },
  };
};

const outlineMessage = (model: Model, message: Outliner.Message): Return => {
  let result = foldOutline(model, message);
  let next = result.model;
  if (message._tag === "FocusedText" || message._tag === "ClickedBullet")
    next = { ...next, selectedId: message.id };
  if (message._tag === "Hoisted" && message.id) next = { ...next, selectedId: message.id };

  const focus = next.outline.focus;
  if (focus && (message._tag === "EditedText" || message._tag === "AcceptedCompletion")) {
    const node = find(next.outline.items, focus.id);
    if (node && /(?:^|\s)(?:\/agent|#agent)\s*$/.test(node.text)) {
      const clean =
        node.text.replace(/(?:^|\s)(?:\/agent|#agent)\s*$/, "").trimEnd() || "Untitled thread";
      const replaced = foldOutline(
        next,
        Outliner.Message.Replace({
          items: updateItem(next.outline.items, node.id, (current) => ({
            ...current,
            text: clean,
          })),
          announcement: "Agent thread attached.",
        }),
      );
      result = {
        ...replaced,
        commands: [...(result.commands ?? []), ...(replaced.commands ?? [])],
      };
      next = attach(replaced.model, node.id);
    }
  }
  if (focus && (message._tag === "EditedText" || message._tag === "RequestedCompletion")) {
    const text = find(next.outline.items, focus.id)?.text ?? "";
    const { from, word } = Completion.wordBefore(text, focus.end, /\/[a-z]*$/u);
    if (word && (from === 0 || /\s/.test(text[from - 1]!))) {
      const offered = foldOutline(
        next,
        Outliner.Message.ShowCompletions({
          id: focus.id,
          from,
          to: focus.end,
          items: [{ label: "/agent", insert: "/agent ", detail: "Attach a thread to this bullet" }],
        }),
      );
      next = offered.model;
      result = { ...offered, commands: [...(result.commands ?? []), ...(offered.commands ?? [])] };
    }
  }
  // Retain orphaned attachments for outline undo, but stop their work immediately.
  for (const [id, thread] of Object.entries(next.threads)) {
    if (!find(next.outline.items, id) && Agent.isActive(thread.agent))
      next = {
        ...next,
        threads: {
          ...next.threads,
          [id]: {
            ...thread,
            agent: Agent.update(thread.agent, Agent.Message.Stopped()).model,
            summary: "Paused because its bullet was removed.",
          },
        },
      };
  }
  if (next.selectedId && !find(next.outline.items, next.selectedId))
    next = { ...next, selectedId: null };
  return { ...result, model: next };
};

const reduce = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    GotOutlineMessage: ({ message }) => outlineMessage(model, message),
    GotThreadMessage: ({ id, message }) => threadMessage(model, id, message),
    OpenedNode: ({ id }) => ({
      model: find(model.outline.items, id) ? { ...model, selectedId: id } : model,
    }),
    ClosedDetail: () => ({ model: { ...model, selectedId: null } }),
    AttachedThread: ({ id }) => ({ model: attach(model, id) }),
    AddedThread: () => {
      const parentId = model.outline.scopeId;
      const children = parentId
        ? (find(model.outline.items, parentId)?.children ?? [])
        : model.outline.items;
      const result = foldOutline(
        model,
        Outliner.Message.FilledPlaceholder({
          parentId,
          index: children.length,
          key: "thread",
          text: "Untitled thread",
          offset: 0,
        }),
      );
      const id = result.model.outline.focus?.id;
      return { ...result, model: id ? attach(result.model, id) : result.model };
    },
    StartedThread: ({ id }) => {
      const node = find(model.outline.items, id);
      if (!node || (model.threads[id] && Agent.isActive(model.threads[id]!.agent)))
        return { model };
      const attached = attach(model, id);
      const drafted = threadMessage(attached, id, Agent.Message.ChangedDraft({ value: node.text }));
      const submitted = threadMessage(drafted.model, id, Agent.Message.Submitted());
      return {
        ...submitted,
        commands: [...(drafted.commands ?? []), ...(submitted.commands ?? [])],
      };
    },
    AdvancedRuns: () => {
      let next = model;
      const commands: NonNullable<Return["commands"]>[number][] = [];
      for (const [id, thread] of Object.entries(model.threads)) {
        if (!find(model.outline.items, id)) continue;
        const envelope = nextEvent(thread);
        if (!envelope) continue;
        const result = threadMessage(next, id, Agent.Message.ReceivedStreamEvent({ envelope }));
        next = result.model;
        commands.push(...(result.commands ?? []));
      }
      return { model: next, commands };
    },
    ChangedDetailView: ({ value }) => ({ model: { ...model, detailView: value } }),
    GotDueDateMessage: ({ id, message }) => {
      if (!find(model.outline.items, id)) return { model };
      const fold = Update.foldChild({
        update: (date: DateInput.Model, child: DateInput.Message) =>
          DateInput.update(date, child, {
            value: DateInput.iso.parse(model.dates[id] ?? "") ?? null,
          }),
        read: (parent: Model) =>
          Option.some(parent.dateInputs[id] ?? dateInputFor(id, parent.dates[id])),
        write: (parent, date) => ({ ...parent, dateInputs: { ...parent.dateInputs, [id]: date } }),
        toParentMessage: (child) => Message.GotDueDateMessage({ id, message: child }),
        foldOutMessage:
          (out: DateInput.OutMessage) =>
          (parent: Model): Return => ({
            model: {
              ...parent,
              dates: { ...parent.dates, [id]: out.value ? DateInput.iso.format(out.value) : "" },
            },
          }),
      });
      return fold(model, message);
    },
    PromotedResult: ({ id }) => {
      const thread = model.threads[id];
      if (!thread?.result || !find(model.outline.items, id)) return { model };
      const resultId = `${id}-result`;
      if (find(model.outline.items, resultId)?.text === `Result: ${thread.result}`)
        return { model };
      const items = updateItem(model.outline.items, id, (node) => ({
        ...node,
        collapsed: false,
        children: find(node.children, resultId)
          ? updateItem(node.children, resultId, (child) => ({
              ...child,
              text: `Result: ${thread.result}`,
            }))
          : [...node.children, item(resultId, `Result: ${thread.result}`)],
      }));
      const result = foldOutline(
        model,
        Outliner.Message.Replace({
          items,
          announcement: "Result added to the outline. Undo to remove it.",
        }),
      );
      return {
        ...result,
        model: { ...result.model, announcement: "Result added to the outline. Undo to remove it." },
      };
    },
    ToggledFoldedViews: () => ({ model: { ...model, showFoldedViews: !model.showFoldedViews } }),
    CompletedSave: ({ succeeded }) => ({
      model: { ...model, saveState: succeeded ? "Saved" : "Error" },
    }),
  });

export const update = (model: Model, message: Message): Return => {
  const result = reduce(model, message);
  const next = result.model;
  return model.outline.items !== next.outline.items ||
    model.threads !== next.threads ||
    model.dates !== next.dates
    ? {
        ...result,
        commands: [...(result.commands ?? []), Save({ json: JSON.stringify(documentOf(next)) })],
      }
    : result;
};
