import { ReviewThreads, type Thread } from "@foldworks/review";
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
  contextGaps,
  expandContext,
  mapRange,
  diffTotals,
  selectionLabel,
  type DiffFile,
  type DiffSelectionRange,
  type DiffThreadMarker,
} from "@foldworks/diff-viewer";
import { Button, Icon } from "@foldworks/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { reviewFiles, localSource } from "./fixture";
import { Message } from "./message";
import type { Model } from "./model";

const statusLabel = (file: DiffFile): string =>
  file.status === "added"
    ? "Added"
    : file.status === "deleted"
      ? "Deleted"
      : file.status === "renamed"
        ? "Renamed"
        : "Modified";

const fileItem = (model: Model, file: DiffFile, h: HtmlBuilder<Message>): Html => {
  const viewed = model.viewedPaths.includes(file.path);
  const commentCount = model.comments.filter(
    (comment) => comment.path === file.path && !comment.resolved,
  ).length;
  return h.button(
    [
      h.Type("button"),
      h.Class("review-demo__file"),
      h.DataAttribute("active", model.activePath === file.path ? "true" : "false"),
      h.OnClick(Message.SelectedFile({ path: file.path })),
      h.AriaLabel(
        `${file.path}, ${statusLabel(file)}, ${file.additions} additions, ${file.deletions} deletions${viewed ? ", viewed" : ""}`,
      ),
    ],
    [
      h.span(
        [h.Class("review-demo__file-state"), h.DataAttribute("status", file.status)],
        [
          viewed
            ? Icon.view({ icon: Check, size: 12, strokeWidth: 2.6 }, h)
            : statusLabel(file).slice(0, 1),
        ],
      ),
      h.span(
        [h.Class("review-demo__file-copy")],
        [
          h.strong([], [file.path.split("/").pop() ?? file.path]),
          h.span(
            [],
            [
              file.path.includes("/")
                ? file.path.slice(0, file.path.lastIndexOf("/"))
                : "Repository root",
            ],
          ),
        ],
      ),
      h.span(
        [h.Class("review-demo__file-stats")],
        [
          h.span([h.Class("review-demo__plus")], [`+${file.additions}`]),
          h.span([h.Class("review-demo__minus")], [`−${file.deletions}`]),
          ...(commentCount === 0
            ? []
            : [h.span([h.Class("review-demo__comment-count")], [String(commentCount)])]),
        ],
      ),
    ],
  );
};

const navigation = (model: Model, h: HtmlBuilder<Message>): Html => {
  const totals = diffTotals(reviewFiles);
  return h.aside(
    [h.Class("review-demo__navigation"), h.AriaLabel("Changed files")],
    [
      h.div(
        [h.Class("review-demo__nav-heading")],
        [
          h.div([], [h.strong([], ["Files changed"]), h.span([], [`${reviewFiles.length}`])]),
          h.p([], [`${totals.additions} additions and ${totals.deletions} deletions`]),
        ],
      ),
      h.div(
        [
          h.Class("review-demo__progress-track"),
          h.AriaLabel(`${model.viewedPaths.length} of ${reviewFiles.length} files viewed`),
        ],
        [
          h.span(
            [h.Style({ width: `${(model.viewedPaths.length / reviewFiles.length) * 100}%` })],
            [],
          ),
        ],
      ),
      h.div(
        [h.Class("review-demo__file-list")],
        reviewFiles.map((file) => fileItem(model, file, h)),
      ),
      h.div(
        [h.Class("review-demo__nav-footer")],
        [
          h.span([], [`${model.viewedPaths.length} of ${reviewFiles.length} viewed`]),
          h.span([], ["⌘⇧Enter to submit"]),
        ],
      ),
    ],
  );
};

const modeControl = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("review-demo__mode"), h.Role("group"), h.AriaLabel("Diff layout")],
    [
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
        return file?.source ? mapRange(file, item.anchor, file).state : "current";
      })(),
      label: selectionLabel(item.anchor),
      toMessage: (message) => Message.GotReviewThreadsMessage({ message }),
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
  for (const id of model.expandedHunks) {
    const gap = contextGaps(activeFile).find((g) => g.beforeHunkId === id);
    if (gap && activeFile.source) activeFile = expandContext(activeFile, localSource, gap, 20);
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
                  DiffViewer.view(
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
                          Math.max(model.selectionStartLine, model.selectionEndLine) === ref.line
                        )
                          inline.push(composer(model, h));
                        return inline.length ? h.div([], inline) : undefined;
                      },
                      annotations: [
                        {
                          path: activeFile.path,
                          side: "new",
                          startLine: 24,
                          endLine: 24,
                          tone: "info",
                          label: "Local review note",
                        },
                      ],
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
