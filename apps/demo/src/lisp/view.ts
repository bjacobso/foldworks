import { Option } from "effect";
import {
  Check,
  ChevronsDownUp,
  CircleX,
  ChevronsUpDown,
  Lock,
  Parentheses,
  Redo2,
  Sparkles,
  TriangleAlert,
  Undo2,
  X,
} from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import {
  Badge,
  Button,
  ChangeSetPreview,
  Icon,
  Stepper,
  TreeDiff,
  ValueTree,
  type TreeDiffNode,
} from "@foldworks/ui";
import { History } from "@foldworks/history";
import { CodeEditor } from "@foldworks/code-editor";
import {
  Outliner,
  ancestors,
  find,
  type Items,
  type Row,
  type RowDecoration,
} from "@foldworks/outliner";

import {
  analyze,
  traceOf,
  decorations,
  definedName,
  describe,
  documentation,
  highlight,
  type Analysis,
} from "./analysis";
import { SUGGESTIONS } from "./assistant";
import { printOutline } from "./codec";
import { DEFINING_FORMS, show } from "./evaluate";
import { print } from "./syntax";
import { describeAt, type Description } from "./hover";
import { LIBRARY, isLocked, outlinePolicy } from "./policy";
import { slotsFor } from "./slots";
import { lineOf, printedFor, sourceHover } from "./source";
import { Message, type Refactoring } from "./message";
import { domIds, type Model } from "./model";
import { explode, join, raise } from "./refactor";
import { inspectedNodes, stepSourceRange, targetsOf } from "./update";

type H = HtmlBuilder<Message>;

const outlineMessage = (message: Outliner.Message): Message =>
  Message.GotOutlinerMessage({ message });

const firstLine = (text: string): string => text.split("\n")[0]?.trim() || "untitled";

/** Code with syntax colors, one element per line. */
const codeLines = (text: string, analysis: Analysis, h: H, active = -1): ReadonlyArray<Html> =>
  text
    .split("\n")
    .map((line, index) =>
      h.div(
        [h.Class("lisp-code__line"), h.DataAttribute("active", String(index === active))],
        [
          ...highlight(line, analysis).map((span) =>
            span.kind === undefined
              ? span.text
              : h.span([h.Class("lisp-token"), h.DataAttribute("kind", span.kind)], [span.text]),
          ),
          "​",
        ],
      ),
    );

const isLiteral = (analysis: Analysis, id: string): boolean => {
  const expr = analysis.program.exprs.get(id);
  if (expr === undefined) return true;
  if (expr._tag === "Number" || expr._tag === "String" || expr._tag === "Keyword") return true;
  if (expr._tag === "Comment") return true;
  if (expr._tag === "List") {
    const head = expr.items[0];
    return head?._tag === "Symbol" && head.name === "section";
  }
  return false;
};

/** The value, error, or warning shown at the end of a row. */
const rowValue = (analysis: Analysis, row: Row, h: H): Html | null => {
  if (row.text === LIBRARY) {
    return h.span(
      [
        h.Class("lisp-value"),
        h.DataAttribute("kind", "readonly"),
        h.Title("Shared code, shown here read only"),
      ],
      [
        Icon.view({ icon: Lock, size: 12 }, h),
        h.span([h.Class("lisp-value__text")], ["read only"]),
      ],
    );
  }
  const error = analysis.program.errors.get(row.id) ?? analysis.evaluation.errors.get(row.id);
  const glyph = (icon: typeof Check) => Icon.view({ icon, size: 12 }, h);
  if (error !== undefined) {
    return h.span(
      [h.Class("lisp-value"), h.DataAttribute("kind", "error"), h.Title(error)],
      [glyph(CircleX), h.span([h.Class("lisp-value__text")], [error])],
    );
  }
  const warning = analysis.warnings.get(row.id)?.[0];
  if (warning !== undefined) {
    return h.span(
      [h.Class("lisp-value"), h.DataAttribute("kind", "warning"), h.Title(warning)],
      [glyph(TriangleAlert), h.span([h.Class("lisp-value__text")], [warning])],
    );
  }
  const observed = analysis.evaluation.values.get(row.id);
  if (observed === undefined || isLiteral(analysis, row.id)) return null;
  const { value, count } = observed;
  const kind = value === true ? "pass" : value === false ? "fail" : "value";
  return h.span(
    [
      h.Class("lisp-value"),
      h.DataAttribute("kind", kind),
      h.Title(count > 1 ? `${show(value, 400)} · last of ${count} evaluations` : show(value, 400)),
    ],
    [
      value === true
        ? glyph(Check)
        : value === false
          ? glyph(X)
          : h.span([h.AriaHidden(true)], ["→"]),
      h.span(
        [h.Class("lisp-value__text")],
        [typeof value === "boolean" ? String(value) : show(value, 44)],
      ),
      ...(count > 1 ? [h.span([h.Class("lisp-value__count")], [`×${count}`])] : []),
    ],
  );
};

/** What hovering a token shows: what it is, how to call it, and what it last was. */
const hoverContent = (description: Description, h: H): Html =>
  h.div(
    [h.Class("lisp-hover")],
    [
      h.p(
        [h.Class("lisp-hover__heading")],
        [
          h.code([h.Class("lisp-hover__title")], [description.title]),
          h.span([h.Class("lisp-hover__kind")], [description.kind]),
        ],
      ),
      ...(description.usage === undefined
        ? []
        : [h.code([h.Class("lisp-hover__usage")], [description.usage])]),
      ...(description.summary === undefined
        ? []
        : [h.p([h.Class("lisp-hover__summary")], [description.summary])]),
      ...(description.value === undefined
        ? []
        : [
            h.p(
              [h.Class("lisp-hover__value")],
              [
                h.span([h.Class("lisp-hover__type")], [description.value.type]),
                h.code([], [description.value.text]),
                ...(description.value.count > 1
                  ? [h.span([h.Class("lisp-value__count")], [`last of ${description.value.count}`])]
                  : []),
              ],
            ),
          ]),
      ...(description.facts === undefined || description.facts.length === 0
        ? []
        : [
            h.dl(
              [h.Class("lisp-hover__facts")],
              description.facts.flatMap(([label, value]) => [h.dt([], [label]), h.dd([], [value])]),
            ),
          ]),
    ],
  );

const toolbar = (model: Model, h: H): Html => {
  const mod = model.platform === "mac" ? "⌘" : "Ctrl+";
  return h.div(
    [h.Class("lisp-ide__toolbar"), h.Role("toolbar"), h.AriaLabel("Program tools")],
    [
      Button.view(
        {
          icon: Undo2,
          ariaLabel: "Undo",
          variant: "ghost",
          size: "icon",
          isDisabled: !History.canUndo(model.outline.history),
          onClick: outlineMessage(Outliner.Message.ClickedUndo()),
        },
        h,
      ),
      Button.view(
        {
          icon: Redo2,
          ariaLabel: "Redo",
          variant: "ghost",
          size: "icon",
          isDisabled: !History.canRedo(model.outline.history),
          onClick: outlineMessage(Outliner.Message.ClickedRedo()),
        },
        h,
      ),
      h.span([h.Class("lisp-ide__divider"), h.AriaHidden(true)], []),
      h.span([h.Class("lisp-ide__label")], ["Zoom"]),
      h.div(
        [h.Class("lisp-ide__levels"), h.Role("group"), h.AriaLabel("Show levels")],
        [1, 2, 3].map((level) =>
          h.button(
            [
              h.Class("lisp-ide__level"),
              h.Type("button"),
              h.Title(`Show ${level} ${level === 1 ? "level" : "levels"}`),
              h.AriaLabel(`Show ${level} ${level === 1 ? "level" : "levels"}`),
              h.OnClick(outlineMessage(Outliner.Message.ExpandedToLevel({ level }))),
            ],
            [String(level)],
          ),
        ),
      ),
      Button.view(
        {
          icon: ChevronsDownUp,
          ariaLabel: "Collapse all",
          variant: "ghost",
          size: "icon",
          onClick: outlineMessage(Outliner.Message.SetAllCollapsed({ collapsed: true })),
        },
        h,
      ),
      Button.view(
        {
          icon: ChevronsUpDown,
          ariaLabel: "Expand all",
          variant: "ghost",
          size: "icon",
          onClick: outlineMessage(Outliner.Message.SetAllCollapsed({ collapsed: false })),
        },
        h,
      ),
      h.span([h.Class("lisp-ide__spacer")], []),
      h.div(
        [h.Class("lisp-ide__levels"), h.Role("group"), h.AriaLabel("Notation")],
        (["Outline", "Lisp"] as const).map((notation) =>
          h.button(
            [
              h.Class("lisp-ide__notation"),
              h.Type("button"),
              h.AriaPressed(String(model.notation === notation)),
              h.Title(
                notation === "Outline"
                  ? "Bullets and rows"
                  : "Brackets: the outline reads as Lisp source",
              ),
              h.OnClick(Message.ChoseNotation({ notation })),
            ],
            [notation === "Outline" ? "• Outline" : "( Brackets"],
          ),
        ),
      ),
      Button.view(
        {
          icon: Parentheses,
          label: `Lisp  ${mod}L`,
          variant: model.showSource ? "secondary" : "ghost",
          size: "sm",
          onClick: Message.ToggledSource(),
        },
        h,
      ),
    ],
  );
};

/**
 * The program printed as Lisp, in the code editor. The outline's analysis
 * highlights it and explains it on hover, and the line for the row with the
 * caret is highlighted while the source matches the outline.
 */
const sourcePane = (model: Model, analysis: Analysis, focusId: string | null, h: H): Html => {
  const items = model.outline.items;
  const text = model.source.document.text;
  const printed = printedFor(items, text);
  const line =
    printed === undefined || focusId === null || model.stepping !== null
      ? undefined
      : lineOf(items, printed, focusId);
  const stepRange = stepSourceRange(model);
  return h.section(
    [
      h.Class("lisp-source"),
      h.AriaLabel("Lisp source"),
      h.DataAttribute("invalid", String(model.sourceError !== null)),
      h.OnFocusLeave(Message.BlurredSource()),
    ],
    [
      h.header(
        [h.Class("lisp-source__header")],
        [
          h.span([h.Class("lisp-source__title")], ["Lisp"]),
          model.sourceError === null
            ? h.span(
                [h.Class("lisp-source__hint")],
                ["Same program, with parentheses · edits apply as you type"],
              )
            : h.span([h.Class("lisp-source__error"), h.Role("status")], [model.sourceError]),
        ],
      ),
      CodeEditor.view(
        {
          model: model.source,
          label: "Lisp source",
          meta: null,
          showToolbar: false,
          showInspector: false,
          toParentMessage: (message) => Message.GotSourceMessage({ message }),
          highlights: [
            ...(line === undefined ? [] : [{ ...line, kind: "focus" }]),
            ...(stepRange === undefined ? [] : [{ ...stepRange, kind: "step" }]),
          ],
          hover: ({ offset, source }) => {
            const description = sourceHover(items, analysis, text, offset, source === "Keyboard");
            return description === undefined
              ? null
              : {
                  from: description.from,
                  to: description.to,
                  content: hoverContent(description, h),
                };
          },
        },
        h,
      ),
    ],
  );
};

/** The name an item is about: what it defines, the name it is, or the function it calls. */
const subjectOf = (analysis: Analysis, id: string): string | undefined => {
  const expr = analysis.program.exprs.get(id);
  if (expr === undefined) return undefined;
  const defined = definedName(expr);
  if (defined !== undefined) return defined.name;
  if (expr._tag === "Symbol") return expr.name;
  if (expr._tag === "List" && expr.items[0]?._tag === "Symbol") return expr.items[0].name;
  return undefined;
};

const referenceButton = (items: Items, id: string, h: H): Html =>
  h.button(
    [h.Class("lisp-link"), h.Type("button"), h.OnClick(Message.ClickedReference({ id }))],
    [firstLine(find(items, id)?.text ?? id)],
  );

const field = (label: string, content: ReadonlyArray<Html | string>, h: H): Html =>
  h.div([h.Class("lisp-field")], [h.dt([], [label]), h.dd([], content)]);

const keys = (names: ReadonlyArray<string>, h: H): ReadonlyArray<Html> =>
  names.length === 0
    ? [h.span([h.Class("lisp-muted")], ["nothing"])]
    : names.map((name) => h.code([h.Class("lisp-chip")], [`:${name}`]));

const inspector = (model: Model, analysis: Analysis, h: H): Html => {
  const items = model.outline.items;
  const { selection, focusId } = targetsOf(model.outline);
  const node = focusId === null ? undefined : find(items, focusId);
  if (node === undefined) {
    return h.section(
      [h.Class("lisp-panel"), h.AriaLabel("Inspector")],
      [
        h.h3([h.Class("lisp-panel__title")], ["Inspector"]),
        h.p(
          [h.Class("lisp-muted")],
          ["Put the caret in a row to see what it is, what it did, and who uses it."],
        ),
      ],
    );
  }
  const expr = analysis.program.exprs.get(node.id);
  const observed = analysis.evaluation.values.get(node.id);
  const error = analysis.program.errors.get(node.id) ?? analysis.evaluation.errors.get(node.id);
  const warnings = analysis.warnings.get(node.id) ?? [];
  const subject = subjectOf(analysis, node.id);
  const definition = subject === undefined ? undefined : analysis.definitions.get(subject);
  const uses =
    subject === undefined
      ? []
      : (analysis.references.get(subject) ?? []).filter((id) => id !== node.id);
  const step =
    subject === undefined
      ? undefined
      : analysis.steps.find((candidate) => candidate.name === subject);
  const doc =
    definition === undefined
      ? documentation(items, node.id)
      : documentation(items, definition.itemId);
  const path = ancestors(items, node.id);
  const targets = selection.length > 0 ? selection : [node.id];
  // Shared code is read only here, so it offers no edits.
  const locked = isLocked(items, node.id);
  const refactor = (refactoring: Refactoring, label: string, enabled: boolean, head = "") =>
    h.button(
      [
        h.Class("lisp-action"),
        h.Type("button"),
        h.Disabled(!enabled || locked),
        h.OnClick(Message.Refactored({ refactoring, head })),
      ],
      [label],
    );
  const parentless = path.length === 0;
  return h.section(
    [h.Class("lisp-panel"), h.AriaLabel("Inspector")],
    [
      h.h3([h.Class("lisp-panel__title")], ["Inspector"]),
      ...(path.length === 0
        ? []
        : [
            h.nav(
              [h.Class("lisp-path"), h.AriaLabel("Enclosing forms")],
              path.map((id) => referenceButton(items, id, h)),
            ),
          ]),
      h.p(
        [h.Class("lisp-kind")],
        [
          expr === undefined
            ? error === undefined
              ? "Empty row"
              : "Unreadable row"
            : describe(expr, analysis),
        ],
      ),
      ...(doc === undefined ? [] : [h.p([h.Class("lisp-doc")], [doc])]),
      h.dl(
        [h.Class("lisp-fields")],
        [
          ...(error !== undefined
            ? [field("Error", [h.span([h.Class("lisp-error")], [error])], h)]
            : observed !== undefined
              ? [
                  field(
                    observed.count > 1 ? `Value · last of ${observed.count}` : "Value",
                    [
                      inspectedNodes(model).length > 0
                        ? ValueTree.view(
                            {
                              model: model.values,
                              nodes: inspectedNodes(model),
                              label: "Value",
                              toParentMessage: (message) => Message.GotValueMessage({ message }),
                            },
                            h,
                          )
                        : h.code(
                            [h.Class("lisp-code lisp-code--inline")],
                            [show(observed.value, 240)],
                          ),
                    ],
                    h,
                  ),
                ]
              : []),
          ...warnings.map((warning) =>
            field("Warning", [h.span([h.Class("lisp-warning")], [warning])], h),
          ),
          ...(step === undefined
            ? []
            : [
                field("System", [step.system], h),
                field("Reads", keys(step.reads, h), h),
                field("Writes", keys(step.writes, h), h),
              ]),
          ...(definition !== undefined && definition.itemId !== node.id
            ? [field("Defined", [referenceButton(items, definition.itemId, h)], h)]
            : []),
          ...(definition === undefined
            ? []
            : [
                field(
                  `Used by ${uses.length}`,
                  uses.length === 0
                    ? [h.span([h.Class("lisp-muted")], ["no other rows"])]
                    : [
                        h.div(
                          [h.Class("lisp-field__list")],
                          uses.slice(0, 8).map((id) => referenceButton(items, id, h)),
                        ),
                      ],
                  h,
                ),
              ]),
        ],
      ),
      h.div(
        [h.Class("lisp-code lisp-code--block"), h.AriaLabel("Lisp for this row")],
        codeLines(printOutline([node]).text, analysis, h),
      ),
      h.div(
        [
          h.Class("lisp-actions"),
          h.Role("group"),
          h.AriaLabel(selection.length > 1 ? `Edit ${selection.length} rows` : "Edit this row"),
        ],
        [
          h.span(
            [h.Class("lisp-actions__label")],
            [selection.length > 1 ? `Wrap ${selection.length} rows in` : "Wrap in"],
          ),
          ...["parallel", "sequence", "do"].map((head) =>
            refactor("Wrap", head, targets.length > 0, head),
          ),
          h.span([h.Class("lisp-actions__break")], []),
          refactor("Unwrap", "Unwrap", node.children.length > 0),
          refactor("Raise", "Raise", !parentless && raise(items, node.id) !== undefined),
          refactor("Join", "One line", join(items, node.id) !== undefined),
          refactor("Explode", "Rows", explode(items, node.id, () => "probe") !== undefined),
          h.button(
            [
              h.Class("lisp-action"),
              h.Type("button"),
              h.Disabled(parentless || locked),
              h.OnClick(Message.PrefilledPrompt({ text: "Extract this as " })),
            ],
            ["Extract…"],
          ),
          ...(subject !== undefined && definition !== undefined
            ? [
                h.button(
                  [
                    h.Class("lisp-action"),
                    h.Type("button"),
                    h.Disabled(locked),
                    h.OnClick(Message.PrefilledPrompt({ text: `Rename ${subject} to ` })),
                  ],
                  ["Rename…"],
                ),
              ]
            : []),
          ...(steppable(analysis, node.id)
            ? [
                h.button(
                  [
                    h.Class("lisp-action lisp-action--primary"),
                    h.Type("button"),
                    h.OnClick(Message.StartedStepping({ id: node.id })),
                  ],
                  ["Step through"],
                ),
              ]
            : []),
        ],
      ),
    ],
  );
};

/** An outline as a tree for a structural diff. */
export const asTree = (items: Items): ReadonlyArray<TreeDiffNode> =>
  items.map((node) => ({
    id: node.id,
    label: firstLine(node.text),
    children: asTree(node.children),
  }));

const assistant = (model: Model, h: H): Html => {
  const items = model.outline.items;
  const { selection, focusId } = targetsOf(model.outline);
  const focusNode = focusId === null ? undefined : find(items, focusId);
  const context =
    selection.length > 1
      ? `${selection.length} selected rows`
      : selection.length === 1 || focusNode !== undefined
        ? `“${firstLine(find(items, selection[0] ?? focusId!)?.text ?? "")}”`
        : "the whole program";
  const proposal = model.proposal;
  return h.section(
    [h.Class("lisp-panel lisp-assistant"), h.AriaLabel("Assistant")],
    [
      h.div(
        [h.Class("lisp-panel__heading")],
        [
          h.h3([h.Class("lisp-panel__title")], ["Ask"]),
          Badge.view({ label: "Local · no model", tone: "info", dot: true }, h),
        ],
      ),
      h.p([h.Class("lisp-muted lisp-assistant__context")], ["Acting on ", h.strong([], [context])]),
      h.form(
        [h.Class("lisp-assistant__form"), h.OnSubmit(Message.SubmittedPrompt())],
        [
          h.input([
            h.Id(domIds.prompt),
            h.Class("lisp-assistant__input"),
            h.Type("text"),
            h.Value(model.prompt),
            h.Placeholder("Describe a change to the selected rows"),
            h.AriaLabel("Ask for a change"),
            h.Attribute("autocomplete", "off"),
            h.OnInput((text) => Message.ChangedPrompt({ text })),
          ]),
          h.button(
            [
              h.Class("lisp-button lisp-button--icon"),
              h.Type("submit"),
              h.AriaLabel("Propose a change"),
            ],
            [Icon.view({ icon: Sparkles, size: 14 }, h)],
          ),
        ],
      ),
      ...(proposal === null && model.reply === null
        ? [
            h.ul(
              [h.Class("lisp-suggestions"), h.AriaLabel("Try")],
              SUGGESTIONS.map((suggestion) =>
                h.li(
                  [],
                  [
                    h.button(
                      [
                        h.Class("lisp-suggestion"),
                        h.Type("button"),
                        h.OnClick(Message.ChoseSuggestion({ prompt: suggestion })),
                      ],
                      [suggestion],
                    ),
                  ],
                ),
              ),
            ),
          ]
        : []),
      ...(model.reply === null
        ? []
        : [
            h.div(
              [h.Class("lisp-reply"), h.Role("status")],
              [
                ...model.reply.lines.map((line) => h.p([], [line])),
                h.button(
                  [h.Class("lisp-link"), h.Type("button"), h.OnClick(Message.DismissedReply())],
                  ["Dismiss"],
                ),
              ],
            ),
          ]),
      ...(proposal === null
        ? []
        : [
            h.div(
              [h.Class("lisp-proposal")],
              [
                ChangeSetPreview.view(
                  {
                    label: proposal.title,
                    basis: "A structural edit. Rows it does not touch keep their identity.",
                    content: [
                      TreeDiff.view(
                        {
                          label: "Structural diff",
                          before: asTree(items),
                          after: asTree(proposal.items),
                        },
                        h,
                      ),
                    ],
                    notices: proposal.notes,
                    actions: [
                      h.button(
                        [
                          h.Id(domIds.accept),
                          h.Class("lisp-button lisp-button--primary"),
                          h.Type("button"),
                          h.OnClick(Message.AcceptedProposal()),
                        ],
                        [h.span([h.AriaHidden(true)], ["✓ "]), "Accept"],
                      ),
                      h.button(
                        [
                          h.Class("lisp-button"),
                          h.Type("button"),
                          h.OnClick(Message.DiscardedProposal()),
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
    ],
  );
};

/** Marks the row of the expression the current step evaluated. */
const withStep = (
  rows: Readonly<Record<string, RowDecoration>>,
  model: Model,
  analysis: Analysis,
): Readonly<Record<string, RowDecoration>> => {
  const stepping = model.stepping;
  const step =
    stepping === null ? undefined : traceOf(model.outline.items, stepping.id)[stepping.index];
  if (step === undefined) return rows;
  const id = step.exprId.split("#")[0]!;
  return analysis.program.exprs.has(id) || analysis.allExprs.has(step.exprId)
    ? { ...rows, [id]: { ...rows[id], tone: "step" } }
    : rows;
};

/** Rows whose expression can be stepped through: anything evaluated that is not a definition or a section. */
const steppable = (analysis: Analysis, id: string): boolean => {
  const expr = analysis.program.exprs.get(id);
  if (expr === undefined || !analysis.evaluation.values.has(id) || expr._tag === "Comment")
    return false;
  const head =
    expr._tag === "List" && expr.items[0]?._tag === "Symbol" ? expr.items[0].name : undefined;
  return head === undefined || (!DEFINING_FORMS.has(head) && head !== "section");
};

const clip = (text: string, limit: number): string =>
  text.length > limit ? `${text.slice(0, limit - 1)}…` : text;

/**
 * Stepping through how a row's form evaluated, one expression at a time,
 * with `Stepper` as the playhead. The current expression's row is marked in
 * the outline and its range in the source.
 */
const stepPanel = (model: Model, analysis: Analysis, h: H): ReadonlyArray<Html> => {
  const stepping = model.stepping;
  if (stepping === null) return [];
  const items = model.outline.items;
  const trace = traceOf(items, stepping.id);
  const index = Math.max(0, Math.min(stepping.index, trace.length - 1));
  const form = analysis.program.exprs.get(stepping.id);
  return [
    h.section(
      [h.Id(domIds.steps), h.Class("lisp-panel lisp-steps"), h.AriaLabel("Step through")],
      [
        h.div(
          [h.Class("lisp-panel__heading")],
          [
            h.h3([h.Class("lisp-panel__title")], ["Step through"]),
            h.span(
              [h.Class("lisp-muted"), h.AriaLive("polite")],
              [trace.length === 0 ? "No steps" : `Step ${index + 1} of ${trace.length}`],
            ),
          ],
        ),
        h.code(
          [h.Class("lisp-code lisp-code--inline lisp-steps__form")],
          [form === undefined ? "" : clip(print(form), 120)],
        ),
        h.div(
          [h.Class("lisp-steps__controls"), h.Role("group"), h.AriaLabel("Step controls")],
          [
            Button.view(
              {
                label: "Previous",
                variant: "outline",
                size: "sm",
                isDisabled: index === 0,
                onClick: Message.SteppedTo({ index: index - 1 }),
              },
              h,
            ),
            Button.view(
              {
                label: "Next",
                variant: "outline",
                size: "sm",
                isDisabled: index >= trace.length - 1,
                onClick: Message.SteppedTo({ index: index + 1 }),
              },
              h,
            ),
            Button.view(
              { label: "Done", variant: "ghost", size: "sm", onClick: Message.StoppedStepping() },
              h,
            ),
          ],
        ),
        ...(trace.length === 0
          ? []
          : [
              h.div(
                [h.Class("lisp-steps__list")],
                [
                  Stepper.view(
                    {
                      steps: trace.map((step, at) => {
                        const expr = analysis.allExprs.get(step.exprId);
                        return {
                          id: String(at),
                          label: clip(expr === undefined ? step.exprId : print(expr), 56),
                          description: `→ ${show(step.value, 56)}`,
                        };
                      }),
                      currentStepId: String(index),
                      orientation: "vertical",
                      ariaLabel: "Evaluation steps",
                      onSelect: (id) => Message.SteppedTo({ index: Number(id) }),
                    },
                    h,
                  ),
                ],
              ),
            ]),
      ],
    ),
  ];
};

const guide = (model: Model, h: H): Html => {
  const mod = model.platform === "mac" ? "⌘" : "Ctrl+";
  return h.details(
    [h.Class("lisp-panel lisp-guide")],
    [
      h.summary([], ["How rows become Lisp"]),
      h.ul(
        [],
        [
          "A row's text holds a form's head and leading arguments. Its children are the remaining arguments.",
          "A row with one element and no children is that element. Write (f) to call f with no arguments.",
          "Start a row with ; to turn it, and everything under it, into a comment.",
          `${mod}. zooms into a row and ${mod}⇧. zooms out. The Zoom buttons fold to a depth.`,
          `Esc selects rows; ⇧↓ extends the selection for actions and requests. ${mod}K asks.`,
        ].map((tip) => h.li([], [tip])),
      ),
    ],
  );
};

const stats = (analysis: Analysis): string => {
  const warnings = [...analysis.warnings.values()].reduce((sum, list) => sum + list.length, 0);
  const errors = analysis.program.errors.size + analysis.evaluation.errors.size;
  return [
    `${analysis.program.forms.length} forms`,
    `${warnings} ${warnings === 1 ? "warning" : "warnings"}`,
    `${errors} ${errors === 1 ? "error" : "errors"}`,
  ].join(" · ");
};

export const view = defineView<Model, Message>((model, h) => {
  const items = model.outline.items;
  const analysis = analyze(items);
  const { focusId } = targetsOf(model.outline);
  const mod = (modifiers: Readonly<{ metaKey: boolean; ctrlKey: boolean }>) =>
    model.platform === "mac" ? modifiers.metaKey : modifiers.ctrlKey;
  return h.div(
    [
      h.Class("lisp-ide"),
      h.DataAttribute("lisp-ide", "true"),
      h.DataAttribute("notation", model.notation),
      h.OnKeyDownPreventDefault((key, modifiers) =>
        mod(modifiers) && !modifiers.shiftKey && !modifiers.altKey && key.toLowerCase() === "l"
          ? Option.some(Message.PressedShortcut({ shortcut: "ToggleSource" }))
          : mod(modifiers) && !modifiers.shiftKey && !modifiers.altKey && key.toLowerCase() === "k"
            ? Option.some(Message.PressedShortcut({ shortcut: "Ask" }))
            : Option.none(),
      ),
    ],
    [
      h.div(
        [h.Class("lisp-ide__layout"), h.DataAttribute("source", String(model.showSource))],
        [
          h.section(
            [h.Class("lisp-ide__window"), h.AriaLabel("Program")],
            [
              h.header(
                [h.Class("lisp-ide__titlebar")],
                [
                  h.span(
                    [h.Class("lisp-ide__lights"), h.AriaHidden(true)],
                    [h.span([], []), h.span([], []), h.span([], [])],
                  ),
                  h.span([h.Class("lisp-ide__name")], ["onboarding.lisp"]),
                  h.span([h.Class("lisp-ide__stats")], [stats(analysis)]),
                ],
              ),
              toolbar(model, h),
              h.div(
                [h.Class("lisp-ide__panes")],
                [
                  h.div(
                    [h.Class("lisp-ide__page")],
                    [
                      h.submodel({
                        slotId: "lisp-ide-outline",
                        model: model.outline,
                        view: Outliner.view,
                        viewInputs: {
                          ...outlinePolicy(items),
                          label: "Program",
                          decorations: withStep(
                            decorations(items, {
                              notation: model.notation,
                              scopeId: model.outline.scopeId,
                              focusId,
                            }),
                            model,
                            analysis,
                          ),
                          spellcheck: false,
                          rowAccessory: (row: Row) => rowValue(analysis, row, h),
                          placeholders: (parentId: string | null) => slotsFor(items, parentId),
                          hover: ({ id, offset, source }) => {
                            const description = describeAt(
                              items,
                              analysis,
                              id,
                              offset,
                              source === "Keyboard",
                            );
                            return description === undefined
                              ? null
                              : {
                                  from: description.from,
                                  to: description.to,
                                  content: hoverContent(description, h),
                                };
                          },
                        },
                        toParentMessage: outlineMessage,
                      }),
                    ],
                  ),
                  ...(model.showSource ? [sourcePane(model, analysis, focusId, h)] : []),
                ],
              ),
            ],
          ),
          h.aside(
            [h.Class("lisp-ide__side"), h.AriaLabel("Inspector and assistant")],
            [
              ...stepPanel(model, analysis, h),
              inspector(model, analysis, h),
              assistant(model, h),
              guide(model, h),
            ],
          ),
        ],
      ),
    ],
  );
});
