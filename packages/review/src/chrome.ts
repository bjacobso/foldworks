import { Schema as S } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { AppHeader, Badge, ExplanationTree, type ExplanationNode } from "@foldworks/ui";
import type { Author } from "./data";

export const Check = S.Struct({
  id: S.String,
  name: S.String,
  status: S.Literals(["queued", "running", "passed", "failed", "skipped", "cancelled", "neutral"]),
  summary: S.optional(S.String),
  duration: S.optional(S.String),
  detailsHref: S.optional(S.String),
});
export type Check = typeof Check.Type;
export const checkSummary = (checks: readonly Check[]): string =>
  checks.length
    ? (["failed", "running", "queued", "passed", "skipped", "cancelled", "neutral"] as const)
        .flatMap((status) => {
          const count = checks.filter((c) => c.status === status).length;
          return count ? [`${count} ${status}`] : [];
        })
        .join(", ")
    : "No checks";
export const CheckList = {
  view: <Message>(
    config: Readonly<{
      checks: readonly Check[];
      onRerun?: (check: Check) => Message;
      renderDetails?: (check: Check) => Html | undefined;
    }>,
    h: HtmlBuilder<Message>,
  ): Html =>
    h.section(
      [h.Class("fk-review__panel"), h.AriaLabel("Checks")],
      [
        h.h3([], ["Checks"]),
        h.p([h.Role("status"), h.AriaLive("polite")], [checkSummary(config.checks)]),
        h.ul(
          [],
          config.checks.map((check) => {
            const details = config.renderDetails?.(check);
            return h.li(
              [h.DataAttribute("check-status", check.status)],
              [
                h.strong([], [check.name]),
                h.span([], [` · ${check.status}`]),
                ...(check.duration ? [h.span([], [` · ${check.duration}`])] : []),
                ...(check.summary ? [h.p([], [check.summary])] : []),
                ...(check.detailsHref ? [h.a([h.Href(check.detailsHref)], ["Check details"])] : []),
                ...(details ? [h.details([], [h.summary([], ["Show details"]), details])] : []),
                ...(config.onRerun
                  ? [
                      h.button(
                        [
                          h.Type("button"),
                          h.OnClick(config.onRerun(check)),
                          h.AriaLabel(`Re-run ${check.name}`),
                        ],
                        ["Re-run"],
                      ),
                    ]
                  : []),
              ],
            );
          }),
        ),
      ],
    ),
};
export type MergeRequirement<Message> = Readonly<{
  id: string;
  label: string;
  outcome: "met" | "unmet" | "pending" | "bypassable";
  reason: string;
  action?: Readonly<{ label: string; message: Message }>;
  children?: readonly MergeRequirement<Message>[];
}>;
export type MergeStrategy = Readonly<{ id: string; label: string }>;
export const MergeReadiness = {
  view: <Message>(
    config: Readonly<{
      requirements: readonly MergeRequirement<Message>[];
      canMerge: boolean;
      onMerge: Message;
      strategies?: readonly MergeStrategy[];
      strategy?: string;
      onStrategyChange?: (strategy: string) => Message;
    }>,
    h: HtmlBuilder<Message>,
  ): Html => {
    const nodes = (
      requirements: readonly MergeRequirement<Message>[],
    ): readonly ExplanationNode[] =>
      requirements.map((r) => ({
        label: `${r.label} · ${r.outcome}`,
        detail: r.reason,
        outcome: r.outcome === "met" ? "passed" : r.outcome === "unmet" ? "failed" : "unknown",
        ...(r.children ? { children: nodes(r.children) } : {}),
      }));
    const actions = (requirements: readonly MergeRequirement<Message>[]): readonly Html[] =>
      requirements.flatMap((r) => [
        ...(r.action
          ? [h.button([h.Type("button"), h.OnClick(r.action.message)], [r.action.label])]
          : []),
        ...actions(r.children ?? []),
      ]);
    return h.section(
      [h.Class("fk-review__panel"), h.AriaLabel("Merge readiness")],
      [
        h.h3([], ["Merge readiness"]),
        ExplanationTree.view({ label: "Merge requirements", nodes: nodes(config.requirements) }, h),
        ...actions(config.requirements),
        ...(config.strategies?.length && config.onStrategyChange
          ? [
              h.select(
                [
                  h.AriaLabel("Merge strategy"),
                  h.Value(config.strategy ?? ""),
                  h.OnChange(config.onStrategyChange),
                ],
                config.strategies.map((strategy) =>
                  h.option([h.Value(strategy.id)], [strategy.label]),
                ),
              ),
            ]
          : []),
        h.button(
          [h.Type("button"), h.Disabled(!config.canMerge), h.OnClick(config.onMerge)],
          ["Merge change request"],
        ),
      ],
    );
  },
};
export type ChangeRequestStatus = "draft" | "open" | "merged" | "closed";
export const ChangeRequestHeader = {
  view: <Message>(
    config: Readonly<{
      title: string;
      status: ChangeRequestStatus;
      author: Author;
      baseLabel: string;
      headLabel: string;
      actions?: readonly Html[];
    }>,
    h: HtmlBuilder<Message>,
  ): Html =>
    h.div(
      [h.Class("fk-review__header")],
      [
        AppHeader.view(
          {
            title: config.title,
            status: [
              Badge.view(
                { label: config.status, tone: config.status === "merged" ? "info" : "neutral" },
                h,
              ),
            ],
            ...(config.actions ? { actions: config.actions } : {}),
          },
          h,
        ),
        h.p([], [`${config.author.name} proposes ${config.headLabel} → ${config.baseLabel}`]),
      ],
    ),
};
