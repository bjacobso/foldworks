import {
  DiffViewer,
  diffFile,
  ValueDiff,
  diffValues,
  diagnosticsToAnnotations,
  contextGaps,
  expandContext,
  normalizeSelection,
  selectionLabel,
  type DiffLineRef,
} from "foldworks/diff-viewer";
import { CodeEditor } from "foldworks/code-editor";
import {
  ChangedFiles,
  CheckList,
  MergeReadiness,
  ChangeRequestHeader,
  ReviewThreads,
  ReviewSubmit,
  ReviewerList,
} from "foldworks/review";
import { TransactionTimeline, ChangeSetPreview } from "foldworks/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import type { Model, ReviewThread } from "./model";
import { Message } from "./message";
import { author, reviewer } from "./fixture";
import {
  currentFile,
  fileDiff,
  changedFiles,
  diagnostics,
  checks,
  mappedThread,
  approved,
  openCurrentThreads,
  canMerge,
  parseValue,
  reviewHighlight,
} from "./domain";

const button = (label: string, message: Message, h: HtmlBuilder<Message>, disabled = false) =>
  h.button(
    [h.Type("button"), h.Class("cr-demo__button"), h.OnClick(message), h.Disabled(disabled)],
    [label],
  );
const threadView = (model: Model, thread: ReviewThread, h: HtmlBuilder<Message>): Html => {
  const mapping = mappedThread(model, thread);
  return h.div(
    [h.Id(`review-thread-${thread.id}`), h.Tabindex(-1)],
    [
      ReviewThreads.threadView(
        {
          model: model.reviewUi,
          thread,
          readOnly: model.status !== "open",
          anchorState: mapping.state,
          label: `${selectionLabel(mapping.state === "outdated" ? thread.anchor : mapping.range)} · ${thread.anchor.path.split("/").at(-1)}`,
          toMessage: (message) => Message.GotThreadsMessage({ message }),
          canEdit: (c) => model.status === "open" && c.author.id === model.actor,
          canDelete: (c) => model.status === "open" && c.author.id === model.actor,
          ...(model.actor === "author" &&
          model.status === "open" &&
          thread.status === "open" &&
          !thread.comments.some((c) => c.pending)
            ? {
                onApplySuggestion: (
                  suggestion: import("foldworks/review").Suggestion,
                  threadId: string,
                ) => Message.AppliedSuggestion({ suggestion, threadId }),
              }
            : {}),
        },
        h,
      ),
    ],
  );
};
const lineWidgets = (model: Model, ref: DiffLineRef, h: HtmlBuilder<Message>): Html | undefined => {
  const items = model.threads.flatMap((thread) => {
    const mapping = mappedThread(model, thread);
    return mapping.state !== "outdated" &&
      mapping.range.path === ref.path &&
      mapping.range.side === ref.side &&
      mapping.range.endLine === ref.line
      ? [threadView(model, thread, h)]
      : [];
  });
  const key = model.reviewUi.composerKey,
    anchor = model.draftAnchors[key];
  if (
    key.startsWith("new:") &&
    anchor &&
    anchor.path === ref.path &&
    anchor.side === ref.side &&
    anchor.endLine === ref.line
  )
    items.push(
      h.strong([], [selectionLabel(anchor)]),
      ReviewThreads.composerView(
        {
          model: model.reviewUi,
          draftKey: key,
          targetId: key,
          kind: "create",
          toMessage: (message) => Message.GotThreadsMessage({ message }),
          ...(anchor.side === "new"
            ? {
                suggestionAnchor: {
                  path: anchor.path,
                  startLine: anchor.startLine,
                  endLine: anchor.endLine,
                  expected: anchor.revisionText
                    .replace(/\n$/, "")
                    .split("\n")
                    .slice(anchor.startLine - 1, anchor.endLine)
                    .join("\n"),
                },
              }
            : {}),
        },
        h,
      ),
    );
  return items.length ? h.div([], items) : undefined;
};
const canvas = (model: Model, h: HtmlBuilder<Message>): Html => {
  const file = currentFile(model),
    before = parseValue(file.baseText),
    after = parseValue(file.text);
  let diff = fileDiff(file);
  const revealed = model.threads.find(
    (t) => t.id === model.reviewUi.activeThreadId && t.anchor.path === file.path,
  );
  if (revealed && mappedThread(model, revealed).state !== "outdated")
    diff = diffFile({
      path: file.path,
      oldText: file.baseText,
      newText: file.text,
      context: Math.max(file.baseText.length, file.text.length),
    });
  for (const id of model.expandedGaps) {
    const gap = contextGaps(diff).find((g) => g.beforeHunkId === id);
    if (gap) diff = expandContext(diff, { oldText: file.baseText, newText: file.text }, gap, 20);
  }
  return h.main(
    [h.Class("cr-demo__canvas")],
    [
      h.section(
        [h.Class("cr-demo__editor")],
        [
          h.div(
            [h.Class("cr-demo__section-heading")],
            [
              h.h2(
                [],
                [model.actor === "author" ? "Working configuration" : "Proposed configuration"],
              ),
              h.span(
                [],
                [
                  model.actor === "author" && model.status !== "merged"
                    ? "Editable · Effect schema"
                    : "Read only",
                ],
              ),
            ],
          ),
          CodeEditor.view(
            {
              model: {
                ...model.editor,
                options: {
                  ...model.editor.options,
                  theme: model.dark ? "dark" : "light",
                  readOnly: model.actor !== "author" || model.status === "merged",
                },
              },
              label: "Configuration source",
              meta: file.path,
              showToolbar: false,
              showInspector: false,
              toParentMessage: (message) => Message.GotEditorMessage({ message }),
            },
            h,
          ),
        ],
      ),
      h.section(
        [h.Class("cr-demo__diff")],
        [
          h.div(
            [h.Class("cr-demo__section-heading")],
            [
              h.h2([], ["Review changes"]),
              h.div(
                [h.Class("cr-demo__toolbar"), h.Role("group"), h.AriaLabel("Diff layout")],
                [
                  button(
                    model.semantic ? "Line diff" : "Semantic values",
                    Message.ToggledSemantic(),
                    h,
                  ),
                  button("Unified diff", Message.ChangedMode({ mode: "Unified" }), h),
                  button("Side-by-side diff", Message.ChangedMode({ mode: "Split" }), h),
                ],
              ),
            ],
          ),
          model.semantic && before !== undefined && after !== undefined
            ? ValueDiff.view({ changes: diffValues(before, after) }, h)
            : model.semantic
              ? h.p([], ["Fix syntax before comparing decoded values."])
              : diff.hunks.length
                ? DiffViewer.view(
                    {
                      file: diff,
                      highlight: reviewHighlight,
                      mode: model.mode,
                      ...(model.selection
                        ? { selectedRange: normalizeSelection(model.selection) }
                        : {}),
                      annotations: diagnosticsToAnnotations(
                        file.path,
                        file.text,
                        diagnostics(file),
                      ),
                      threads: model.threads.flatMap((t) => {
                        const mapping = mappedThread(model, t);
                        return mapping.state === "outdated"
                          ? []
                          : [
                              {
                                ...mapping.range,
                                count: t.comments.length,
                                resolved: t.status === "resolved",
                              },
                            ];
                      }),
                      reviewed: model.viewedPaths.includes(file.path),
                      onReviewedChange: (viewed) =>
                        Message.ChangedViewed({ path: file.path, viewed }),
                      ...(model.status === "open"
                        ? {
                            onSelectLine: (ref: DiffLineRef) => Message.SelectedLine(ref),
                            onStartSelection: (ref: DiffLineRef) => Message.StartedSelection(ref),
                            onExtendSelection: (ref: DiffLineRef, method: "Pointer" | "Keyboard") =>
                              Message.ExtendedSelection({ ...ref, method }),
                            onEndSelection: () => Message.EndedSelection(),
                            onCancelSelection: () => Message.CancelledSelection(),
                          }
                        : {}),
                      lineWidgets: (ref) => lineWidgets(model, ref, h),
                      onExpandGap: (gap) => Message.ExpandedGap({ id: gap.beforeHunkId }),
                    },
                    h,
                  )
                : h.p(
                    [h.Class("cr-demo__empty")],
                    [
                      model.status === "merged"
                        ? "Saved configuration matches the merged proposal. See the activity below."
                        : "Edit this file to compare it with the saved configuration.",
                    ],
                  ),
        ],
      ),
      ChangeSetPreview.view(
        {
          label: "Local impact preview",
          basis:
            "This fixture changes checkout availability and the configuration approval requirement.",
          consequences: [
            {
              kind: "changed",
              label: "Checkout rollout",
              detail: "The local policy limits the proposed rollout to 25%.",
            },
          ],
          actions: [],
        },
        h,
      ),
      TransactionTimeline.view(
        {
          label: "Change request activity",
          entries: model.activity,
          emptyText: "Open a change request to start its activity history.",
          renderBody: (entry) =>
            entry.kind === "review"
              ? h.p([], ["Reviewer intent recorded by the local host."])
              : undefined,
        },
        h,
      ),
    ],
  );
};
const inspector = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.aside(
    [h.Class("cr-demo__inspector"), h.AriaLabel("Review details")],
    [
      CheckList.view(
        {
          checks: checks(model),
          onRerun: () => Message.ReranChecks(),
          renderDetails: (check) =>
            h.p(
              [],
              [
                check.id === "schema"
                  ? "Synchronous Effect schema validation of JSON source. Runs in this browser."
                  : "An illustrative local rule, evaluated in this browser. The host owns this policy.",
              ],
            ),
        },
        h,
      ),
      ReviewerList.view(
        {
          reviewers: [
            {
              author: reviewer,
              required: true,
              ownedFileCount: 2,
              ...(model.reviews.at(-1) ? { verdict: model.reviews.at(-1)!.verdict } : {}),
            },
          ],
        },
        h,
      ),
      ...(model.status === "open" && model.actor === "reviewer"
        ? [
            ReviewSubmit.view(
              {
                summary: model.summary,
                verdict: model.verdict,
                pendingCount: model.threads
                  .flatMap((t) => t.comments)
                  .filter((c) => c.pending && c.author.id === model.actor).length,
                allowedVerdicts: ["comment", "approve", "request-changes"],
                onSummaryChange: (value) => Message.ChangedSummary({ value }),
                onVerdictChange: (verdict) => Message.ChangedVerdict({ verdict }),
                onSubmit: Message.SubmittedReview(),
              },
              h,
            ),
          ]
        : []),
      MergeReadiness.view(
        {
          requirements: [
            {
              id: "checks",
              label: "Local checks",
              outcome: checks(model).every((c) => c.status === "passed") ? "met" : "unmet",
              reason: "Both local validators must pass.",
              children: checks(model).map((c) => ({
                id: c.id,
                label: c.name,
                outcome: c.status === "passed" ? "met" : "unmet",
                reason: c.summary ?? "",
              })),
            },
            {
              id: "approval",
              label: "Current revision approved",
              outcome: approved(model) ? "met" : "unmet",
              reason: "The reviewer must approve this exact configuration revision.",
            },
            {
              id: "threads",
              label: "Current discussions resolved",
              outcome: openCurrentThreads(model).length ? "unmet" : "met",
              reason:
                "Outdated discussions remain in history and do not block this illustrative policy.",
            },
            {
              id: "pending",
              label: "Pending comments published",
              outcome: model.threads.some((t) => t.comments.some((c) => c.pending))
                ? "unmet"
                : "met",
              reason: "Submit pending review comments.",
            },
          ],
          canMerge: canMerge(model),
          onMerge: Message.Merged(),
          strategies: [{ id: "apply", label: "Apply configuration" }],
          strategy: "apply",
          onStrategyChange: () => Message.CompletedReveal(),
        },
        h,
      ),
      ReviewThreads.listView(
        {
          model: model.reviewUi,
          threads: model.threads,
          groupBy: (t) => t.anchor.path,
          anchorState: (t) => mappedThread(model, t).state,
          toMessage: (message) => Message.GotThreadsMessage({ message }),
        },
        h,
      ),
      ...model.threads
        .filter(
          (t) =>
            model.status === "merged" ||
            mappedThread(model, t).state === "outdated" ||
            !fileDiff(model.files.find((f) => f.path === t.anchor.path)!).hunks.length,
        )
        .map((t) => threadView(model, t, h)),
    ],
  );
export const view = defineView<Model, Message>((model, h) =>
  h.div(
    [
      h.Class("cr-demo"),
      h.DataAttribute("change-request-demo", "true"),
      h.DataAttribute("dark", String(model.dark)),
    ],
    [
      h.div(
        [h.Class("cr-demo__notice")],
        [
          h.strong([], ["LOCAL SIMULATION"]),
          h.span(
            [],
            [
              "Synthetic configuration repository · stored in this browser · no Git provider integration",
            ],
          ),
        ],
      ),
      ChangeRequestHeader.view(
        {
          title: "Roll out the new checkout",
          status: model.status,
          author,
          baseLabel: "saved configuration",
          headLabel: "working proposal",
          actions: [
            button(model.dark ? "Light appearance" : "Dark appearance", Message.ToggledDark(), h),
            button("Reset simulation", Message.Reset(), h),
          ],
        },
        h,
      ),
      h.div(
        [h.Class("cr-demo__toolbar")],
        [
          h.label(
            [],
            [
              "Configuration file ",
              h.select(
                [
                  h.AriaLabel("Configuration file"),
                  h.Value(model.activePath),
                  h.OnChange((path) => Message.SelectedFile({ path })),
                ],
                model.files.map((file) => h.option([h.Value(file.path)], [file.path])),
              ),
            ],
          ),
          h.span(
            [h.Class("cr-demo__actor")],
            [`Acting as ${model.actor === "author" ? "author" : "reviewer"}`],
          ),
          button(
            model.actor === "author" ? "Act as reviewer" : "Act as author",
            Message.SwitchedActor({ actor: model.actor === "author" ? "reviewer" : "author" }),
            h,
            model.status === "draft",
          ),
          ...(model.status === "draft"
            ? [
                button(
                  "Open change request",
                  Message.OpenedRequest(),
                  h,
                  !changedFiles(model).length || checks(model)[0]!.status !== "passed",
                ),
              ]
            : []),
        ],
      ),
      h.p(
        [h.Class("cr-demo__hint")],
        [
          model.status === "draft"
            ? "Edit checkout to true and rollout to 100; try a string for checkout to see schema diagnostics. Then open a change request."
            : "Review tip: select new lines 3–4 and suggest rollout 25 with a reviewedBy field. Arrow keys extend a range; Mod+Enter saves a pending comment.",
        ],
      ),
      h.div(
        [h.Class("cr-demo__workspace")],
        [
          h.aside(
            [h.Class("cr-demo__navigation"), h.AriaLabel("File navigation")],
            [
              ChangedFiles.view(
                {
                  model: model.filesUi,
                  files: changedFiles(model),
                  toMessage: (message) => Message.GotFilesMessage({ message }),
                },
                h,
              ),
              h.p(
                [],
                [`${model.viewedPaths.length} files viewed · ${model.threads.length} discussions`],
              ),
            ],
          ),
          canvas(model, h),
          inspector(model, h),
        ],
      ),
      h.p(
        [h.Role("status"), h.AriaLive("polite"), h.Class("cr-demo__announcement")],
        [model.announcement],
      ),
      ...(model.storageError ? [h.p([h.Role("alert")], [model.storageError])] : []),
    ],
  ),
);
