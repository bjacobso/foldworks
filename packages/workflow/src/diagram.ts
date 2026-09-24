import type { DiagramDocument, DiagramEdge, DiagramNode } from "@foldworks/diagram";

import type { ElementShape, Flow, WorkflowDocument } from "./structured";

export type WorkflowEdgeData =
  | Readonly<{ kind: "Sequence"; flowId: string }>
  | Readonly<{ kind: "Branch"; flowId: string; label: string }>
  | Readonly<{ kind: "Merge"; flowId: string; label: string }>;

/** Converts a structured workflow into a normalized diagram: one node per
 *  element and explicit edges for sequence, branch entry, and branch merge.
 *  Nested flows are flattened into topology, so the result is a DAG that
 *  graph tooling (validation, export, other layouts) can consume. Node data
 *  keeps the original element, including its branches. */
export const toDiagramDocument = <Node extends ElementShape<Node>>(
  document: WorkflowDocument<Node>,
): DiagramDocument<Node, WorkflowEdgeData, never> => {
  const nodes: DiagramNode<Node>[] = [];
  const edges: DiagramEdge<WorkflowEdgeData>[] = [];

  /** Converts one flow, connecting its end to `continuation` (the element
   *  that follows the flow's owner), and returns the flow's entry id. */
  const visitFlow = (flow: Flow<Node>, continuation: string | undefined): string | undefined => {
    flow.elements.forEach((element, index) => {
      nodes.push({ id: element.id, data: element });
      const following = flow.elements[index + 1];
      const next = following?.id ?? continuation;
      if (element.branches.length === 0) {
        if (following !== undefined) {
          edges.push({
            id: `sequence:${element.id}:${following.id}`,
            source: { nodeId: element.id },
            target: { nodeId: following.id },
            data: { kind: "Sequence", flowId: flow.id },
          });
        } else if (continuation !== undefined) {
          edges.push({
            id: `merge:${element.id}:${continuation}`,
            source: { nodeId: element.id },
            target: { nodeId: continuation },
            data: { kind: "Merge", flowId: flow.id, label: flow.label },
          });
        }
        return;
      }
      for (const branch of element.branches) {
        const entry = visitFlow(branch, next);
        const target = entry ?? next;
        if (target === undefined) continue;
        edges.push({
          id: `branch:${element.id}:${branch.id}`,
          source: { nodeId: element.id },
          target: { nodeId: target },
          data: { kind: "Branch", flowId: branch.id, label: branch.label },
        });
      }
    });
    return flow.elements[0]?.id;
  };

  visitFlow(document.root, undefined);
  return { nodes, edges, annotations: [] };
};
