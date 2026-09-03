import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { Panel, sxAttrs } from "@foldworks/ui";
import { QueryBuilder, validate } from "@foldworks/query-builder";

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

export const view = defineView<Model, Message>((model, h) => {
  const validation = validate(model.builder.query, { attributes, maxDepth: 3, validateValue });
  return h.div([
    ...sxAttrs(h, styles.viewport),
    h.DataAttribute("query-builder-demo", "true"),
  ], [
    h.div(sxAttrs(h, styles.content), [
      h.p(sxAttrs(h, styles.intro), [
        "Compose typed employee filters with nested all/any groups. The same query document drives the editor, validation, and compact display below.",
      ]),
      h.div(sxAttrs(h, styles.preview), [
        h.p(sxAttrs(h, styles.previewLabel), ["Read-only · dense"]),
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
            ? "All conditions are valid."
            : `${validation.issues.length} conditions need attention.`,
          children: [editor(model, h)],
        }, h),
        Panel.view({
          title: "Serializable query",
          description: "Application-owned persistence can store this validated document directly.",
          children: [h.pre(sxAttrs(h, styles.code), [JSON.stringify(model.builder.query, null, 2)])],
        }, h),
      ]),
    ]),
  ]);
});
