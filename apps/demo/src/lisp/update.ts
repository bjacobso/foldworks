import { Effect, Option, Schema as S } from "effect";
import { Command, Update } from "foldkit";
import { afterCommit } from "foldkit/render";
import { evo } from "foldkit/struct";
import { CodeEditor } from "@foldworks/code-editor";
import { Outliner, find, selectedRoots, type Items } from "@foldworks/outliner";
import { ValueTree } from "@foldworks/ui";

import { analyze } from "./analysis";
import { propose } from "./assistant";
import { completionsAt } from "./completion";
import { idSource, parseSource, printOutline } from "./codec";
import { Message, type Refactoring } from "./message";
import { SOURCE_URI, domIds, type Model } from "./model";
import { explode, join, raise, unwrap, wrap } from "./refactor";
import { OUTLINE_ID } from "./sample";
import {
  lineOf as sourceLineOf,
  sourceCompletions,
  sourceDiagnostics,
  sourceTokens,
} from "./source";
import { ReadError } from "./syntax";
import { PAGE, isStructured, valueNodes } from "./values";
import { outlinePolicy } from "./policy";

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

/** Folds an outliner message under the outline's rules: a read-only Library, and steps that stay in flows. */
const foldOutliner = (model: Model, message: Outliner.Message): UpdateReturn =>
  Update.foldChild({
    update: (outline: Outliner.Model, event: Outliner.Message) =>
      Outliner.update(outline, event, outlinePolicy(outline.items)),
    read: (parent: Model) => Option.some(parent.outline),
    write: (parent, outline) => evo(parent, { outline: () => outline }),
    toParentMessage: (event) => Message.GotOutlinerMessage({ message: event }),
  })(model, message);

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
    case "FilledPlaceholder": {
      // A row made from a slot suggests what fits there right away.
      const focus = outline.focus;
      return focus === null ? result : offer(focus.id, focus.end, true);
    }
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

const lineNumber = (text: string, offset: number): number =>
  text.slice(0, offset).split("\n").length;

/** Continues an update with an operation on the source editor, keeping the commands of both. */
const andThenSource = (result: UpdateReturn, operation: CodeEditor.Operation): UpdateReturn => {
  const next = foldSource(result.model, CodeEditor.execute(operation));
  return { model: next.model, commands: [...(result.commands ?? []), ...(next.commands ?? [])] };
};

/** The smallest edit that turns one text into another. */
const minimalEdit = (before: string, after: string) => {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start])
    start += 1;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end += 1;
  }
  return { from: start, to: before.length - end, insert: after.slice(start, after.length - end) };
};

/**
 * Explains a version of the source: its highlighting and its problems, from
 * the outline's analysis. Both are tagged with the version, so a late batch is
 * ignored.
 */
const annotate = (result: UpdateReturn, document: CodeEditor.Document): UpdateReturn => {
  const items = result.model.outline.items;
  const analysis = analyze(items);
  const version = { uri: document.uri, session: document.session, revision: document.revision };
  const painted = andThenSource(
    result,
    CodeEditor.Operation.SetSemanticTokens({
      ...version,
      tokens: sourceTokens(document.text, analysis),
    }),
  );
  return andThenSource(
    painted,
    CodeEditor.Operation.SetDiagnostics({
      ...version,
      languageId: document.languageId,
      source: "lisp",
      diagnostics: sourceDiagnostics(items, analysis, document.text),
    }),
  );
};

/** Reads edited source back into the outline as one coalesced undo step; text that does not read leaves it. */
const readSource = (model: Model, text: string): UpdateReturn => {
  try {
    const items = parseSource(text, model.outline.items, nextIds(model.outline.items));
    return foldOutliner(
      evo(model, { sourceError: () => null }),
      Outliner.Message.Replace({
        items,
        announcement: "Updated from source.",
        coalescingKey: "source",
      }),
    );
  } catch (error) {
    const message =
      error instanceof ReadError
        ? `${error.message} on line ${lineNumber(text, error.at)}`
        : String(error);
    return { model: evo(model, { sourceError: () => message }) };
  }
};

const sourceEvent = (model: Model, event: CodeEditor.OutMessage): UpdateReturn => {
  switch (event._tag) {
    case "ChangedDocument": {
      const typed = event.origin !== "external";
      const read = typed ? readSource(model, event.document.text) : { model };
      const annotated = annotate(read, event.document);
      // Typing a name suggests what it could be.
      const caret = annotated.model.source.selection.head;
      const before = event.document.text[caret - 1];
      return event.origin === "input" &&
        annotated.model.source.completion === null &&
        before !== undefined &&
        SYMBOL_CHARACTER.test(before)
        ? offerSource(annotated, caret, false)
        : annotated;
    }
    case "RequestedCompletion":
      return offerSource({ model }, event.offset, true);
    default:
      return { model };
  }
};

const offerSource = (result: UpdateReturn, caret: number, invoked: boolean): UpdateReturn => {
  const { source, outline } = result.model;
  const offer = sourceCompletions(
    outline.items,
    analyze(outline.items),
    source.document.text,
    caret,
    invoked,
  );
  return offer === undefined
    ? result
    : andThenSource(
        result,
        CodeEditor.Operation.ShowCompletions({
          expected: CodeEditor.documentVersion(source.document),
          ...offer,
        }),
      );
};

const foldSource = Update.foldChild({
  update: CodeEditor.update,
  read: (model: Model) => Option.some(model.source),
  write: (model, source) => evo(model, { source: () => source }),
  toParentMessage: (message) => Message.GotSourceMessage({ message }),
  foldOutMessage: (event: CodeEditor.OutMessage) => (model: Model) => sourceEvent(model, event),
});

/**
 * Keeps the source pane on the printed outline after the outline changes,
 * and shows the line for the row with the caret.
 */
const syncSource = (before: Model, result: UpdateReturn): UpdateReturn => {
  const model = result.model;
  if (!model.showSource) return result;
  const printed = printOutline(model.outline.items);
  const text = model.source.document.text;
  const changed = model.outline.items !== before.outline.items && text !== printed.text;
  const synced = changed
    ? andThenSource(
        result,
        CodeEditor.Operation.ApplyEdits({
          expected: CodeEditor.documentVersion(model.source.document),
          edits: [minimalEdit(text, printed.text)],
        }),
      )
    : result;
  const focusId = targetsOf(model.outline).focusId;
  const line = focusId === null ? undefined : sourceLineOf(model.outline.items, printed, focusId);
  return focusId !== targetsOf(before.outline).focusId && line !== undefined && !changed
    ? andThenSource(
        synced,
        CodeEditor.Operation.Reveal({
          expected: CodeEditor.documentVersion(synced.model.source.document),
          range: line,
        }),
      )
    : synced;
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

/** The value tree for the row with the caret, when its value has parts. */
export const inspectedNodes = (model: Model): ReadonlyArray<ValueTree.ValueNode> => {
  const { focusId } = targetsOf(model.outline);
  const observed =
    focusId === null ? undefined : analyze(model.outline.items).evaluation.values.get(focusId);
  return observed === undefined || !isStructured(observed.value)
    ? []
    : valueNodes(observed.value, model.loaded);
};

/** Expanding a branch loads its first page of children; “more” loads the next. */
const foldValues = (model: Model, message: ValueTree.Message): UpdateReturn =>
  Update.foldChild({
    update: (values: ValueTree.Model, event: ValueTree.Message) =>
      ValueTree.update(values, event, { nodes: inspectedNodes(model) }),
    read: (parent: Model) => Option.some(parent.values),
    write: (parent, values) => evo(parent, { values: () => values }),
    toParentMessage: (event) => Message.GotValueMessage({ message: event }),
    foldOutMessage:
      (event: ValueTree.OutMessage) =>
      (parent: Model): UpdateReturn => ({
        model: evo(parent, {
          loaded: (loaded) => ({
            ...loaded,
            [event.id]: (event._tag === "RequestedMore" ? (loaded[event.id] ?? 0) : 0) + PAGE,
          }),
        }),
      }),
  })(model, message);

/** A different row starts the inspector's value tree afresh. */
const followInspector = (before: Model, result: UpdateReturn): UpdateReturn =>
  targetsOf(before.outline).focusId === targetsOf(result.model.outline).focusId
    ? result
    : {
        ...result,
        model: evo(result.model, {
          values: () => ValueTree.init({ id: domIds.value }),
          loaded: () => ({}),
        }),
      };

export const update = (model: Model, message: Message): UpdateReturn =>
  followInspector(
    model,
    message._tag === "GotSourceMessage"
      ? foldSource(model, message.message)
      : syncSource(model, updateWorkbench(model, message)),
  );

const updateWorkbench = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    GotOutlinerMessage: ({ message: childMessage }) =>
      suggest(foldOutliner(model, childMessage), model, childMessage),
    ToggledSource: () => {
      const toggled = evo(model, { showSource: (value) => !value, sourceError: () => null });
      // Opening the pane starts it on the printed outline, with its own history.
      return toggled.showSource
        ? foldSource(
            toggled,
            CodeEditor.execute(
              CodeEditor.Operation.ReplaceDocument({
                uri: SOURCE_URI,
                languageId: "lisp",
                text: printOutline(model.outline.items).text,
              }),
            ),
          )
        : { model: toggled };
    },
    ChoseNotation: ({ notation }) => ({ model: evo(model, { notation: () => notation }) }),
    GotSourceMessage: ({ message: childMessage }) => foldSource(model, childMessage),
    GotValueMessage: ({ message: childMessage }) => foldValues(model, childMessage),
    BlurredSource: () => {
      // Leaving a draft that reads prints it again in the outline's layout.
      const printed = printOutline(model.outline.items).text;
      const text = model.source.document.text;
      return model.sourceError !== null || text === printed
        ? { model }
        : andThenSource(
            { model },
            CodeEditor.Operation.ApplyEdits({
              expected: CodeEditor.documentVersion(model.source.document),
              edits: [minimalEdit(text, printed)],
            }),
          );
    },
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
