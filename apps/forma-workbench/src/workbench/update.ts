import { Option } from "effect";
import { AskProposer } from "./propose-command.js";
import { BeginRun, ResumeRun, AbortRun } from "./run-commands.js";
import { selectedRoots } from "@foldworks/outliner";
import { refactoring, type Proposal } from "./edits.js";
import { PrepareEdit } from "./edit-commands.js";
import { CodeEditor } from "@foldworks/code-editor";
import { editSource, setPane, sourceAnalysis, sourceOperation } from "./source-update.js";
import { Command, Update } from "foldkit";
import { modifyFields } from "foldkit/struct";
import { Outliner, type Policy } from "@foldworks/outliner";

import { ValueTree } from "@foldworks/ui";
import { rowContaining } from "./rows.js";
import { completeAt, sourceOffsetAtRow } from "./adapter.js";
import { find } from "@foldworks/outliner";
import { valueRoot } from "./values.js";
import { AnalyzeProgram, ScheduleAnalysis, LoadValue, ReleaseAnalysis } from "./commands.js";
import { fromRows, toRows, sameRows } from "./document.js";
import type { Analysis } from "./analysis.js";
import type { FormaHost } from "./host.js";
import { Message } from "./message.js";
import type { Model } from "./model.js";

export type UpdateReturn = Update.Return<Model, Message, FormaHost>;

/** The resolved symbol under the caret, shared by the button and F12. */
export const definitionAtCaret = (model: Model): string | undefined => {
  const analysis = model.analysis;
  if (!analysis || model.sourceDirty || analysis.revision !== model.outline.revision)
    return undefined;
  if (model.pane === "source") {
    const offset = model.source.selection.head;
    const node = analysis.document.identity.nodes.find(
      (node) => node.kind === "Symbol" && node.span.start <= offset && offset <= node.span.end,
    );
    return node ? analysis.symbols[node.id]?.definition : undefined;
  }
  const focus = model.outline.focus;
  const row = analysis.rows.find((row) => row.id === focus?.id);
  const node = row?.nodes.find(
    (node) =>
      node.kind === "Symbol" && node.from <= (focus?.start ?? 0) && (focus?.start ?? 0) <= node.to,
  );
  return node ? analysis.symbols[node.nodeId]?.definition : undefined;
};

/** The outline's rules. */
export const policy: Policy = {};

const foldOutliner = (model: Model, message: Outliner.Message): UpdateReturn =>
  Update.foldChild({
    update: (outline: Outliner.Model, event: Outliner.Message) =>
      Outliner.update(outline, event, policy),
    read: (parent: Model) => Option.some(parent.outline),
    write: (parent: Model, outline: Outliner.Model) =>
      modifyFields(parent, { outline: () => outline }),
    toParentMessage: (event: Outliner.Message) => Message.GotOutlinerMessage({ message: event }),
  })(model, message);

/** Analyzes the outline's current revision now. */
const analyze = (model: Model): UpdateReturn => ({
  model,
  commands: [
    AnalyzeProgram({
      revision: model.outline.revision,
      rows: toRows(model.outline.items),
      base: model.document,
    }),
  ],
});

/** After the outline changes, analyzes it once typing pauses. */
const followOutline = (before: Model, result: UpdateReturn): UpdateReturn => {
  if (result.model.outline.revision === before.outline.revision || result.model.document === null)
    return result;
  const rows = toRows(result.model.outline.items);
  const known = before.documents.find((entry) => sameRows(entry.rows, rows));
  const document =
    known === undefined
      ? result.model.document
      : { ...known.document, revision: result.model.outline.revision };
  const model = {
    ...result.model,
    document,
    proposal: null,
    editBusy: false,
    editToken: result.model.editToken + 1,
  };
  return {
    ...result,
    model,
    commands: [
      ...(result.commands ?? []),
      ...(before.proposal?.analysis.valueSession == null
        ? []
        : [ReleaseAnalysis({ sessionId: before.proposal.analysis.valueSession })]),
      ScheduleAnalysis({ revision: model.outline.revision }),
    ],
  };
};

/** Keeps the newest analysis, and its document as the base for the next printing. */
const received = (model: Model, analysis: Analysis): UpdateReturn => {
  if (analysis.revision !== model.outline.revision)
    return {
      model,
      commands:
        analysis.valueSession === null
          ? []
          : [ReleaseAnalysis({ sessionId: analysis.valueSession })],
    };
  const value = model.inspector === null ? null : analysis.values[model.inspector]?.value;
  const refreshed: Model = {
    ...model,
    analysis,
    document: analysis.document,
    failure: null,
    documents: [
      { rows: toRows(model.outline.items), document: analysis.document },
      ...model.documents.filter((entry) => !sameRows(entry.rows, toRows(model.outline.items))),
    ],
    valueNodes: value == null ? [] : [valueRoot(value)],
    valueTree: ValueTree.init({ id: model.valueTree.id }),
  };
  const painted = sourceAnalysis(refreshed);
  return {
    ...painted,
    model: {
      ...painted.model,
      analysis,
      document: analysis.document,
      failure: null,
      valueNodes: value == null ? [] : [valueRoot(value)],
      valueTree: ValueTree.init({ id: model.valueTree.id }),
    },
    commands: [
      ...(painted.commands ?? []),
      ...(model.analysis?.valueSession == null
        ? []
        : [ReleaseAnalysis({ sessionId: model.analysis.valueSession })]),
    ],
  };
};

const applyProposal = (model: Model, proposal: Proposal): UpdateReturn => {
  const changed = foldOutliner(
    model,
    Outliner.Message.Replace({
      items: fromRows(proposal.rows, model.outline.items),
      announcement: proposal.title,
    }),
  );
  const revision = changed.model.outline.revision;
  const adopted = received(
    { ...changed.model, proposal: null, editBusy: false, editToken: model.editToken + 1 },
    {
      ...proposal.analysis,
      revision,
      document: { ...proposal.analysis.document, revision },
    },
  );
  return { ...adopted, commands: [...(changed.commands ?? []), ...(adopted.commands ?? [])] };
};

const updateModel = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    SetPrompt: ({ value }) => ({ model: { ...model, prompt: value } }),
    AskAssistant: () => {
      if (
        model.analysis === null ||
        model.analysis.revision !== model.outline.revision ||
        model.editBusy ||
        model.sourceDirty ||
        model.prompt.trim().length === 0
      )
        return { model };
      const token = model.editToken + 1;
      return {
        model: {
          ...model,
          editToken: token,
          editBusy: true,
          assistantReply: null,
          failure: null,
          proposal: null,
        },
        commands: [
          ...(model.proposal?.analysis.valueSession == null
            ? []
            : [ReleaseAnalysis({ sessionId: model.proposal.analysis.valueSession })]),
          AskProposer({
            basis: model.analysis,
            token,
            prompt: model.prompt,
            selectedIds: selectedRoots(model.outline),
            focusId: model.outline.focus?.id ?? null,
          }),
        ],
      };
    },
    AssistantReply: ({ token, proposer, text }) => ({
      model:
        token !== model.editToken
          ? model
          : { ...model, editBusy: false, assistantName: proposer, assistantReply: text },
    }),
    Run: () => {
      if (
        model.analysis === null ||
        model.analysis.revision !== model.outline.revision ||
        model.runBusy ||
        model.run?.status === "pending" ||
        model.sourceDirty ||
        model.analysis.diagnostics.some(
          (diagnostic) => diagnostic.severity === "error" && diagnostic.phase !== "evaluate",
        ) ||
        model.analysis.brokenRows.length > 0
      )
        return { model };
      const token = model.runToken + 1;
      return {
        model: { ...model, runToken: token, runBusy: true, run: null, failure: null },
        commands: [BeginRun({ basis: model.analysis, token })],
      };
    },
    DecideCapability: ({ allow }) =>
      model.run?.status !== "pending" || model.runBusy || model.analysis === null
        ? { model }
        : {
            model: { ...model, runBusy: true },
            commands: [ResumeRun({ run: model.run, basis: model.analysis, allow })],
          },
    Ran: ({ outcome }) => {
      if (
        outcome.token !== model.runToken ||
        outcome.basis !== model.outline.revision ||
        model.sourceDirty
      )
        return { model, commands: [AbortRun({ run: outcome })] };
      const next = { ...model, run: outcome, runBusy: false };
      if (outcome.status === "pending" || model.analysis === null) return { model: next };
      return received(next, {
        ...model.analysis,
        valueSession: outcome.sessionId,
        values: {
          ...Object.fromEntries(
            Object.entries(model.analysis.values).filter(
              ([, value]) => value.origin === "elaboration",
            ),
          ),
          ...outcome.values,
        },
        diagnostics: [
          ...model.analysis.diagnostics.filter((diagnostic) => diagnostic.phase !== "evaluate"),
          ...outcome.diagnostics,
        ],
      });
    },
    FailedRun: ({ token, reason }) =>
      token !== model.runToken
        ? { model }
        : {
            model: { ...model, run: null, runBusy: false, failure: reason },
            commands: model.run?.status !== "pending" ? [] : [AbortRun({ run: model.run })],
          },
    EditArgument: ({ value }) => ({ model: { ...model, editArgument: value } }),
    Refactor: ({ action }) => {
      if (
        model.analysis === null ||
        model.analysis.revision !== model.outline.revision ||
        model.sourceDirty ||
        model.editBusy
      )
        return { model };
      const selected = selectedRoots(model.outline);
      let targets =
        selected.length > 0
          ? selected
          : model.outline.focus === null
            ? []
            : [model.outline.focus.id];
      if (action === "rename" && targets.length === 1) {
        const definition = model.analysis.definitions.find(
          (definition) => definition.formNodeId === targets[0] && definition.scope === "global",
        );
        const layout = model.analysis.rows.find((row) => row.id === targets[0]);
        const at = model.outline.focus?.start ?? 0;
        const symbol = layout?.nodes.find(
          (node) =>
            node.kind === "Symbol" &&
            node.from <= at &&
            at < node.to &&
            model.analysis!.symbols[node.nodeId]?.definition !== undefined,
        );
        targets = [definition?.nodeId ?? symbol?.nodeId ?? targets[0]!];
      }
      try {
        const script = refactoring(action, targets, model.editArgument);
        const token = model.editToken + 1;
        return {
          model: { ...model, editToken: token, editBusy: true, failure: null, proposal: null },
          commands: [
            ...(model.proposal?.analysis.valueSession == null
              ? []
              : [ReleaseAnalysis({ sessionId: model.proposal.analysis.valueSession })]),
            PrepareEdit({
              basis: model.analysis,
              script,
              title: `${action[0]!.toUpperCase()}${action.slice(1)}`,
              proposer: "Refactoring",
              token,
              direct: true,
            }),
          ],
        };
      } catch (error) {
        return { model: { ...model, failure: String(error) } };
      }
    },
    PreparedEdit: ({ proposal, direct }) => {
      if (
        proposal.token !== model.editToken ||
        proposal.basis !== model.outline.revision ||
        model.sourceDirty
      )
        return {
          model,
          commands:
            proposal.analysis.valueSession === null
              ? []
              : [ReleaseAnalysis({ sessionId: proposal.analysis.valueSession })],
        };
      return direct
        ? applyProposal(model, proposal)
        : { model: { ...model, proposal, assistantName: proposal.proposer, editBusy: false } };
    },
    FailedEdit: ({ token, reason }) => ({
      model: token !== model.editToken ? model : { ...model, failure: reason, editBusy: false },
    }),
    AcceptProposal: () =>
      model.proposal === null ||
      model.proposal.basis !== model.outline.revision ||
      model.sourceDirty
        ? { model }
        : applyProposal(model, model.proposal),
    DiscardProposal: () => ({
      model: { ...model, proposal: null, editToken: model.editToken + 1, editBusy: false },
      commands:
        model.proposal?.analysis.valueSession == null
          ? []
          : [ReleaseAnalysis({ sessionId: model.proposal.analysis.valueSession })],
    }),
    SetPane: ({ pane }) => setPane(model, pane),
    GotSourceMessage: ({ message }) => editSource(model, message),
    ReadSource: ({ expected, document, rows, errors }) => {
      const current = CodeEditor.documentVersion(model.source.document);
      if (expected.session !== current.session || expected.revision !== current.revision)
        return { model };
      if (errors.length > 0) {
        const marked = sourceOperation(
          model,
          CodeEditor.Operation.SetDiagnostics({
            ...current,
            languageId: "lisp",
            source: "Forma",
            diagnostics: errors,
          }),
        );
        return { ...marked, model: { ...marked.model, sourceError: errors[0]!.message } };
      }
      const replaced = foldOutliner(
        model,
        Outliner.Message.Replace({
          items: fromRows(rows, model.outline.items),
          announcement: "Read source edits.",
          coalescingKey: `source-${current.session}`,
        }),
      );
      return analyze({
        ...replaced.model,
        sourceDirty: false,
        sourceError: null,
        document: { ...document, revision: replaced.model.outline.revision },
      });
    },
    SetNotation: ({ notation }) => ({ model: { ...model, notation } }),
    CloseInspector: () => ({ model: { ...model, inspector: null, valueNodes: [] } }),
    Inspect: ({ id }) => {
      const value = model.analysis?.values[id]?.value;
      return {
        model: {
          ...model,
          inspector: id,
          valueTree: ValueTree.init({ id: model.valueTree.id }),
          valueNodes: value == null ? [] : [valueRoot(value)],
        },
      };
    },
    GotValueMessage: ({ message }) => {
      const child = ValueTree.update(model.valueTree, message, { nodes: model.valueNodes });
      return {
        model: { ...model, valueTree: child.model },
        commands: [
          ...(child.commands ?? []).map((command) =>
            Command.mapMessage(command, (event) => Message.GotValueMessage({ message: event })),
          ),
          ...(child.outMessage === undefined || model.analysis?.valueSession == null
            ? []
            : [LoadValue({ sessionId: model.analysis.valueSession, id: child.outMessage.id })]),
        ],
      };
    },
    LoadedValue: ({ sessionId, id, nodes }) => ({
      model:
        sessionId !== model.analysis?.valueSession
          ? model
          : {
              ...model,
              valueNodes: model.valueNodes.map((node) =>
                node.id === id ? { ...node, children: nodes, expandable: false } : node,
              ),
            },
    }),
    FailedValue: ({ sessionId, reason }) => ({
      model: sessionId !== model.analysis?.valueSession ? model : { ...model, failure: reason },
    }),
    DefinitionAtCaret: () => {
      const key = definitionAtCaret(model);
      return key === undefined ? { model } : updateModel(model, Message.GoToDefinition({ key }));
    },
    GoToDefinition: ({ key }) => {
      const definition = model.analysis?.definitions.find((definition) => definition.key === key);
      return definition?.nodeId == null
        ? { model }
        : updateModel(model, Message.RevealNode({ id: definition.nodeId }));
    },
    RevealNode: ({ id }) => {
      const node = model.analysis?.document.identity.nodes.find((node) => node.id === id);
      if (node === undefined || model.analysis === null) return { model };
      if (model.pane === "source")
        return sourceOperation(
          model,
          CodeEditor.Operation.Reveal({
            expected: CodeEditor.documentVersion(model.source.document),
            range: { from: node.span.start, to: node.span.end },
          }),
        );
      const row = rowContaining(
        new Map(model.analysis.rows.map((row) => [row.id, row])),
        node.span.start,
        node.span.end,
      );
      return row === undefined
        ? { model }
        : foldOutliner(model, Outliner.Message.Reveal({ id: row.id }));
    },
    ReleasedAnalysis: () => ({ model }),
    GotOutlinerMessage: ({ message: event }) => {
      if (
        event._tag === "FilledPlaceholder" &&
        event.parentId !== null &&
        model.analysis !== null
      ) {
        const slot = model.analysis.slots[event.parentId]?.find((slot) => slot.key === event.key);
        const parent = find(model.outline.items, event.parentId);
        if (slot?.inline && parent !== undefined) {
          const header = `${parent.text.trimEnd()} ${event.text}`;
          const replace = (rows: ReturnType<typeof toRows>): ReturnType<typeof toRows> =>
            rows.map((row) => ({
              ...row,
              text: row.id === parent.id ? header : row.text,
              children: replace(row.children),
            }));
          const changed = foldOutliner(
            model,
            Outliner.Message.Replace({
              items: fromRows(replace(toRows(model.outline.items)), model.outline.items),
              announcement: `Added ${slot.label}.`,
            }),
          );
          const focused = foldOutliner(changed.model, Outliner.Message.Reveal({ id: parent.id }));
          return followOutline(model, {
            ...focused,
            commands: [...(changed.commands ?? []), ...(focused.commands ?? [])],
          });
        }
      }
      if (event._tag === "RequestedCompletion" && model.analysis !== null) {
        const row = find(model.outline.items, event.id);
        const layout = model.analysis.rows.find((layout) => layout.id === event.id);
        if (row !== undefined && layout !== undefined && layout.text === row.text) {
          const answer = completeAt(
            model.analysis,
            row.text,
            event.start,
            sourceOffsetAtRow(layout, event.start),
          );
          return foldOutliner(model, Outliner.Message.ShowCompletions({ id: event.id, ...answer }));
        }
      }
      return followOutline(model, foldOutliner(model, event));
    },
    LoadedProgram: ({ document, rows }) => {
      const loaded = foldOutliner(
        modifyFields(model, { failure: () => null }),
        Outliner.Message.Load({ items: fromRows(rows) }),
      );
      // The document describes the outline's current revision.
      return analyze(
        modifyFields(loaded.model, {
          document: () => ({ ...document, revision: loaded.model.outline.revision }),
        }),
      );
    },
    FailedProgram: ({ reason }) => ({ model: modifyFields(model, { failure: () => reason }) }),
    // Only the latest revision is analyzed; earlier requests were overtaken by typing.
    AnalysisDue: ({ revision }) =>
      revision === model.outline.revision ? analyze(model) : { model },
    Analyzed: ({ analysis }) => received(model, analysis),
    FailedAnalysis: ({ revision, reason }) =>
      revision === model.outline.revision
        ? { model: modifyFields(model, { failure: () => reason }) }
        : { model },
  });

/** Every editing route cancels a paused run and rejects subsequent replies for it. */
export const update = (model: Model, message: Message): UpdateReturn => {
  const result = updateModel(model, message);
  if (
    result.model.outline.revision === model.outline.revision &&
    !(result.model.sourceDirty && result.model.source.document !== model.source.document)
  )
    return result;
  const changedSource =
    result.model.sourceDirty && result.model.source.document !== model.source.document;
  return {
    ...result,
    model: {
      ...result.model,
      run: null,
      runBusy: false,
      runToken: model.runToken + 1,
      ...(changedSource ? { proposal: null, editBusy: false, editToken: model.editToken + 1 } : {}),
    },
    commands: [
      ...(result.commands ?? []),
      ...(model.run?.status !== "pending" ? [] : [AbortRun({ run: model.run })]),
      ...(changedSource && model.proposal?.analysis.valueSession != null
        ? [ReleaseAnalysis({ sessionId: model.proposal.analysis.valueSession })]
        : []),
    ],
  };
};
