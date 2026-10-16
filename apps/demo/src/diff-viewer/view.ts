import { Schema as S } from "effect";
import { validate } from "@foldworks/code-editor/structured";
import {
  ReviewThreads,
  ReviewSubmit,
  ReviewerList,
  ChangedFiles,
  CheckList,
  MergeReadiness,
  ChangeRequestHeader,
  type Thread,
  type Verdict,
} from "@foldworks/review";
import {
  Check,
  ChevronRight,
  CircleCheck,
  FileCode2,
  GitPullRequest,
  MessageSquare,
  SplitSquareHorizontal,
  Rows3,
} from "@lucide/icons";
import {
  DiffViewer,
  ValueDiff,
  diffValues,
  diagnosticsToAnnotations,
  diffFile,
  contextGaps,
  expandContext,
  mapRange,
  diffTotals,
  selectionLabel,
  type DiffFile,
  type DiffSelectionRange,
  type DiffThreadMarker,
} from "@foldworks/diff-viewer";
import { Button, Icon, TransactionTimeline } from "@foldworks/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { reviewFiles, localSource } from "./fixture";
import { Message } from "./message";
import type { Model } from "./model";

const navigation = (model: Model, h: HtmlBuilder<Message>): Html =>
  ChangedFiles.view(
    {
      model: model.filesUi,
      files: reviewFiles.map((f) => ({
        ...f,
        viewed: model.viewedPaths.includes(f.path),
        openThreads: model.comments.filter((c) => c.path === f.path && !c.resolved).length,
      })),
      toMessage: (message) => Message.GotChangedFilesMessage({ message }),
    },
    h,
  );

const modeControl = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("review-demo__mode"), h.Role("group"), h.AriaLabel("Diff layout")],
    [
      h.button(
        [
          h.Type("button"),
          h.AriaPressed(String(model.semantic)),
          h.OnClick(Message.ToggledSemantic()),
        ],
        ["Semantic values"],
      ),
      h.button(
        [
          h.Type("button"),
          h.DataAttribute("active", model.mode === "Split" ? "true" : "false"),
          h.OnClick(Message.ChangedMode({ mode: "Split" })),
          h.AriaLabel("Side-by-side diff"),
        ],
        [Icon.view({ icon: SplitSquareHorizontal, size: 14 }, h), "Split"],
      ),
      h.button(
        [
          h.Type("button"),
          h.DataAttribute("active", model.mode === "Unified" ? "true" : "false"),
          h.OnClick(Message.ChangedMode({ mode: "Unified" })),
          h.AriaLabel("Unified diff"),
        ],
        [Icon.view({ icon: Rows3, size: 14 }, h), "Unified"],
      ),
    ],
  );

const hostThreads = (model: Model): readonly Thread<DiffSelectionRange>[] =>
  model.comments
    .filter((c) => !c.threadId)
    .map((comment) => ({
      id: comment.id,
      anchor: comment,
      status: comment.resolved ? "resolved" : "open",
      comments: model.comments
        .filter((c) => c.id === comment.id || c.threadId === comment.id)
        .map((c) => ({
          id: c.id,
          author: { id: c.author, name: c.author },
          body: c.body,
          ...(c.suggestion ? { suggestion: c.suggestion } : {}),
          ...(c.pending !== undefined ? { pending: c.pending } : {}),
          createdAt: "2026-10-16",
        })),
    }));
const thread = (model: Model, item: Thread<DiffSelectionRange>, h: HtmlBuilder<Message>): Html =>
  ReviewThreads.threadView(
    {
      model: model.reviewUi,
      thread: item,
      anchorState: (() => {
        const file = reviewFiles.find((f) => f.path === item.anchor.path);
        return file?.source
          ? mapRange(
              file,
              item.anchor,
              diffFile({
                path: file.path,
                oldText: file.source.oldText,
                newText: model.workingText,
              }),
            ).state
          : "current";
      })(),
      label: selectionLabel(item.anchor),
      toMessage: (message) => Message.GotReviewThreadsMessage({ message }),
      onApplySuggestion: (_, threadId) => Message.AppliedSuggestion({ threadId }),
      canEdit: (comment) => comment.author.id === "You",
      canDelete: (comment) => comment.author.id === "You",
    },
    h,
  );
const composer = (model: Model, h: HtmlBuilder<Message>): Html =>
  ReviewThreads.composerView(
    {
      model: model.reviewUi,
      draftKey: "new",
      targetId: "new",
      kind: "create",
      toMessage: (message) => Message.GotReviewThreadsMessage({ message }),
    },
    h,
  );

const inspector = (model: Model, h: HtmlBuilder<Message>): Html => {
  const activeComments = model.comments.filter((comment) => comment.path === model.activePath);
  const openCount = model.comments.filter((comment) => !comment.resolved).length;
  return h.aside(
    [h.Class("review-demo__inspector"), h.AriaLabel("Review details")],
    [
      h.section(
        [h.Class("review-demo__summary")],
        [
          h.div(
            [h.Class("review-demo__summary-heading")],
            [
              Icon.view({ icon: GitPullRequest, size: 17 }, h),
              h.div(
                [],
                [h.strong([], ["Review summary"]), h.span([], ["PR #148 · ready for review"])],
              ),
            ],
          ),
          h.p(
            [],
            ["Adds line-anchored review comments and scopes Git reads for larger change sets."],
          ),
          h.div(
            [h.Class("review-demo__checks")],
            [
              h.span([], [Icon.view({ icon: CircleCheck, size: 14 }, h), "3 checks passed"]),
              h.span([], [`${openCount} open ${openCount === 1 ? "thread" : "threads"}`]),
            ],
          ),
        ],
      ),
      CheckList.view(
        {
          checks: [
            { id: "schema", name: "Example local schema check", status: "passed" },
            { id: "policy", name: "Example local policy check", status: "passed" },
          ],
        },
        h,
      ),
      MergeReadiness.view(
        {
          requirements: [
            {
              id: "approval",
              label: "Approval",
              outcome: model.submittedVerdict === "approve" ? "met" : "unmet",
              reason: "A local reviewer must approve.",
            },
            {
              id: "threads",
              label: "Discussion",
              outcome: model.comments.some((c) => !c.resolved) ? "unmet" : "met",
              reason: "Resolve open threads.",
            },
          ],
          canMerge:
            model.requestStatus === "open" &&
            model.submittedVerdict === "approve" &&
            !model.comments.some((c) => !c.resolved),
          onMerge: Message.MergedRequest(),
        },
        h,
      ),
      TransactionTimeline.view({ label: "Activity", entries: model.activity }, h),
      ReviewSubmit.view(
        {
          summary: model.reviewSummary,
          verdict: model.verdict,
          pendingCount: model.comments.filter((c) => c.pending).length,
          allowedVerdicts: ["comment", "approve", "request-changes"],
          onSummaryChange: (summary) => Message.ChangedReviewSummary({ summary }),
          onVerdictChange: (verdict) => Message.ChoseVerdict({ verdict }),
          onSubmit: Message.SubmittedReview(),
        },
        h,
      ),
      ReviewerList.view(
        {
          reviewers: [
            {
              author: { id: "local-reviewer", name: "Local reviewer" },
              required: true,
              ...(model.submittedVerdict ? { verdict: model.submittedVerdict as Verdict } : {}),
            },
          ],
        },
        h,
      ),
      h.section(
        [h.Class("review-demo__comment-section")],
        [
          h.div(
            [h.Class("review-demo__section-heading")],
            [h.strong([], ["Comments"]), h.span([], [String(activeComments.length)])],
          ),
          ReviewThreads.listView(
            {
              model: model.reviewUi,
              threads: hostThreads(model),
              groupBy: (t) => t.anchor.path,
              toMessage: (message) => Message.GotReviewThreadsMessage({ message }),
            },
            h,
          ),
        ],
      ),
    ],
  );
};

const diffReviewView = (model: Model, h: HtmlBuilder<Message>): Html => {
  let activeFile = reviewFiles.find((file) => file.path === model.activePath) ?? reviewFiles[0];
  if (activeFile === undefined) return h.div([h.Class("review-demo")], ["No diff fixture loaded."]);
  if (activeFile.source)
    activeFile = diffFile({
      path: activeFile.path,
      oldText: localSource.oldText,
      newText: model.workingText,
      context: 2,
    });
  for (const id of model.expandedHunks) {
    const gap = contextGaps(activeFile).find((g) => g.beforeHunkId === id);
    if (gap && activeFile.source)
      activeFile = expandContext(
        activeFile,
        { oldText: localSource.oldText, newText: model.workingText },
        gap,
        20,
      );
  }
  const selectedRange: DiffSelectionRange | undefined =
    model.selectionPath === ""
      ? undefined
      : {
          path: model.selectionPath,
          side: model.selectionSide,
          startLine: model.selectionStartLine,
          endLine: model.selectionEndLine,
        };
  const markers: DiffThreadMarker[] = model.comments.map((comment) => ({
    path: comment.path,
    side: comment.side,
    startLine: comment.startLine,
    endLine: comment.endLine,
    count: 1,
    resolved: comment.resolved,
  }));
  const activeIndex = reviewFiles.findIndex((file) => file.path === activeFile.path);

  return h.div(
    [h.Class("review-demo"), h.DataAttribute("diff-review-demo", "true")],
    [
      ChangeRequestHeader.view(
        {
          title: "Review configuration changes",
          status: model.requestStatus,
          author: { id: "author", name: "Local author" },
          baseLabel: "saved",
          headLabel: "working copy",
        },
        h,
      ),
      h.header(
        [h.Class("review-demo__topbar")],
        [
          h.div(
            [h.Class("review-demo__crumbs")],
            [
              h.span([], ["foldworks"]),
              Icon.view({ icon: ChevronRight, size: 12 }, h),
              h.span([], ["feature/inline-reviews"]),
              Icon.view({ icon: ChevronRight, size: 12 }, h),
              h.strong([], ["Add inline code review comments"]),
            ],
          ),
          h.div(
            [h.Class("review-demo__topbar-actions")],
            [
              h.span(
                [h.Class("review-demo__position")],
                [`${activeIndex + 1} / ${reviewFiles.length}`],
              ),
              modeControl(model, h),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("review-demo__workspace")],
        [
          navigation(model, h),
          h.main(
            [h.Class("review-demo__canvas")],
            [
              h.div(
                [h.Class("review-demo__diff-scroll")],
                [
                  model.semantic && activeFile.source
                    ? ValueDiff.view(
                        {
                          changes: diffValues(
                            Object.fromEntries(
                              localSource.oldText
                                .trim()
                                .split("\n")
                                .map((l) => [l.split(": ")[0]!, l.endsWith("true")]),
                            ),
                            Object.fromEntries(
                              model.workingText
                                .trim()
                                .split("\n")
                                .map((l) => [l.split(": ")[0]!, l.endsWith("true")]),
                            ),
                          ),
                        },
                        h,
                      )
                    : DiffViewer.view(
                        {
                          file: activeFile,
                          ...(activeFile.source
                            ? {
                                onExpandGap: (gap: import("@foldworks/diff-viewer").DiffGap) =>
                                  Message.ExpandedContext({ beforeHunkId: gap.beforeHunkId }),
                              }
                            : {}),
                          mode: model.mode,
                          ...(selectedRange === undefined ? {} : { selectedRange }),
                          threads: markers,
                          lineWidgets: (ref) => {
                            const inline = hostThreads(model)
                              .filter(
                                (t) =>
                                  t.anchor.path === ref.path &&
                                  t.anchor.side === ref.side &&
                                  t.anchor.endLine === ref.line,
                              )
                              .map((t) => thread(model, t, h));
                            if (
                              model.reviewUi.composerKey === "new" &&
                              model.selectionPath === ref.path &&
                              model.selectionSide === ref.side &&
                              Math.max(model.selectionStartLine, model.selectionEndLine) ===
                                ref.line
                            )
                              inline.push(composer(model, h));
                            return inline.length ? h.div([], inline) : undefined;
                          },
                          annotations: activeFile.source
                            ? diagnosticsToAnnotations(
                                activeFile.path,
                                model.workingText,
                                validate(S.Record(S.String, S.Boolean), {
                                  uri: activeFile.path,
                                  session: 1,
                                  revision: 1,
                                  languageId: "yaml",
                                  text: model.workingText,
                                  lineEnding: "lf",
                                }),
                              )
                            : [],
                          reviewed: model.viewedPaths.includes(activeFile.path),
                          onSelectLine: (selection) => Message.SelectedLine(selection),
                          onStartSelection: (selection) => Message.StartedSelection(selection),
                          onExtendSelection: (selection, method) =>
                            Message.ExtendedSelection({ ...selection, method }),
                          onEndSelection: () => Message.EndedSelection(),
                          onCancelSelection: () => Message.CancelledComment(),
                          onReviewedChange: (viewed) =>
                            Message.ToggledViewed({ path: activeFile.path, viewed }),
                        },
                        h,
                      ),
                ],
              ),
            ],
          ),
          inspector(model, h),
        ],
      ),
    ],
  );
};

export const view = defineView<Model, Message>((model, h) => diffReviewView(model, h));
