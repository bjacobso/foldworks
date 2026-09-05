import * as stylex from "@stylexjs/stylex";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Badge from "./badge";
import { sxAttrs } from "./sx";
import { colors, radii, space, typography } from "./tokens.stylex.js";

const styles = stylex.create({
  stack: { display: "flex", flexDirection: "column", gap: space.md, minWidth: 0 },
  row: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  muted: { color: colors.foregroundMuted, fontSize: typography.sizeSm, lineHeight: 1.5 },
  label: { fontSize: typography.sizeSm, fontWeight: typography.weightSemibold },
  value: { fontSize: typography.sizeXl, fontWeight: typography.weightSemibold, fontVariantNumeric: "tabular-nums" },
  list: { display: "flex", flexDirection: "column", gap: space.md, listStyle: "none", padding: 0, margin: 0 },
  branch: { borderLeftWidth: "1px", borderLeftStyle: "solid", borderLeftColor: colors.border, paddingLeft: space.lg, marginTop: space.sm },
  box: { borderWidth: "1px", borderStyle: "solid", borderColor: colors.border, borderRadius: radii.md, padding: space.md },
  title: { fontSize: typography.sizeMd, fontWeight: typography.weightSemibold, margin: 0 },
  before: { color: colors.foregroundMuted, textDecoration: "line-through" },
  after: { fontWeight: typography.weightSemibold },
});

export type ExplanationNode = Readonly<{
  label: string;
  outcome: "passed" | "failed" | "unknown";
  detail?: string;
  children?: ReadonlyArray<ExplanationNode>;
}>;

const explanation = <Message>(nodes: ReadonlyArray<ExplanationNode>, h: HtmlBuilder<Message>): Html =>
  h.ul(sxAttrs(h, styles.list), nodes.map((node) => h.li([], [
    h.div(sxAttrs(h, styles.row), [
      Badge.view({
        label: node.outcome === "passed" ? "✓ Passed" : node.outcome === "failed" ? "× Failed" : "? Unknown",
        tone: node.outcome === "passed" ? "success" : node.outcome === "failed" ? "danger" : "neutral",
      }, h),
      h.span(sxAttrs(h, styles.label), [node.label]),
    ]),
    ...(node.detail === undefined ? [] : [h.p(sxAttrs(h, styles.muted), [node.detail])]),
    ...(node.children?.length ? [h.div(sxAttrs(h, styles.branch), [explanation(node.children, h)])] : []),
  ])));

export const ExplanationTree = {
  view: <Message>(config: Readonly<{ label: string; nodes: ReadonlyArray<ExplanationNode> }>, h: HtmlBuilder<Message>): Html =>
    h.section([h.AriaLabel(config.label)], [explanation(config.nodes, h)]),
};

export const ValueInspector = {
  view: <Message>(config: Readonly<{
    label: string;
    value: string;
    origin: "Entered" | "Imported" | "Derived";
    freshness: "Current" | "Stale" | "Not evaluated";
    context?: string;
    children?: ReadonlyArray<Html>;
  }>, h: HtmlBuilder<Message>): Html => h.section([
    ...sxAttrs(h, styles.stack), h.AriaLabel(`${config.label} details`),
  ], [
    h.div(sxAttrs(h, styles.row), [
      h.h3(sxAttrs(h, styles.title), [config.label]),
      Badge.view({ label: config.origin }, h),
      Badge.view({ label: config.freshness, tone: config.freshness === "Current" ? "success" : "warning" }, h),
    ]),
    h.p(sxAttrs(h, styles.value), [config.value]),
    ...(config.context === undefined ? [] : [h.p(sxAttrs(h, styles.muted), [config.context])]),
    ...(config.children ?? []),
  ]),
};

export type ValueChange = Readonly<{ label: string; before: string; after: string }>;
export type Consequence = Readonly<{ kind: "added" | "removed" | "changed"; label: string; detail?: string }>;

export const ChangeSetPreview = {
  view: <Message>(config: Readonly<{
    label: string;
    basis: string;
    changes: ReadonlyArray<ValueChange>;
    consequences: ReadonlyArray<Consequence>;
    notices?: ReadonlyArray<string>;
    actions?: ReadonlyArray<Html>;
  }>, h: HtmlBuilder<Message>): Html => h.section([
    ...sxAttrs(h, styles.stack), h.AriaLabel(config.label),
  ], [
    h.h3(sxAttrs(h, styles.title), [config.label]),
    h.p(sxAttrs(h, styles.muted), [config.basis]),
    h.ul(sxAttrs(h, styles.list), config.changes.map((change) => h.li(sxAttrs(h, styles.box), [
      h.div(sxAttrs(h, styles.label), [change.label]),
      h.div(sxAttrs(h, styles.row), [
        h.span(sxAttrs(h, styles.before), [change.before]),
        h.span([h.AriaLabel("changes to")], ["→"]),
        h.span(sxAttrs(h, styles.after), [change.after]),
      ]),
    ]))),
    h.h4(sxAttrs(h, styles.title), ["Consequences"]),
    h.ul(sxAttrs(h, styles.list), config.consequences.map((item) => h.li([], [
      h.div(sxAttrs(h, styles.row), [
        Badge.view({
          label: item.kind === "added" ? "+ Added" : item.kind === "removed" ? "− Removed" : "~ Changed",
          tone: item.kind === "added" ? "info" : "neutral",
        }, h),
        h.span(sxAttrs(h, styles.label), [item.label]),
      ]),
      ...(item.detail === undefined ? [] : [h.p(sxAttrs(h, styles.muted), [item.detail])]),
    ]))),
    ...(config.notices ?? []).map((notice) => h.p(sxAttrs(h, styles.muted), [notice])),
    h.div(sxAttrs(h, styles.row), config.actions ?? []),
  ]),
};

export type TimelineEntry = Readonly<{
  id: string;
  title: string;
  actor: string;
  timestamp: string;
  context: string;
  changes: ReadonlyArray<ValueChange>;
}>;

export const TransactionTimeline = {
  view: <Message>(config: Readonly<{ label: string; entries: ReadonlyArray<TimelineEntry>; emptyText?: string }>, h: HtmlBuilder<Message>): Html =>
    h.section([...sxAttrs(h, styles.stack), h.AriaLabel(config.label)], [
      h.h3(sxAttrs(h, styles.title), [config.label]),
      ...(config.entries.length === 0 ? [h.p(sxAttrs(h, styles.muted), [config.emptyText ?? "No changes recorded."])] : []),
      h.ol(sxAttrs(h, styles.list), config.entries.map((entry) => h.li(sxAttrs(h, styles.box), [
        h.h4(sxAttrs(h, styles.title), [entry.title]),
        h.p(sxAttrs(h, styles.muted), [`${entry.actor} · ${entry.timestamp}`]),
        ...entry.changes.map((change) => h.p(sxAttrs(h, styles.label), [`${change.label}: ${change.before} → ${change.after}`])),
        h.p(sxAttrs(h, styles.muted), [entry.context]),
        h.p(sxAttrs(h, styles.muted), [entry.id]),
      ]))),
    ]),
};
