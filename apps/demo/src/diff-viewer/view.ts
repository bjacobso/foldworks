import { Check, ChevronRight, CircleCheck, FileCode2, GitPullRequest, MessageSquare, SplitSquareHorizontal, Rows3 } from "@lucide/icons";
import { DiffViewer, diffTotals, selectionLabel, type DiffFile, type DiffSelectionRange, type DiffThreadMarker } from "@foldworks/diff-viewer";
import { Button, Icon } from "@foldworks/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { reviewFiles } from "./fixture";
import { Message } from "./message";
import type { Model, ReviewComment } from "./model";

const statusLabel = (file: DiffFile): string =>
  file.status === "added" ? "Added" : file.status === "deleted" ? "Deleted" : file.status === "renamed" ? "Renamed" : "Modified";

const fileItem = (model: Model, file: DiffFile, h: HtmlBuilder<Message>): Html => {
  const viewed = model.viewedPaths.includes(file.path);
  const commentCount = model.comments.filter((comment) => comment.path === file.path && !comment.resolved).length;
  return h.button([
    h.Type("button"),
    h.Class("review-demo__file"),
    h.DataAttribute("active", model.activePath === file.path ? "true" : "false"),
    h.OnClick(Message.SelectedFile({ path: file.path })),
    h.AriaLabel(`${file.path}, ${statusLabel(file)}, ${file.additions} additions, ${file.deletions} deletions${viewed ? ", viewed" : ""}`),
  ], [
    h.span([h.Class("review-demo__file-state"), h.DataAttribute("status", file.status)], [
      viewed ? Icon.view({ icon: Check, size: 12, strokeWidth: 2.6 }, h) : statusLabel(file).slice(0, 1),
    ]),
    h.span([h.Class("review-demo__file-copy")], [
      h.strong([], [file.path.split("/").pop() ?? file.path]),
      h.span([], [file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "Repository root"]),
    ]),
    h.span([h.Class("review-demo__file-stats")], [
      h.span([h.Class("review-demo__plus")], [`+${file.additions}`]),
      h.span([h.Class("review-demo__minus")], [`−${file.deletions}`]),
      ...(commentCount === 0 ? [] : [h.span([h.Class("review-demo__comment-count")], [String(commentCount)])]),
    ]),
  ]);
};

const navigation = (model: Model, h: HtmlBuilder<Message>): Html => {
  const totals = diffTotals(reviewFiles);
  return h.aside([h.Class("review-demo__navigation"), h.AriaLabel("Changed files")], [
    h.div([h.Class("review-demo__nav-heading")], [
      h.div([], [h.strong([], ["Files changed"]), h.span([], [`${reviewFiles.length}`])]),
      h.p([], [`${totals.additions} additions and ${totals.deletions} deletions`]),
    ]),
    h.div([h.Class("review-demo__progress-track"), h.AriaLabel(`${model.viewedPaths.length} of ${reviewFiles.length} files viewed`)], [
      h.span([h.Style({ width: `${(model.viewedPaths.length / reviewFiles.length) * 100}%` })], []),
    ]),
    h.div([h.Class("review-demo__file-list")], reviewFiles.map((file) => fileItem(model, file, h))),
    h.div([h.Class("review-demo__nav-footer")], [
      h.span([], [`${model.viewedPaths.length} of ${reviewFiles.length} viewed`]),
      h.span([], ["⌘⇧Enter to submit"]),
    ]),
  ]);
};

const modeControl = (model: Model, h: HtmlBuilder<Message>): Html => h.div([
  h.Class("review-demo__mode"),
  h.Role("group"),
  h.AriaLabel("Diff layout"),
], [
  h.button([
    h.Type("button"), h.DataAttribute("active", model.mode === "Split" ? "true" : "false"),
    h.OnClick(Message.ChangedMode({ mode: "Split" })), h.AriaLabel("Side-by-side diff"),
  ], [Icon.view({ icon: SplitSquareHorizontal, size: 14 }, h), "Split"]),
  h.button([
    h.Type("button"), h.DataAttribute("active", model.mode === "Unified" ? "true" : "false"),
    h.OnClick(Message.ChangedMode({ mode: "Unified" })), h.AriaLabel("Unified diff"),
  ], [Icon.view({ icon: Rows3, size: 14 }, h), "Unified"]),
]);

const thread = (comment: ReviewComment, h: HtmlBuilder<Message>): Html => h.article([
  h.Class("review-demo__thread"),
  h.DataAttribute("resolved", comment.resolved ? "true" : "false"),
], [
  h.div([h.Class("review-demo__thread-heading")], [
    h.span([h.Class("review-demo__avatar")], [comment.author === "You" ? "YO" : comment.author.split(" ").map((part) => part[0]).join("")]),
    h.div([], [h.strong([], [comment.author]), h.span([], [selectionLabel(comment)])]),
    h.span([h.Class("review-demo__thread-status")], [comment.resolved ? "Resolved" : "Open"]),
  ]),
  h.p([], [comment.body]),
  h.button([
    h.Type("button"),
    h.Class("review-demo__resolve"),
    h.OnClick(Message.ToggledResolved({ id: comment.id })),
  ], [comment.resolved ? "Reopen thread" : "Resolve thread"]),
]);

const composer = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (model.selectionPath === "" || model.selectionStartLine < 1) {
    return h.div([h.Class("review-demo__comment-empty")], [
      Icon.view({ icon: MessageSquare, size: 18 }, h),
      h.strong([], ["Comment on a line"]),
      h.p([], ["Click a line for one comment, or drag across line numbers to select a range."]),
    ]);
  }
  return h.form([
    h.Class("review-demo__composer"),
    h.OnSubmit(Message.SubmittedComment()),
  ], [
    h.div([h.Class("review-demo__composer-heading")], [
      h.strong([], [selectionLabel({
        path: model.selectionPath,
        side: model.selectionSide,
        startLine: model.selectionStartLine,
        endLine: model.selectionEndLine,
      })]),
      h.span([], [model.selectionPath.split("/").pop() ?? model.selectionPath]),
    ]),
    h.textarea([
      h.AriaLabel("Review comment"),
      h.Placeholder("Leave a clear, actionable comment…"),
      h.Value(model.draft),
      h.OnInput((value) => Message.ChangedDraft({ value })),
    ]),
    h.div([h.Class("review-demo__composer-actions")], [
      Button.view({ label: "Cancel", size: "xs", variant: "ghost", onClick: Message.CancelledComment() }, h),
      Button.view({ label: "Add comment", size: "xs", onClick: Message.SubmittedComment(), isDisabled: model.draft.trim() === "" }, h),
    ]),
  ]);
};

const inspector = (model: Model, h: HtmlBuilder<Message>): Html => {
  const activeComments = model.comments.filter((comment) => comment.path === model.activePath);
  const openCount = model.comments.filter((comment) => !comment.resolved).length;
  return h.aside([h.Class("review-demo__inspector"), h.AriaLabel("Review details")], [
    h.section([h.Class("review-demo__summary")], [
      h.div([h.Class("review-demo__summary-heading")], [
        Icon.view({ icon: GitPullRequest, size: 17 }, h),
        h.div([], [h.strong([], ["Review summary"]), h.span([], ["PR #148 · ready for review"])]),
      ]),
      h.p([], ["Adds line-anchored review comments and scopes Git reads for larger change sets."]),
      h.div([h.Class("review-demo__checks")], [
        h.span([], [Icon.view({ icon: CircleCheck, size: 14 }, h), "3 checks passed"]),
        h.span([], [`${openCount} open ${openCount === 1 ? "thread" : "threads"}`]),
      ]),
    ]),
    h.section([h.Class("review-demo__comment-section")], [
      h.div([h.Class("review-demo__section-heading")], [
        h.strong([], ["Comments"]),
        h.span([], [String(activeComments.length)]),
      ]),
      composer(model, h),
      ...activeComments.map((comment) => thread(comment, h)),
    ]),
  ]);
};

const diffReviewView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const activeFile = reviewFiles.find((file) => file.path === model.activePath) ?? reviewFiles[0];
  if (activeFile === undefined) return h.div([h.Class("review-demo")], ["No diff fixture loaded."]);
  const selectedRange: DiffSelectionRange | undefined = model.selectionPath === "" ? undefined : {
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

  return h.div([h.Class("review-demo"), h.DataAttribute("diff-review-demo", "true")], [
    h.header([h.Class("review-demo__topbar")], [
      h.div([h.Class("review-demo__crumbs")], [
        h.span([], ["foldworks"]), Icon.view({ icon: ChevronRight, size: 12 }, h),
        h.span([], ["feature/inline-reviews"]), Icon.view({ icon: ChevronRight, size: 12 }, h),
        h.strong([], ["Add inline code review comments"]),
      ]),
      h.div([h.Class("review-demo__topbar-actions")], [
        h.span([h.Class("review-demo__position")], [`${activeIndex + 1} / ${reviewFiles.length}`]),
        modeControl(model, h),
      ]),
    ]),
    h.div([h.Class("review-demo__workspace")], [
      navigation(model, h),
      h.main([h.Class("review-demo__canvas")], [
        h.div([h.Class("review-demo__diff-scroll")], [
          DiffViewer.view({
            file: activeFile,
            mode: model.mode,
            ...(selectedRange === undefined ? {} : { selectedRange }),
            threads: markers,
            reviewed: model.viewedPaths.includes(activeFile.path),
            onSelectLine: (selection) => Message.SelectedLine(selection),
            onStartSelection: (selection) => Message.StartedSelection(selection),
            onExtendSelection: (selection, method) => Message.ExtendedSelection({ ...selection, method }),
            onEndSelection: () => Message.EndedSelection(),
            onCancelSelection: () => Message.CancelledComment(),
            onReviewedChange: (viewed) => Message.ToggledViewed({ path: activeFile.path, viewed }),
          }, h),
        ]),
      ]),
      inspector(model, h),
    ]),
  ]);
};

export const view = defineView<Model, Message>((model, h) => diffReviewView(model, h));
