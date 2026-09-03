import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { Panel, sxAttrs } from "@foldworks/ui";
import {
  QueryBuilder,
  validate,
  type QueryGroup,
} from "@foldworks/query-builder";

import { attributes, validateValue } from "./configuration";
import { Message } from "./message";
import type { Model } from "./model";
import { styles } from "./styles";

const editor = (model: Model, h: HtmlBuilder<Message>): Html => h.submodel({
  slotId: "employee-query-builder",
  model: model.builder,
  view: QueryBuilder.view,
  viewInputs: {
    attributes,
    maxDepth: 3,
    label: "Employee filter query",
    validateValue,
  },
  toParentMessage: (message) => Message.GotQueryBuilderMessage({ message }),
});

const queryCounts = (group: QueryGroup): Readonly<{ rules: number; groups: number }> =>
  group.children.reduce(
    (counts, child) => child._tag === "Rule"
      ? { ...counts, rules: counts.rules + 1 }
      : (() => {
          const nested = queryCounts(child);
          return {
            rules: counts.rules + nested.rules,
            groups: counts.groups + nested.groups + 1,
          };
        })(),
    { rules: 0, groups: 0 },
  );

export const view = defineView<Model, Message>((model, h) => {
  const validation = validate(model.builder.query, { attributes, maxDepth: 3, validateValue });
  const counts = queryCounts(model.builder.query);
  return h.div([
    ...sxAttrs(h, styles.viewport),
    h.DataAttribute("query-builder-demo", "true"),
  ], [
    h.div(sxAttrs(h, styles.content), [
      h.div(sxAttrs(h, styles.hero), [
        h.div(sxAttrs(h, styles.heroCopy), [
          h.p(sxAttrs(h, styles.eyebrow), ["Audience logic"]),
          h.h2(sxAttrs(h, styles.title), ["Build precise employee segments"]),
          h.p(sxAttrs(h, styles.intro), [
            "Compose typed filters with nested logic. One Foldkit model drives editing, validation, serialization, and the compact display surface.",
          ]),
        ]),
        h.div(sxAttrs(h, styles.metrics), [
          h.span(sxAttrs(h, styles.metric), [`${counts.rules} conditions`]),
          h.span(sxAttrs(h, styles.metric), [`${counts.groups} nested ${counts.groups === 1 ? "group" : "groups"}`]),
          h.span(sxAttrs(h, styles.metric, styles.metricAccent), [
            h.span([h.AriaHidden(true), ...sxAttrs(h, styles.metricDot)]),
            validation.isValid ? "Ready to run" : `${validation.issues.length} to resolve`,
          ]),
        ]),
      ]),
      h.div(sxAttrs(h, styles.preview), [
        h.span([h.AriaHidden(true), ...sxAttrs(h, styles.previewGlow)]),
        h.div(sxAttrs(h, styles.previewHeader), [
          h.p(sxAttrs(h, styles.previewLabel), ["Live query summary"]),
          h.span(sxAttrs(h, styles.previewHint), ["Read-only · compact density"]),
        ]),
        QueryBuilder.readOnlyView({
          query: model.builder.query,
          attributes,
          label: "Current employee filter",
        }, h),
      ]),
      h.div(sxAttrs(h, styles.split), [
        Panel.view({
          title: "Query editor",
          description: validation.isValid
            ? "All conditions are valid and ready to evaluate."
            : `${validation.issues.length} conditions need attention.`,
          children: [editor(model, h)],
          style: styles.editorPanel,
        }, h),
        Panel.view({
          title: "Serializable model",
          description: "Every interaction produces a validated, portable query document.",
          children: [h.pre(sxAttrs(h, styles.code), [JSON.stringify(model.builder.query, null, 2)])],
          style: styles.codePanel,
        }, h),
      ]),
    ]),
  ]);
});
