import { CodeEditor } from "@foldworks/code-editor";
import { Command } from "foldkit";
import { completeAt, sourceDiagnostics, sourceTokens } from "./adapter.js";
import { ParseSource } from "./commands.js";
import { Message } from "./message.js";
import type { Model } from "./model.js";
import type { UpdateReturn } from "./update.js";

/** Forward the surface's effects with their parent messages. */
export const sourceOperation = (model: Model, operation: CodeEditor.Operation): UpdateReturn => {
  const result = CodeEditor.update(model.source, CodeEditor.execute(operation));
  return {
    model: { ...model, source: result.model },
    commands: (result.commands ?? []).map((command) =>
      Command.mapMessage(command, (message) => Message.GotSourceMessage({ message })),
    ),
  };
};

export const sourceAnalysis = (model: Model): UpdateReturn => {
  const analysis = model.analysis;
  if (
    analysis === null ||
    model.sourceDirty ||
    model.source.document.text !== analysis.document.source
  )
    return { model };
  const version = CodeEditor.documentVersion(model.source.document);
  const tokens = sourceOperation(
    model,
    CodeEditor.Operation.SetSemanticTokens({ ...version, tokens: sourceTokens(analysis) }),
  );
  const diagnostics = sourceOperation(
    tokens.model,
    CodeEditor.Operation.SetDiagnostics({
      ...version,
      languageId: "lisp",
      source: "Forma",
      diagnostics: sourceDiagnostics(analysis),
    }),
  );
  return {
    ...diagnostics,
    commands: [...(tokens.commands ?? []), ...(diagnostics.commands ?? [])],
  };
};

export const editSource = (model: Model, message: CodeEditor.Message): UpdateReturn => {
  const child = CodeEditor.update(model.source, message);
  let next: Model = { ...model, source: child.model };
  const commands: Array<NonNullable<UpdateReturn["commands"]>[number]> = (child.commands ?? []).map(
    (command) => Command.mapMessage(command, (message) => Message.GotSourceMessage({ message })),
  );
  const event = child.outMessage;
  if (event?._tag === "ChangedDocument" && model.document !== null) {
    next = { ...next, sourceDirty: true, sourceError: null };
    commands.push(
      ParseSource({
        expected: CodeEditor.documentVersion(event.document),
        source: event.document.text,
        base: model.document,
      }),
    );
  }
  if (event?._tag === "RequestedCompletion" && model.analysis !== null) {
    const answer = completeAt(model.analysis, next.source.document.text, event.offset);
    const completed = sourceOperation(
      next,
      CodeEditor.Operation.ShowCompletions({ expected: event.version, ...answer }),
    );
    return { ...completed, commands: [...commands, ...(completed.commands ?? [])] };
  }
  return { model: next, commands };
};

export const setPane = (model: Model, pane: Model["pane"]): UpdateReturn => {
  if (pane === "outline" || model.sourceDirty || model.document === null)
    return { model: { ...model, pane } };
  const refreshed =
    model.source.document.text === model.document.source
      ? { model }
      : sourceOperation(
          model,
          CodeEditor.Operation.ReplaceDocument({
            uri: model.title,
            languageId: "lisp",
            text: model.document.source,
          }),
        );
  const painted = sourceAnalysis({ ...refreshed.model, pane });
  return { ...painted, commands: [...(refreshed.commands ?? []), ...(painted.commands ?? [])] };
};
