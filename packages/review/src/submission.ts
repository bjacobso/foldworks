import { Schema as S } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { Author } from "./data";

export const Verdict = S.Literals(["comment", "approve", "request-changes"]);
export type Verdict = typeof Verdict.Type;
export type ReviewSubmitConfig<Message> = Readonly<{
  summary: string;
  verdict: Verdict;
  pendingCount: number;
  allowedVerdicts: readonly Verdict[];
  onSummaryChange: (summary: string) => Message;
  onVerdictChange: (verdict: Verdict) => Message;
  onSubmit: Message;
  isSubmitting?: boolean;
}>;
export const ReviewSubmit = {
  view: <Message>(config: ReviewSubmitConfig<Message>, h: HtmlBuilder<Message>): Html =>
    h.form(
      [h.Class("fk-review__panel"), h.AriaLabel("Submit review"), h.OnSubmit(config.onSubmit)],
      [
        h.h3([], ["Submit review"]),
        h.p([h.Role("status")], [`${config.pendingCount} pending comments`]),
        h.textarea([
          h.AriaLabel("Review summary"),
          h.Value(config.summary),
          h.OnInput(config.onSummaryChange),
        ]),
        h.div(
          [h.Role("group"), h.AriaLabel("Review verdict")],
          config.allowedVerdicts.map((verdict) =>
            h.button(
              [
                h.Type("button"),
                h.AriaPressed(String(config.verdict === verdict)),
                h.Disabled(config.isSubmitting === true),
                h.OnClick(config.onVerdictChange(verdict)),
              ],
              [
                verdict === "request-changes"
                  ? "Request changes"
                  : verdict === "approve"
                    ? "Approve"
                    : "Comment",
              ],
            ),
          ),
        ),
        h.button(
          [
            h.Type("submit"),
            h.Disabled(
              config.isSubmitting === true || !config.allowedVerdicts.includes(config.verdict),
            ),
          ],
          [config.isSubmitting ? "Submitting…" : "Submit review"],
        ),
      ],
    ),
};
export type Reviewer = Readonly<{
  author: Author;
  verdict?: Verdict;
  required?: boolean;
  ownedFileCount?: number;
}>;
export const ReviewerList = {
  view: <Message>(
    config: Readonly<{ reviewers: readonly Reviewer[]; label?: string }>,
    h: HtmlBuilder<Message>,
  ): Html =>
    h.section(
      [h.Class("fk-review__panel"), h.AriaLabel(config.label ?? "Reviewers")],
      [
        h.h3([], [config.label ?? "Reviewers"]),
        h.ul(
          [],
          config.reviewers.map((reviewer) =>
            h.li(
              [h.DataAttribute("verdict", reviewer.verdict ?? "requested")],
              [
                h.strong([], [reviewer.author.name]),
                h.span([], [` · ${reviewer.verdict ?? "requested"}`]),
                ...(reviewer.required ? [h.span([], [" · required"])] : []),
                ...(reviewer.ownedFileCount !== undefined
                  ? [h.span([], [` · owner of ${reviewer.ownedFileCount} files`])]
                  : []),
              ],
            ),
          ),
        ),
      ],
    ),
};
