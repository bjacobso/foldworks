import {
  createStructuredLayout,
  type LayoutOrientation,
  pathForPoints,
  type StructuredWorkflowLayout,
} from "@foldworks/workflow";

import type { WorkflowNode } from "./model";
import { nodeTypes } from "./node-types";

const createLayout = (orientation: LayoutOrientation) =>
  createStructuredLayout<WorkflowNode>({
    nodeSize: (node) => nodeTypes[node.type].size(node),
    orientation,
    gap: 62,
    branchGap: 54,
    branchPadding: 48,
    branchMinimumWidth: 146,
    marginX: 48,
    marginY: 36,
    minimumHeight: 620,
    minimumWidth: 680,
  });

const layouts = {
  Vertical: createLayout("Vertical"),
  Horizontal: createLayout("Horizontal"),
};

export const layoutWorkflow = (
  document: Parameters<typeof layouts.Vertical>[0],
  orientation: LayoutOrientation = "Vertical",
) => layouts[orientation](document);

export { pathForPoints, type StructuredWorkflowLayout };
