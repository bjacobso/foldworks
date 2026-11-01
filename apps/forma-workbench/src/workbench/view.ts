import type { Html, HtmlBuilder } from "foldkit/html";
import { Agent } from "@foldworks/agent";
import { CodeEditor } from "@foldworks/code-editor";
import { ChangeSetPreview, TreeDiff, ValueTree } from "@foldworks/ui";
import { preview } from "./values.js";
import { defineView } from "foldkit/submodel";
import { Outliner, walk, type RowDecoration } from "@foldworks/outliner";

import { brackets } from "./notation.js";
import { hoverContent } from "./intelligence-view.js";
import { summary, viewOf, hoverFact, sourceOffsetAtRow } from "./adapter.js";
import { lexicalTokens, spansOf } from "./decorations.js";
import { Message } from "./message.js";
import type { Model } from "./model.js";
import { policy } from "./update.js";
import { Option } from "effect";

const diffNodes = (
  rows: ReadonlyArray<import("@formalang/host/types").OutlineItem>,
): ReadonlyArray<import("@foldworks/ui").TreeDiffNode> =>
  rows.map((row) => ({ id: row.id, label: row.text, children: diffNodes(row.children) }));

const outlineMessage = (message: Outliner.Message): Message =>
  Message.GotOutlinerMessage({ message });

/**
 * Each row's highlighting and problems. A row shows the analysis while its
 * text is the text that was analyzed, and its syntax alone otherwise.
 */
const decorations = (model: Model): Readonly<Record<string, RowDecoration>> => {
  const rows = model.analysis === null ? undefined : viewOf(model.analysis).rows;
  const result: Record<string, RowDecoration> = {};
  for (const node of walk(model.outline.items)) {
    const row = rows?.get(node.id);
    result[node.id] =
      row === undefined || row.layout.text !== node.text
        ? { spans: spansOf(node.text, lexicalTokens(node.text)) }
        : {
            spans: spansOf(node.text, row.tokens),
            ...(row.diagnostics.length === 0 ? {} : { diagnostics: row.diagnostics }),
            ...(row.tone === undefined ? {} : { tone: row.tone }),
          };
  }
  if (model.notation === "Brackets") {
    const markers = brackets(model.outline.items, {
      scopeId: model.outline.scopeId,
      focusId: model.outline.focus?.id ?? null,
    });
    for (const [id, decoration] of markers) result[id] = { ...result[id], ...decoration };
  }
  return result;
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

const stats = (model: Model): string => {
  if (model.sourceDirty)
    return model.sourceError === null ? "Reading source…" : "Source has parse errors";
  if (model.analysis === null || model.analysis.revision !== model.outline.revision)
    return model.document === null ? "Reading…" : "Analyzing…";
  const { forms, errors, warnings } = summary(model.analysis);
  return [plural(forms, "form"), plural(errors, "error"), plural(warnings, "warning")].join(" · ");
};

const symbolDetails = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const analysis = model.analysis;
  if (analysis === null || model.inspector === null) return [];
  const declarations = analysis.definitions.filter(
    (definition) => definition.formNodeId === model.inspector,
  );
  const links = declarations.flatMap((definition) =>
    (analysis.references[definition.key] ?? []).map((id) => ({ id, name: definition.name })),
  );
  const row = analysis.rows.find((row) => row.id === model.inspector);
  const uses = new Set(
    (row?.nodes ?? []).flatMap((node) => analysis.symbols[node.nodeId]?.definition ?? []),
  );
  const targets = analysis.definitions.filter((definition) => uses.has(definition.key));
  return [
    ...(targets.length === 0
      ? []
      : [
          h.h3([], ["Uses"]),
          h.div(
            [h.Class("wb__links")],
            targets.map((definition) =>
              h.button(
                [h.Type("button"), h.OnClick(Message.GoToDefinition({ key: definition.key }))],
                [
                  definition.nodeId === null
                    ? `${definition.name} · ${definition.sourceId}`
                    : definition.name,
                ],
              ),
            ),
          ),
        ]),
    ...(links.length === 0
      ? []
      : [
          h.h3([], ["References"]),
          h.div(
            [h.Class("wb__links")],
            links.map(({ id, name }) =>
              h.button([h.Type("button"), h.OnClick(Message.RevealNode({ id }))], [`${name} use`]),
            ),
          ),
        ]),
  ];
};

export const view = defineView<Model, Message>((model, h): Html => {
  return h.div(
    [
      h.Class("wb"),
      h.Key(model.id),
      h.OnKeyDownPreventDefault((key) =>
        key === "F12" ? Option.some(Message.DefinitionAtCaret()) : Option.none(),
      ),
      h.DataAttribute("workbench", model.id),
      h.DataAttribute("source-dirty", String(model.sourceDirty)),
      // Whether the facts on screen describe the current text, for hosts and tests.
      h.DataAttribute("analyzed", String(model.analysis?.revision === model.outline.revision)),
    ],
    [
      h.section(
        [
          h.Class(`wb__window${model.inspector === null ? "" : " wb--inspecting"}`),
          h.AriaLabel("Program"),
        ],
        [
          h.header(
            [h.Class("wb__titlebar")],
            [
              h.span([h.Class("wb__name")], [model.title]),
              h.span([h.Class("wb__stats"), h.AriaLive("polite")], [stats(model)]),
            ],
          ),
          h.nav(
            [h.Class("wb__toolbar"), h.AriaLabel("Notation")],
            [
              h.button(
                [
                  h.Type("button"),
                  h.Disabled(
                    model.runBusy ||
                      model.run?.status === "pending" ||
                      model.sourceDirty ||
                      model.analysis?.revision !== model.outline.revision ||
                      model.analysis?.diagnostics.some(
                        (diagnostic) =>
                          diagnostic.severity === "error" && diagnostic.phase !== "evaluate",
                      ) === true ||
                      (model.analysis?.brokenRows.length ?? 0) > 0,
                  ),
                  h.OnClick(Message.Run()),
                ],
                [model.runBusy ? "Running…" : "Run"],
              ),
              h.button(
                [
                  h.Type("button"),
                  h.OnClick(
                    Message.SetPane({ pane: model.pane === "outline" ? "source" : "outline" }),
                  ),
                ],
                [model.pane === "outline" ? "Source" : "Back to outline"],
              ),
              ...(["Outline", "Brackets"] as const).map((notation) =>
                h.button(
                  [
                    h.Type("button"),
                    h.AriaPressed(String(model.notation === notation)),
                    h.OnClick(Message.SetNotation({ notation })),
                  ],
                  [notation],
                ),
              ),
              h.button(
                [
                  h.Type("button"),
                  h.OnClick(Message.DefinitionAtCaret()),
                  h.Title("Go to definition (F12)"),
                ],
                ["Definition ↗"],
              ),
            ],
          ),
          h.nav(
            [h.Class("wb__toolbar"), h.AriaLabel("Refactorings")],
            [
              h.input([
                h.Type("text"),
                h.AriaLabel("Refactoring name or wrapper"),
                h.Value(model.editArgument),
                h.Placeholder("Name or wrapper"),
                h.OnInput((value) => Message.EditArgument({ value })),
              ]),
              ...(["wrap", "unwrap", "raise", "splice", "rename", "extract"] as const).map(
                (action) =>
                  h.button(
                    [
                      h.Type("button"),
                      h.Disabled(
                        model.editBusy ||
                          model.analysis?.revision !== model.outline.revision ||
                          model.sourceDirty,
                      ),
                      h.OnClick(Message.Refactor({ action })),
                    ],
                    [`${action[0]!.toUpperCase()}${action.slice(1)}`],
                  ),
              ),
              h.button(
                [
                  h.Type("button"),
                  h.OnClick(
                    Message.GotOutlinerMessage({ message: Outliner.Message.ClickedUndo() }),
                  ),
                ],
                ["Undo"],
              ),
              h.button(
                [
                  h.Type("button"),
                  h.OnClick(
                    Message.GotOutlinerMessage({ message: Outliner.Message.ClickedRedo() }),
                  ),
                ],
                ["Redo"],
              ),
            ],
          ),
          h.section(
            [h.Class("wb__assistant"), h.AriaLabel("Assistant")],
            [
              h.div(
                [h.Class("wb__assistant-heading")],
                [h.strong([], ["Assistant"]), h.span([], [model.assistantName])],
              ),
              h.div(
                [h.Class("wb__toolbar")],
                [
                  h.input([
                    h.Type("text"),
                    h.AriaLabel("Assistant request"),
                    h.Value(model.prompt),
                    h.OnInput((value) => Message.SetPrompt({ value })),
                  ]),
                  h.button(
                    [
                      h.Type("button"),
                      h.Disabled(
                        model.editBusy ||
                          model.sourceDirty ||
                          model.analysis?.revision !== model.outline.revision,
                      ),
                      h.OnClick(Message.AskAssistant()),
                    ],
                    [model.editBusy ? "Analyzing proposal…" : "Propose"],
                  ),
                ],
              ),
              ...(model.assistantReply === null
                ? []
                : [h.p([h.Role("status")], [model.assistantReply])]),
            ],
          ),
          ...(model.proposal === null
            ? []
            : [
                h.div(
                  [h.Class("wb__review")],
                  [
                    ChangeSetPreview.view(
                      {
                        label: model.proposal.title,
                        basis: `${model.proposal.proposer} · revision ${model.proposal.basis}`,
                        content: [
                          TreeDiff.view(
                            {
                              label: "Structural diff",
                              before: diffNodes(model.outline.items),
                              after: diffNodes(model.proposal.rows),
                            },
                            h,
                          ),
                        ],
                        consequences: model.proposal.consequences,
                        notices: [
                          "Capabilities are not performed during preview.",
                          ...(model.proposal.consequences.length === 0
                            ? ["No diagnostic, observed value, or capability changes."]
                            : []),
                        ],
                        actions: [
                          h.button(
                            [
                              h.Class("wb__action"),
                              h.Type("button"),
                              h.OnClick(Message.AcceptProposal()),
                            ],
                            ["Accept"],
                          ),
                          h.button(
                            [
                              h.Class("wb__action"),
                              h.Type("button"),
                              h.OnClick(Message.DiscardProposal()),
                            ],
                            ["Discard"],
                          ),
                        ],
                      },
                      h,
                    ),
                  ],
                ),
              ]),
          ...(model.run?.call == null
            ? []
            : [
                h.div(
                  [h.Class("wb__review")],
                  [
                    Agent.PermissionRequest.view(
                      {
                        part: {
                          _tag: "Tool",
                          callId: model.run.call.callId,
                          name: model.run.call.name,
                          input: "",
                          output: "",
                          status: "WaitingApproval",
                          permissionReason: `${model.run.purity} capability · ${model.run.description}`,
                        },
                        onDecision: (decision) =>
                          Message.DecideCapability({ allow: decision === "Allow" }),
                        presentation: {
                          renderDetails: () => [
                            h.code(
                              [],
                              [
                                `${model.run!.call!.name} ${model.run!.call!.args.map((value) => preview(value)).join(" ")}`,
                              ],
                            ),
                          ],
                        },
                      },
                      h,
                    ),
                  ],
                ),
              ]),
          ...(model.run?.printed == null
            ? []
            : [
                h.p(
                  [h.Class("wb__run-result"), h.Role("status")],
                  [`Run completed: ${model.run.printed}`],
                ),
              ]),
          ...(model.failure === null
            ? []
            : [h.p([h.Class("wb-error"), h.Role("alert")], [model.failure])]),
          h.div(
            [h.Class("wb__page")],
            model.pane === "source"
              ? [
                  CodeEditor.view(
                    {
                      model: model.source,
                      label: "Forma source",
                      showToolbar: false,
                      showInspector: false,
                      toParentMessage: (message) => Message.GotSourceMessage({ message }),
                      highlights:
                        model.inspector === null
                          ? []
                          : (model.analysis?.rows
                              .filter((row) => row.id === model.inspector)
                              .map((row) => ({
                                from: row.start,
                                to: row.end,
                                kind: "inspected",
                              })) ?? []),
                      hover: ({ offset, document }) => {
                        if (
                          model.analysis === null ||
                          document.text !== model.analysis.document.source
                        )
                          return null;
                        const fact = hoverFact(model.analysis, offset);
                        return fact === null
                          ? null
                          : { from: fact.from, to: fact.to, content: hoverContent(fact, h) };
                      },
                    },
                    h,
                  ),
                  ...(model.sourceError === null
                    ? []
                    : [h.p([h.Role("alert"), h.Class("wb-error")], [model.sourceError])]),
                ]
              : [
                  h.submodel({
                    slotId: `${model.id}-outline`,
                    model: model.outline,
                    view: Outliner.view,
                    viewInputs: {
                      ...policy,
                      label: "Program",
                      spellcheck: false,
                      decorations: decorations(model),
                      hover: ({ id, offset, text }) => {
                        const analysis = model.analysis;
                        const layout = analysis?.rows.find((layout) => layout.id === id);
                        if (analysis == null || layout == null || layout.text !== text) return null;
                        const fact = hoverFact(analysis, sourceOffsetAtRow(layout, offset));
                        if (fact === null) return null;
                        const node = layout.nodes.find((node) => node.nodeId === fact.nodeId);
                        return {
                          from: node?.from ?? 0,
                          to: node?.to ?? text.length,
                          content: hoverContent(fact, h),
                        };
                      },
                      // Placeholders stay while the next revision is analyzed: removing
                      // them re-renders the rows around the caret and drops its focus.
                      placeholders: (parentId) =>
                        parentId === null ? [] : (model.analysis?.slots[parentId] ?? []),
                      rowAccessory: (row) => {
                        if (
                          model.analysis?.rows.find((layout) => layout.id === row.id)?.text !==
                          row.text
                        )
                          return null;
                        const observed = model.analysis?.values[row.id];
                        const type = model.analysis?.types[row.id];
                        const requirements = model.analysis?.requirements[row.id] ?? [];
                        if (row.text.trimStart().startsWith(";")) return null;
                        return h.button(
                          [
                            h.Class("wb__value"),
                            h.Type("button"),
                            h.OnClick(Message.Inspect({ id: row.id })),
                            h.AriaLabel(`Inspect ${row.text}`),
                          ],
                          [
                            ...(observed?.value == null
                              ? []
                              : [
                                  h.span(
                                    [h.Class("wb__preview")],
                                    [
                                      preview(observed.value) +
                                        (observed.count > 1 ? ` ×${observed.count}` : ""),
                                    ],
                                  ),
                                ]),
                            ...(type === undefined
                              ? [
                                  h.small(
                                    [h.Class("wb__type")],
                                    [
                                      observed?.value == null
                                        ? "Not evaluated"
                                        : "Type unavailable",
                                    ],
                                  ),
                                ]
                              : [h.small([h.Class("wb__type")], [type])]),
                            ...(requirements.length === 0
                              ? []
                              : [
                                  h.small(
                                    [h.Class("wb__requirements")],
                                    [`Requires ${requirements.join(", ")}`],
                                  ),
                                ]),
                          ],
                        );
                      },
                    },
                    toParentMessage: outlineMessage,
                  }),
                ],
          ),
          ...(model.inspector === null
            ? []
            : [
                h.aside(
                  [h.Class("wb__inspector"), h.AriaLabel("Inspector")],
                  [
                    h.h2([], ["Inspector"]),
                    h.button(
                      [h.Class("wb__close"), h.Type("button"), h.OnClick(Message.CloseInspector())],
                      ["Close"],
                    ),
                    h.code(
                      [],
                      [
                        model.analysis?.rows.find((row) => row.id === model.inspector)?.text ??
                          "Form",
                      ],
                    ),
                    h.p([], [model.analysis?.types[model.inspector] ?? "Type unavailable"]),
                    h.p(
                      [],
                      [
                        `Requires: ${(model.analysis?.requirements[model.inspector] ?? []).join(", ") || "none"}`,
                      ],
                    ),
                    h.p(
                      [],
                      [
                        model.analysis?.values[model.inspector]?.failure ??
                          (model.analysis?.values[model.inspector]?.origin === "elaboration"
                            ? "Elaborated declaration"
                            : `${model.analysis?.values[model.inspector]?.count ?? 0} evaluations`),
                      ],
                    ),
                    ...symbolDetails(model, h),
                    ValueTree.view(
                      {
                        model: model.valueTree,
                        nodes: model.valueNodes,
                        label: "Value",
                        toParentMessage: (message) => Message.GotValueMessage({ message }),
                      },
                      h,
                    ),
                  ],
                ),
              ]),
        ],
      ),
    ],
  );
});
