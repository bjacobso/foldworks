import {
  createStructuredLayout,
  pathForPoints,
  type StructuredWorkflowLayout,
} from "@foldworks/workflow";

import type { WorkflowNode } from "./model";
import { nodeTypes } from "./node-types";

export const layoutWorkflow = createStructuredLayout<WorkflowNode>({
  nodeSize: (node) => nodeTypes[node.type].size(node),
  gap: 62,
  branchGap: 54,
  branchPadding: 48,
  branchMinimumWidth: 146,
  marginX: 48,
  marginY: 36,
  minimumHeight: 620,
  minimumWidth: 680,
});

export { pathForPoints, type StructuredWorkflowLayout };
