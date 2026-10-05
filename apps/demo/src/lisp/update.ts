import { Effect, Option, Schema as S } from "effect";
import { Command, Update } from "foldkit";
import { afterCommit } from "foldkit/render";
import { evo } from "foldkit/struct";
import { Outliner, find, selectedRoots, type Items } from "@foldworks/outliner";

import { analyze } from "./analysis";
import { propose } from "./assistant";
import { completionsAt } from "./completion";
import { idSource, parseSource } from "./codec";
import { Message, type Refactoring } from "./message";
import { domIds, type Model } from "./model";
import { explode, join, raise, unwrap, wrap } from "./refactor";
import { OUTLINE_ID } from "./sample";
import { ReadError } from "./syntax";

type UpdateReturn = Update.Return<Model, Message>;

/** Focuses an element. A text input gets its text selected, or the caret at its end. */
const FocusElement = Command.define("FocusLispElement", {
  args: { id: S.String, caret: S.Literals(["SelectAll", "End"]) },
  messages: [Message.CompletedFocus],
  execute: ({ id, caret }) =>
    Effect.gen(function* () {
      yield* afterCommit;
      const element = document.getElementById(id);
      element?.focus();
      if (element instanceof HTMLInputElement) {
        if (caret === "SelectAll") element.select();
        else element.setSelectionRange(element.value.length, element.value.length);
      }
      return Message.CompletedFocus();
    }),
});

const foldOutliner = Update.foldChild({
  update: Outliner.update,
  read: (model: Model) => Option.some(model.outline),
  write: (model, outline) => evo(model, { outline: () => outline }),
  toParentMessage: (message) => Message.GotOutlinerMessage({ message }),
});

/** The rows a structural action applies to: the row selection, or the row with the caret. */
export const targetsOf = (
  outline: Outliner.Model,
): Readonly<{ selection: ReadonlyArray<string>; focusId: string | null }> => ({
  selection: outline.mode === "Rows" ? selectedRoots(outline) : [],
  focusId: outline.focus?.id ?? outline.selection?.headId ?? null,
});

const nextIds = (items: Items) => idSource(OUTLINE_ID, items);

/** Continues an update with another outliner message, keeping the commands of both. */
const andThen = (result: UpdateReturn, message: Outliner.Message): UpdateReturn => {
  const next = foldOutliner(result.model, message);
  return { model: next.model, commands: [...(result.commands ?? []), ...(next.commands ?? [])] };
};

const SYMBOL_CHARACTER = /[^\s()[\]{}";',]/u;

/**
 * Answers the outliner's request for suggestions, and offers them unasked once
 * a word is being typed. The analysis is in-process, so the answer is part of
 * the same update.
 */
const suggest = (result: UpdateReturn, before: Model, message: Outliner.Message): UpdateReturn => {
  const outline = result.model.outline;
  const offer = (id: string, caret: number, invoked: boolean): UpdateReturn => {
    const found = completionsAt(outline.items, analyze(outline.items), id, caret, invoked);
    return found === undefined
      ? result
      : andThen(result, Outliner.Message.ShowCompletions({ id, ...found }));
  };
  switch (message._tag) {
    case "RequestedCompletion":
      return offer(message.id, message.end, true);
    case "EditedText": {
      if (outline.completion !== null || message.start !== message.end) return result;
      const previous = find(before.outline.items, message.id)?.text ?? "";
      const typed =
        message.text.length === previous.length + 1 ? message.text[message.end - 1] : "";
      return typed !== undefined && SYMBOL_CHARACTER.test(typed)
        ? offer(message.id, message.end, false)
        : result;
    }
    default:
      return result;
  }
};

const replace = (model: Model, items: Items, announcement: string): UpdateReturn =>
  foldOutliner(model, Outliner.Message.Replace({ items, announcement }));

const refactor = (model: Model, refactoring: Refactoring, head: string): UpdateReturn => {
  const items = model.outline.items;
  const { selection, focusId } = targetsOf(model.outline);
  const targets = selection.length > 0 ? selection : focusId === null ? [] : [focusId];
  const nextId = nextIds(items);
  const result: Items | undefined =
    refactoring === "Wrap"
      ? wrap(items, targets, head, nextId)?.items
      : focusId === null
        ? undefined
        : refactoring === "Unwrap"
          ? unwrap(items, focusId)
          : refactoring === "Raise"
            ? raise(items, focusId)
            : refactoring === "Join"
              ? join(items, focusId)
              : explode(items, focusId, nextId);
  if (result === undefined) return { model };
  const announcement =
    refactoring === "Wrap"
      ? `Wrapped in ${head}.`
      : refactoring === "Unwrap"
        ? "Unwrapped."
        : refactoring === "Raise"
          ? "Raised over its parent."
          : refactoring === "Join"
            ? "Joined onto one line."
            : "Broke onto rows.";
  return replace(model, result, announcement);
};

const lineOf = (text: string, offset: number): number => text.slice(0, offset).split("\n").length;

const editSource = (model: Model, text: string): UpdateReturn => {
  const drafted = evo(model, { sourceDraft: () => text });
  try {
    const items = parseSource(text, model.outline.items, nextIds(model.outline.items));
    const next = foldOutliner(
      evo(drafted, { sourceError: () => null }),
      Outliner.Message.Replace({
        items,
        announcement: "Updated from source.",
        coalescingKey: "source",
      }),
    );
    return next;
  } catch (error) {
    const message =
      error instanceof ReadError
        ? `${error.message} on line ${lineOf(text, error.at)}`
        : String(error);
    return { model: evo(drafted, { sourceError: () => message }) };
  }
};

const ask = (model: Model, prompt: string): UpdateReturn => {
  const trimmed = prompt.trim();
  if (trimmed === "") return { model };
  const { selection, focusId } = targetsOf(model.outline);
  const answer = propose(trimmed, {
    items: model.outline.items,
    selection,
    focusId,
    nextId: nextIds(model.outline.items),
  });
  if (answer._tag === "Reply") {
    return {
      model: evo(model, {
        prompt: () => trimmed,
        reply: () => answer.reply,
        proposal: () => null,
      }),
    };
  }
  return {
    model: evo(model, {
      prompt: () => trimmed,
      proposal: () => answer.proposal,
      reply: () => null,
    }),
    commands: [FocusElement({ id: domIds.accept, caret: "End" })],
  };
};

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    GotOutlinerMessage: ({ message: childMessage }) =>
      suggest(foldOutliner(model, childMessage), model, childMessage),
    ToggledSource: () => ({
      model: evo(model, {
        showSource: (value) => !value,
        sourceDraft: () => null,
        sourceError: () => null,
      }),
    }),
    ChoseNotation: ({ notation }) => ({ model: evo(model, { notation: () => notation }) }),
    EditedSource: ({ text }) => editSource(model, text),
    BlurredSource: () => ({
      model: model.sourceError === null ? evo(model, { sourceDraft: () => null }) : model,
    }),
    ChangedPrompt: ({ text }) => ({ model: evo(model, { prompt: () => text }) }),
    SubmittedPrompt: () => ask(model, model.prompt),
    ChoseSuggestion: ({ prompt }) => ask(model, prompt),
    PrefilledPrompt: ({ text }) => ({
      model: evo(model, { prompt: () => text, proposal: () => null, reply: () => null }),
      commands: [FocusElement({ id: domIds.prompt, caret: "End" })],
    }),
    AcceptedProposal: () => {
      const proposal = model.proposal;
      if (proposal === null) return { model };
      const cleared = evo(model, { proposal: () => null, prompt: () => "" });
      const replaced = replace(cleared, proposal.items, proposal.title);
      // The Accept button goes away, so focus returns to the outline.
      const focusId = proposal.focusId ?? targetsOf(replaced.model.outline).focusId;
      if (focusId === null) {
        return {
          model: replaced.model,
          commands: [
            ...(replaced.commands ?? []),
            FocusElement({ id: domIds.prompt, caret: "End" }),
          ],
        };
      }
      const revealed = foldOutliner(replaced.model, Outliner.Message.Reveal({ id: focusId }));
      return {
        model: revealed.model,
        commands: [...(replaced.commands ?? []), ...(revealed.commands ?? [])],
      };
    },
    DiscardedProposal: () => ({
      model: evo(model, { proposal: () => null }),
      commands: [FocusElement({ id: domIds.prompt, caret: "SelectAll" })],
    }),
    DismissedReply: () => ({ model: evo(model, { reply: () => null }) }),
    Refactored: ({ refactoring, head }) => refactor(model, refactoring, head),
    ClickedReference: ({ id }) => foldOutliner(model, Outliner.Message.Reveal({ id })),
    PressedShortcut: ({ shortcut }) =>
      shortcut === "ToggleSource"
        ? update(model, Message.ToggledSource())
        : { model, commands: [FocusElement({ id: domIds.prompt, caret: "SelectAll" })] },
    CompletedFocus: () => ({ model }),
  });
