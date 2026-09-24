import {
  pathForPoints,
  type DiagramScene,
  type Dimensions,
  type Point,
  type SceneEdge,
  type SceneNode,
} from "@foldworks/diagram";

import type { ElementShape, Flow, FlowLocation, WorkflowDocument } from "./structured";

export { pathForPoints, type Dimensions, type Point };
export type LayoutOrientation = "Vertical" | "Horizontal";

export type LayoutNode = SceneNode;

/** A structured-workflow connector. Sequence connectors carry the flow
 *  location they can insert into; fork and merge connectors carry the
 *  branching element that owns them. */
export type LayoutConnector = SceneEdge &
  Readonly<{
    flowId?: string;
    ownerElementId?: string;
    locationId?: string;
  }>;

export type LayoutInsertion = Readonly<{
  id: string;
  location: FlowLocation;
  x: number;
  y: number;
}>;

export type LayoutBranchLabel = Readonly<{
  id: string;
  text: string;
  flowId: string;
  ownerElementId: string;
  x: number;
  y: number;
}>;

export type LayoutJunction = Readonly<{
  id: string;
  ownerElementId: string;
  x: number;
  y: number;
}>;

/** A diagram scene with structured-workflow overlays: insertion targets,
 *  branch labels, and fork/merge junctions. */
export type StructuredWorkflowLayout = DiagramScene<LayoutConnector> &
  Readonly<{
    width: number;
    height: number;
    insertions: ReadonlyArray<LayoutInsertion>;
    branchLabels: ReadonlyArray<LayoutBranchLabel>;
    junctions: ReadonlyArray<LayoutJunction>;
  }>;

export type StructuredLayoutConfig<Node> = Readonly<{
  nodeSize: (node: Node) => Dimensions;
  orientation?: LayoutOrientation;
  gap?: number;
  branchGap?: number;
  branchPadding?: number;
  branchMinimumWidth?: number;
  marginX?: number;
  marginY?: number;
  minimumWidth?: number;
  minimumHeight?: number;
}>;

type MeasuredElement<Node> = Readonly<{
  node: Node;
  nodeSize: Dimensions;
  width: number;
  height: number;
  branchHeight: number;
  branches: ReadonlyArray<MeasuredFlow<Node>>;
}>;

type MeasuredFlow<Node> = Readonly<{
  flow: Flow<Node>;
  width: number;
  height: number;
  elements: ReadonlyArray<MeasuredElement<Node>>;
}>;

const createVerticalStructuredLayout = <Node extends ElementShape<Node>>(
  config: StructuredLayoutConfig<Node>,
) => {
  const gap = config.gap ?? 74;
  const branchGap = config.branchGap ?? 52;
  const branchPadding = config.branchPadding ?? 58;
  const branchMinimumWidth = config.branchMinimumWidth ?? 146;
  const marginX = config.marginX ?? 64;
  const marginY = config.marginY ?? 42;

  const measureFlow = (flow: Flow<Node>, isBranch: boolean): MeasuredFlow<Node> => {
    const elements = flow.elements.map(measureElement);
    const contentWidth = elements.reduce((width, element) => Math.max(width, element.width), 0);
    const contentHeight = elements.reduce(
      (height, element, index) => height + element.height + (index === 0 ? 0 : gap),
      0,
    );
    const boundaryHeight = isBranch ? gap * 2 : 0;
    return {
      flow,
      elements,
      width: Math.max(contentWidth, isBranch ? branchMinimumWidth : 0),
      height: Math.max(contentHeight + boundaryHeight, isBranch ? gap * 2 : 0),
    };
  };

  const measureElement = (node: Node): MeasuredElement<Node> => {
    const nodeSize = config.nodeSize(node);
    const branches = node.branches.map((branch) => measureFlow(branch, true));
    if (branches.length === 0) {
      return {
        node,
        nodeSize,
        width: nodeSize.width,
        height: nodeSize.height,
        branchHeight: 0,
        branches,
      };
    }
    const branchWidth =
      branches.reduce((width, branch) => width + branch.width, 0) +
      branchGap * Math.max(0, branches.length - 1);
    const branchHeight = branches.reduce((height, branch) => Math.max(height, branch.height), 0);
    return {
      node,
      nodeSize,
      width: Math.max(nodeSize.width, branchWidth),
      height: nodeSize.height + branchPadding + branchHeight + branchPadding,
      branchHeight,
      branches,
    };
  };

  return (document: WorkflowDocument<Node>): StructuredWorkflowLayout => {
    const measured = measureFlow(document.root, false);
    const contentWidth = measured.width;
    const width = Math.max(contentWidth + marginX * 2, config.minimumWidth ?? 720);
    const contentOffsetX = (width - contentWidth) / 2;
    const nodes = new Map<string, LayoutNode>();
    const connectors: LayoutConnector[] = [];
    const insertions: LayoutInsertion[] = [];
    const branchLabels: LayoutBranchLabel[] = [];
    const junctions: LayoutJunction[] = [];

    const addConnection = (id: string, points: ReadonlyArray<Point>, location?: FlowLocation) => {
      const locationId = location === undefined ? undefined : flowLocationId(location);
      connectors.push({
        id,
        points,
        ...(location === undefined ? {} : { flowId: location.flowId }),
        ...(locationId === undefined ? {} : { locationId }),
      });
      if (location !== undefined) {
        const start = points[0];
        const end = points[points.length - 1];
        if (start !== undefined && end !== undefined) {
          insertions.push({
            id: locationId ?? flowLocationId(location),
            location,
            x: start.x + (end.x - start.x) / 2,
            y: start.y + (end.y - start.y) / 2,
          });
        }
      }
    };

    const layoutElement = (
      element: MeasuredElement<Node>,
      centerX: number,
      top: number,
    ): Readonly<{ exit: Point }> => {
      const node = element.node;
      const nodeX = centerX - element.nodeSize.width / 2;
      nodes.set(node.id, {
        id: node.id,
        x: nodeX,
        y: top,
        width: element.nodeSize.width,
        height: element.nodeSize.height,
        depth: 0,
        isContainer: false,
        contentOrigin: { x: nodeX, y: top },
        ports: [],
      });
      const nodeBottom = top + element.nodeSize.height;
      if (element.branches.length === 0) return { exit: { x: centerX, y: nodeBottom } };

      const branchEntryY = nodeBottom + branchPadding;
      const mergeY = branchEntryY + element.branchHeight + branchPadding;
      const forkY = nodeBottom + branchPadding / 2;
      const mergeBusY = mergeY - branchPadding / 2;
      const branchAreaWidth = element.branches.reduce(
        (branchWidth, branch) => branchWidth + branch.width,
        branchGap * Math.max(0, element.branches.length - 1),
      );
      let branchLeft = centerX - branchAreaWidth / 2;
      const branchCenters: number[] = [];

      for (const branch of element.branches) {
        const branchCenter = branchLeft + branch.width / 2;
        branchCenters.push(branchCenter);
        branchLabels.push({
          id: `branch-label:${branch.flow.id}`,
          text: branch.flow.label,
          flowId: branch.flow.id,
          ownerElementId: node.id,
          x: branchCenter,
          y: nodeBottom + branchPadding * 0.56,
        });
        connectors.push({
          id: `fork:${node.id}:${branch.flow.id}`,
          ownerElementId: node.id,
          points: [
            { x: centerX, y: nodeBottom },
            { x: centerX, y: forkY },
            { x: branchCenter, y: forkY },
            { x: branchCenter, y: branchEntryY },
          ],
        });
        layoutFlow(branch, branchCenter, branchEntryY, element.branchHeight, true);
        connectors.push({
          id: `merge:${node.id}:${branch.flow.id}`,
          ownerElementId: node.id,
          points: [
            { x: branchCenter, y: branchEntryY + element.branchHeight },
            { x: branchCenter, y: mergeBusY },
            { x: centerX, y: mergeBusY },
            { x: centerX, y: mergeY },
          ],
        });
        branchLeft += branch.width + branchGap;
      }
      if (branchCenters.length > 1) {
        junctions.push(
          {
            id: `junction:${node.id}:fork`,
            ownerElementId: node.id,
            x: centerX,
            y: forkY,
          },
          {
            id: `junction:${node.id}:merge`,
            ownerElementId: node.id,
            x: centerX,
            y: mergeBusY,
          },
        );
      }
      return { exit: { x: centerX, y: mergeY } };
    };

    const layoutFlow = (
      flow: MeasuredFlow<Node>,
      centerX: number,
      top: number,
      forcedHeight: number,
      isBranch: boolean,
    ): Readonly<{ exit: Point }> => {
      let cursorY = top;
      let previousExit: Point | undefined;
      if (isBranch) cursorY += gap;

      for (const [index, element] of flow.elements.entries()) {
        if (index > 0) cursorY += gap;
        const nodeTop = cursorY;
        if (previousExit !== undefined) {
          const location = { flowId: flow.flow.id, index };
          addConnection(
            `flow:${flow.flow.id}:${index}`,
            [previousExit, { x: centerX, y: nodeTop }],
            location,
          );
        } else if (isBranch) {
          const location = { flowId: flow.flow.id, index: 0 };
          addConnection(
            `flow:${flow.flow.id}:0`,
            [
              { x: centerX, y: top },
              { x: centerX, y: nodeTop },
            ],
            location,
          );
        }
        const result = layoutElement(element, centerX, nodeTop);
        previousExit = result.exit;
        cursorY = nodeTop + element.height;
      }

      const endY = top + forcedHeight;
      if (isBranch) {
        const start = previousExit ?? { x: centerX, y: top };
        const location = { flowId: flow.flow.id, index: flow.elements.length };
        addConnection(
          `flow:${flow.flow.id}:${flow.elements.length}`,
          [start, { x: centerX, y: endY }],
          location,
        );
      }
      return { exit: previousExit ?? { x: centerX, y: endY } };
    };

    layoutFlow(measured, contentOffsetX + contentWidth / 2, marginY, measured.height, false);

    const height = Math.max(measured.height + marginY * 2, config.minimumHeight ?? 620);
    return {
      bounds: { x: 0, y: 0, width, height },
      width,
      height,
      nodes,
      edges: connectors,
      annotations: [],
      insertions,
      branchLabels,
      junctions,
    };
  };
};

const transposePoint = ({ x, y }: Point): Point => ({ x: y, y: x });

const transposeLayout = (layout: StructuredWorkflowLayout): StructuredWorkflowLayout => ({
  bounds: {
    x: layout.bounds.y,
    y: layout.bounds.x,
    width: layout.bounds.height,
    height: layout.bounds.width,
  },
  width: layout.height,
  height: layout.width,
  nodes: new Map(
    [...layout.nodes].map(([id, node]) => [
      id,
      {
        ...node,
        x: node.y,
        y: node.x,
        width: node.height,
        height: node.width,
        contentOrigin: transposePoint(node.contentOrigin),
      },
    ]),
  ),
  edges: layout.edges.map((connector) => ({
    ...connector,
    points: connector.points.map(transposePoint),
  })),
  annotations: layout.annotations,
  insertions: layout.insertions.map((insertion) => ({
    ...insertion,
    x: insertion.y,
    y: insertion.x,
  })),
  branchLabels: layout.branchLabels.map((label) => ({
    ...label,
    x: label.y,
    y: label.x,
  })),
  junctions: layout.junctions.map((junction) => ({
    ...junction,
    x: junction.y,
    y: junction.x,
  })),
});

export const createStructuredLayout = <Node extends ElementShape<Node>>(
  config: StructuredLayoutConfig<Node>,
) => {
  if ((config.orientation ?? "Vertical") === "Vertical") {
    return createVerticalStructuredLayout(config);
  }

  const {
    orientation: _orientation,
    nodeSize,
    marginX,
    marginY,
    minimumWidth,
    minimumHeight,
    ...sharedConfig
  } = config;
  const rotatedLayout = createVerticalStructuredLayout<Node>({
    ...sharedConfig,
    nodeSize: (node: Node) => {
      const size = nodeSize(node);
      return { width: size.height, height: size.width };
    },
    ...(marginY === undefined ? {} : { marginX: marginY }),
    ...(marginX === undefined ? {} : { marginY: marginX }),
    ...(minimumHeight === undefined ? {} : { minimumWidth: minimumHeight }),
    ...(minimumWidth === undefined ? {} : { minimumHeight: minimumWidth }),
  });
  return (document: WorkflowDocument<Node>) => transposeLayout(rotatedLayout(document));
};

export const FLOW_TARGET_PREFIX = "flow-target:";
export const FLOW_CONTAINER_PREFIX = "flow-container:";

export const flowLocationId = (location: FlowLocation): string =>
  `${FLOW_TARGET_PREFIX}${encodeURIComponent(location.flowId)}:${location.index}`;

export const flowLocationFromId = (value: string): FlowLocation | undefined => {
  if (!value.startsWith(FLOW_TARGET_PREFIX)) return undefined;
  const encoded = value.slice(FLOW_TARGET_PREFIX.length);
  const separator = encoded.lastIndexOf(":");
  if (separator < 0) return undefined;
  const index = Number(encoded.slice(separator + 1));
  if (!Number.isInteger(index) || index < 0) return undefined;
  try {
    return { flowId: decodeURIComponent(encoded.slice(0, separator)), index };
  } catch {
    return undefined;
  }
};

export const flowContainerId = (flowId: string): string =>
  `${FLOW_CONTAINER_PREFIX}${encodeURIComponent(flowId)}`;

export const flowIdFromContainerId = (value: string): string | undefined => {
  if (!value.startsWith(FLOW_CONTAINER_PREFIX)) return undefined;
  const encodedFlowId = value.slice(FLOW_CONTAINER_PREFIX.length);
  if (encodedFlowId.length === 0) return undefined;
  try {
    return decodeURIComponent(encodedFlowId);
  } catch {
    return undefined;
  }
};
