import {
  ArrowUpRight,
  Bot,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleCheck,
  Focus,
  Play,
  Plus,
  Redo2,
  Undo2,
  X,
} from "@lucide/icons";
import { Agent } from "@foldworks/agent";
import { Outliner, ancestors, find, walk, type Row } from "@foldworks/outliner";
import { History } from "@foldworks/history";
import {
  Badge,
  Button,
  DateInput,
  Icon,
  SegmentedControl,
  SplitView,
  TreeDiff,
} from "@foldworks/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import { decorations } from "../outliner/mentions";
import { contextFor, dateInputFor, statusOf, type Model, type Thread } from "./model";
import { Message } from "./message";

const outlineMessage = (message: Outliner.Message) => Message.GotOutlineMessage({ message });
const toneFor = (status: string): Badge.Tone =>
  status === "Working"
    ? "info"
    : status === "Needs you"
      ? "warning"
      : status === "Ready"
        ? "success"
        : status === "Failed"
          ? "danger"
          : "muted";
const badge = (status: string, h: HtmlBuilder<Message>): Html =>
  Badge.view({ label: status, tone: toneFor(status), dot: true }, h);
const dateLabel = (value: string): string => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
        date,
      );
};

const accessory = (model: Model, row: Row, h: HtmlBuilder<Message>): Html => {
  const thread = model.threads[row.id];
  const descendants = walk(find(model.outline.items, row.id)?.children ?? []).flatMap((child) =>
    model.threads[child.id] ? [model.threads[child.id]!] : [],
  );
  const needing = descendants.filter((child) => statusOf(child) === "Needs you").length;
  const working = descendants.filter((child) => statusOf(child) === "Working").length;
  const date = model.dates[row.id];
  return h.div(
    [h.Class("orchestrator__accessory")],
    [
      ...(date
        ? [h.span([h.Class("orchestrator__date"), h.Title(`Due ${date}`)], [dateLabel(date)])]
        : []),
      ...(thread
        ? [
            Button.view(
              {
                label: statusOf(thread),
                ariaLabel: `Open thread: ${row.text}`,
                variant: "ghost",
                size: "xs",
                attributes: [
                  h.DataAttribute("thread-status", statusOf(thread)),
                  h.DataAttribute("thread-id", row.id),
                ],
                onClick: Message.OpenedNode({ id: row.id }),
                children: [
                  h.span([
                    h.Class(
                      `orchestrator__dot orchestrator__dot--${statusOf(thread).toLowerCase().replaceAll(" ", "-")}`,
                    ),
                    h.AriaHidden(true),
                  ]),
                ],
              },
              h,
            ),
          ]
        : needing || working
          ? [
              h.span(
                [h.Class("orchestrator__rollup"), h.Title("Activity in this branch")],
                [needing ? `${needing} needs you` : `${working} working`],
              ),
            ]
          : [
              h.span(
                [h.Class("orchestrator__open-note")],
                [
                  Button.view(
                    {
                      icon: ArrowUpRight,
                      ariaLabel: `Open details: ${row.text}`,
                      variant: "ghost",
                      size: "xs",
                      onClick: Message.OpenedNode({ id: row.id }),
                    },
                    h,
                  ),
                ],
              ),
            ]),
    ],
  );
};

const folded = (model: Model, row: Row, h: HtmlBuilder<Message>) => {
  const thread = model.threads[row.id];
  if (!thread || !model.showFoldedViews) return null;
  return {
    label: `${row.text} summary`,
    content: h.div(
      [h.Class("orchestrator__folded")],
      [
        h.p([], [thread.result || thread.summary]),
        h.div(
          [h.Class("orchestrator__row")],
          [
            h.span(
              [h.Class("orchestrator__muted")],
              [
                thread.prompt
                  ? `${thread.context.length} context sources`
                  : `${contextFor(model, row.id).length} context sources available`,
              ],
            ),
            Button.view(
              {
                label: thread.agent.transcript.length ? "Open thread" : "Start task",
                icon: thread.agent.transcript.length ? ArrowUpRight : Play,
                variant: "ghost",
                size: "xs",
                onClick: thread.agent.transcript.length
                  ? Message.OpenedNode({ id: row.id })
                  : Message.StartedThread({ id: row.id }),
              },
              h,
            ),
          ],
        ),
      ],
    ),
  };
};

const outlinePane = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class("orchestrator__document"), h.AriaLabel("Workspace outline")],
    [
      h.div(
        [h.Class("orchestrator__document-header")],
        [
          h.div(
            [],
            [
              h.p([h.Class("orchestrator__eyebrow")], ["PERSONAL WORKSPACE"]),
              h.h1([], ["Launch notebook"]),
              h.p(
                [h.Class("orchestrator__subtitle")],
                ["Think in bullets. Put a thought in motion."],
              ),
            ],
          ),
          Button.view(
            {
              label: "New thread",
              icon: Plus,
              variant: "outline",
              size: "sm",
              onClick: Message.AddedThread(),
            },
            h,
          ),
        ],
      ),
      h.div(
        [h.Class("orchestrator__tools"), h.Role("toolbar"), h.AriaLabel("Workspace tools")],
        [
          Button.view(
            {
              icon: Undo2,
              ariaLabel: "Undo outline edit",
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
              ariaLabel: "Redo outline edit",
              variant: "ghost",
              size: "icon",
              isDisabled: !History.canRedo(model.outline.history),
              onClick: outlineMessage(Outliner.Message.ClickedRedo()),
            },
            h,
          ),
          Button.view(
            {
              icon: ChevronsDownUp,
              ariaLabel: "Collapse all branches",
              variant: "ghost",
              size: "icon",
              onClick: outlineMessage(Outliner.Message.SetAllCollapsed({ collapsed: true })),
            },
            h,
          ),
          Button.view(
            {
              icon: ChevronsUpDown,
              ariaLabel: "Expand all branches",
              variant: "ghost",
              size: "icon",
              onClick: outlineMessage(Outliner.Message.SetAllCollapsed({ collapsed: false })),
            },
            h,
          ),
          h.span([h.Class("orchestrator__tool-spacer")]),
          Button.view(
            {
              label: model.showFoldedViews ? "Summaries on" : "Summaries off",
              variant: "ghost",
              size: "xs",
              onClick: Message.ToggledFoldedViews(),
            },
            h,
          ),
        ],
      ),
      h.div(
        [h.Class("orchestrator__outline")],
        [
          h.submodel({
            slotId: "orchestrator-outline",
            model: model.outline,
            view: Outliner.view,
            viewInputs: {
              label: "Launch notebook outline",
              decorations: decorations(model.outline.items),
              rowAccessory: (row: Row) => accessory(model, row, h),
              foldedView: (row: Row) => folded(model, row, h),
              placeholders: (parentId: string | null) =>
                parentId === null ||
                parentId === model.outline.scopeId ||
                (find(model.outline.items, parentId)?.children.length ?? 0) > 0
                  ? [{ key: "note", label: "Add a thought or a task…" }]
                  : [],
            },
            toParentMessage: outlineMessage,
          }),
        ],
      ),
      h.footer(
        [h.Class("orchestrator__document-footer")],
        [
          h.span([], ["Enter a new bullet"]),
          h.span([], ["Tab to nest"]),
          h.span([], ["/agent to attach a thread"]),
        ],
      ),
    ],
  );

const contextView = (
  model: Model,
  id: string,
  thread: Thread | undefined,
  h: HtmlBuilder<Message>,
): Html => {
  const captured = !!thread?.prompt;
  const sources = captured ? thread.context : contextFor(model, id);
  return h.div(
    [h.Class("orchestrator__detail-body"), h.DataAttribute("context-view", "true")],
    [
      h.h3([], [captured ? "Context used for this run" : "Context for the next run"]),
      h.p(
        [h.Class("orchestrator__muted")],
        [
          captured
            ? "Captured when the run started. A new run picks up your latest outline."
            : "Parent briefs, notes marked #context, and this bullet’s children. Other threads stay separate.",
        ],
      ),
      ...(sources.length
        ? [
            h.ul(
              [h.Class("orchestrator__context-list")],
              sources.map((source) =>
                h.li(
                  [],
                  [
                    h.p([], [source.text]),
                    Button.view(
                      {
                        label: "Reveal in outline",
                        variant: "link",
                        size: "xs",
                        isDisabled: !find(model.outline.items, source.id),
                        onClick: outlineMessage(Outliner.Message.Reveal({ id: source.id })),
                      },
                      h,
                    ),
                  ],
                ),
              ),
            ),
          ]
        : [
            h.p(
              [],
              [
                "No context yet. Nest notes under this bullet or add #context to a note in its parent branch.",
              ],
            ),
          ]),
    ],
  );
};

const resultView = (model: Model, id: string, thread: Thread, h: HtmlBuilder<Message>): Html => {
  const promoted = find(model.outline.items, `${id}-result`)?.text === `Result: ${thread.result}`;
  return h.div(
    [h.Class("orchestrator__detail-body"), h.DataAttribute("result-view", "true")],
    [
      Icon.view({ icon: CircleCheck, size: 24 }, h),
      h.h3([], [thread.result ? "A result you can keep" : "Results land here"]),
      h.p(
        [h.Class("orchestrator__result-text")],
        [
          thread.result ||
            "Start the thread, review its recommendation, and accept it to create a result.",
        ],
      ),
      ...(thread.result
        ? [
            Button.view(
              {
                label: promoted ? "Added to outline" : "Add result to outline",
                icon: Plus,
                variant: "outline",
                size: "sm",
                isDisabled: promoted,
                onClick: Message.PromotedResult({ id }),
              },
              h,
            ),
            h.p(
              [h.Class("orchestrator__muted")],
              ["Adds an editable child bullet. You can undo it with the outline’s undo button."],
            ),
          ]
        : []),
    ],
  );
};

const chatView = (model: Model, id: string, thread: Thread, h: HtmlBuilder<Message>): Html =>
  Agent.Chat.view(
    {
      model: thread.agent,
      models: [
        {
          id: "local-balanced",
          label: "Local simulation",
          provider: "Local simulation",
          description: "Try a task with your outline as context.",
        },
      ],
      toParentMessage: (message) => Message.GotThreadMessage({ id, message }),
      empty: {
        title: "Give this thought a little momentum.",
        description: "Start from the bullet’s brief, then steer the conversation here.",
        suggestion: {
          label: "Start this task",
          prompt: find(model.outline.items, id)?.text ?? "Explore this task",
        },
      },
      composer: { placeholder: "Give a direction or ask a follow-up…" },
      permission: {
        allowLabel: "Accept result",
        denyLabel: "Discard",
        note: "Keeps a result in this thread. Add it to the outline whenever you choose.",
        renderDetails: (part, builder) => {
          let recommendation = "Review the recommendation above.";
          try {
            recommendation = JSON.parse(part.input).recommendation ?? recommendation;
          } catch {
            /* Streamed inputs may be incomplete. */
          }
          return [
            TreeDiff.view(
              {
                label: "Proposed thread result",
                before: [],
                after: [{ id: "result", label: recommendation, children: [] }],
              },
              builder,
            ),
          ];
        },
      },
    },
    h,
  );

const detailPane = (model: Model, h: HtmlBuilder<Message>): Html => {
  const id = model.selectedId;
  const node = id ? find(model.outline.items, id) : undefined;
  if (!id || !node)
    return h.aside(
      [h.Class("orchestrator__detail orchestrator__detail--empty"), h.AriaLabel("Thread details")],
      [
        h.div(
          [h.Class("orchestrator__welcome")],
          [
            Icon.view({ icon: Bot, size: 28 }, h),
            h.h2([], ["A thread for any thought."]),
            h.p(
              [],
              [
                "Open a task to see its conversation, context, and result. Keep your notes and your work together.",
              ],
            ),
            h.div(
              [h.Class("orchestrator__welcome-step")],
              [h.span([], ["01"]), h.p([], ["Write a bullet in your own words."])],
            ),
            h.div(
              [h.Class("orchestrator__welcome-step")],
              [h.span([], ["02"]), h.p([], ["Type /agent or attach a thread."])],
            ),
            h.div(
              [h.Class("orchestrator__welcome-step")],
              [h.span([], ["03"]), h.p([], ["Start it, steer it, fold it away."])],
            ),
            h.p([h.Class("orchestrator__muted")], ["Local simulation · Saved in this browser"]),
          ],
        ),
      ],
    );
  const thread = model.threads[id];
  const path = ancestors(model.outline.items, id)
    .map((ancestorId) => find(model.outline.items, ancestorId)?.text)
    .filter(Boolean);
  return h.aside(
    [
      h.Class("orchestrator__detail"),
      h.AriaLabel("Thread details"),
      h.DataAttribute("detail-node", id),
    ],
    [
      h.header(
        [h.Class("orchestrator__detail-header")],
        [
          h.div(
            [h.Class("orchestrator__row")],
            [
              h.span([h.Class("orchestrator__eyebrow")], [path.join(" / ") || "WORKSPACE"]),
              Button.view(
                {
                  icon: X,
                  ariaLabel: "Close details",
                  variant: "ghost",
                  size: "xs",
                  onClick: Message.ClosedDetail(),
                },
                h,
              ),
            ],
          ),
          h.h2([], [node.text]),
          h.div(
            [h.Class("orchestrator__row")],
            [
              ...(thread
                ? [badge(statusOf(thread), h)]
                : [Badge.view({ label: "Note", tone: "muted" }, h)]),
              Button.view(
                {
                  label: "Focus branch",
                  icon: Focus,
                  variant: "ghost",
                  size: "xs",
                  onClick: outlineMessage(Outliner.Message.Hoisted({ id })),
                },
                h,
              ),
            ],
          ),
          h.div(
            [h.Class("orchestrator__due")],
            [
              DateInput.view(
                {
                  model: model.dateInputs[id] ?? dateInputFor(id, model.dates[id]),
                  value: DateInput.iso.parse(model.dates[id] ?? "") ?? null,
                  label: "Due date",
                  toParentMessage: (message) => Message.GotDueDateMessage({ id, message }),
                },
                h,
              ),
            ],
          ),
          SegmentedControl.view(
            {
              value: model.detailView,
              ariaLabel: "Detail view",
              options: [
                { value: "Thread", label: "Thread" },
                { value: "Context", label: "Context" },
                { value: "Result", label: "Result", isDisabled: !thread },
              ],
              onChange: (value) => Message.ChangedDetailView({ value }),
            },
            h,
          ),
        ],
      ),
      ...(model.detailView === "Context"
        ? [contextView(model, id, thread, h)]
        : model.detailView === "Result" && thread
          ? [resultView(model, id, thread, h)]
          : thread
            ? [h.div([h.Class("orchestrator__chat")], [chatView(model, id, thread, h)])]
            : [
                h.div(
                  [h.Class("orchestrator__detail-body")],
                  [
                    h.h3([], ["Keep it as a note. Or put it to work."]),
                    h.p(
                      [h.Class("orchestrator__muted")],
                      [
                        "Attaching a thread keeps this bullet and its notes in place. You choose when to start.",
                      ],
                    ),
                    Button.view(
                      {
                        label: "Attach a thread",
                        icon: Bot,
                        variant: "outline",
                        size: "sm",
                        onClick: Message.AttachedThread({ id }),
                      },
                      h,
                    ),
                  ],
                ),
              ]),
    ],
  );
};

export const view = defineView<Model, Message>((model, h) => {
  const threads = Object.entries(model.threads)
    .filter(([id]) => find(model.outline.items, id))
    .map(([, thread]) => thread);
  const working = threads.filter((thread) => statusOf(thread) === "Working").length;
  const needing = threads.filter((thread) => statusOf(thread) === "Needs you").length;
  return h.div(
    [h.Class("orchestrator"), h.DataAttribute("orchestrator", "true")],
    [
      h.div(
        [h.Class("orchestrator__statusbar")],
        [
          h.span([], [`${threads.length} threads`]),
          ...(working ? [badge(`${working} working`, h)] : []),
          ...(needing
            ? [
                Button.view(
                  {
                    label: `${needing} needs you`,
                    variant: "ghost",
                    size: "xs",
                    onClick: Message.OpenedNode({
                      id: Object.entries(model.threads).find(
                        ([id, thread]) =>
                          find(model.outline.items, id) && statusOf(thread) === "Needs you",
                      )![0],
                    }),
                  },
                  h,
                ),
              ]
            : []),
          h.span([h.Class("orchestrator__tool-spacer")]),
          h.span(
            [],
            [
              model.saveState === "Saved"
                ? "Saved locally"
                : "Could not save · browser storage unavailable",
            ],
          ),
          Badge.view({ label: "Local simulation", variant: "outline", tone: "muted" }, h),
        ],
      ),
      SplitView.view(
        {
          ariaLabel: "Outline workspace",
          collapseBelow: "lg",
          gap: "none",
          panes: [
            {
              key: "outline",
              label: "Outline",
              width: "minmax(320px, 1fr)",
              children: [outlinePane(model, h)],
            },
            {
              key: "detail",
              label: "Details",
              width: "minmax(340px, 430px)",
              children: [detailPane(model, h)],
            },
          ],
        },
        h,
      ),
      h.div(
        [h.Class("orchestrator__sr-only"), h.Role("status"), h.AriaLive("polite")],
        [model.announcement],
      ),
    ],
  );
});
