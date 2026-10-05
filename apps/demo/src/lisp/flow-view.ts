// A folded workflow shows its flow as a small diagram instead of rows:
// sequences run left to right, parallel branches stack, and each step is a
// button that opens the workflow at that step.

import type { Html, HtmlBuilder } from "foldkit/html";
import type { FoldedView, Row } from "@foldworks/outliner";

import { definedName, type Analysis } from "./analysis";
import { itemOf } from "./codec";
import type { FlowNode } from "./evaluate";
import { Message } from "./message";

type H = HtmlBuilder<Message>;

const nodeView = (node: FlowNode, analysis: Analysis, h: H): Html => {
  switch (node.kind) {
    case "Step": {
      const id = itemOf(node.at);
      const warnings = analysis.warnings.get(id) ?? [];
      return h.button(
        [
          h.Class("lisp-flow__step"),
          h.Type("button"),
          h.DataAttribute("warning", String(warnings.length > 0)),
          h.Title(warnings[0] ?? `${node.step.name} · ${node.step.system}`),
          h.OnClick(Message.ClickedReference({ id })),
        ],
        [
          h.span([h.Class("lisp-flow__name")], [node.step.name]),
          h.span([h.Class("lisp-flow__system")], [node.step.system]),
        ],
      );
    }
    case "Sequence":
      return h.div(
        [h.Class("lisp-flow__sequence")],
        node.children.flatMap((child, index) => [
          ...(index === 0
            ? []
            : [h.span([h.Class("lisp-flow__arrow"), h.AriaHidden(true)], ["→"])]),
          nodeView(child, analysis, h),
        ]),
      );
    case "Parallel":
      return h.div(
        [h.Class("lisp-flow__parallel"), h.Role("group"), h.AriaLabel("In parallel")],
        node.children.map((child) => nodeView(child, analysis, h)),
      );
    case "Branch":
      return h.div(
        [h.Class("lisp-flow__branch"), h.Role("group"), h.AriaLabel(`Only when ${node.label}`)],
        [h.span([h.Class("lisp-flow__label")], [node.label]), nodeView(node.child, analysis, h)],
      );
  }
};

/** A diagram for a folded `workflow` row, or nothing for other rows. */
export const flowView = (row: Row, analysis: Analysis, h: H): FoldedView | null => {
  const expr = analysis.program.exprs.get(row.id);
  const defined = expr === undefined ? undefined : definedName(expr);
  if (defined?.kind !== "workflow") return null;
  const flow = analysis.evaluation.workflows.find((candidate) => candidate.name === defined.name);
  if (flow === undefined) return null;
  return {
    label: `Workflow ${defined.name} as a diagram`,
    content: h.div([h.Class("lisp-flow")], [nodeView(flow.node, analysis, h)]),
  };
};
