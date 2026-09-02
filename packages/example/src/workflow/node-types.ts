import type { Html, HtmlBuilder } from "foldkit/html";

import {
  defineNodeTypes,
  type Dimensions,
  type NodeTypeDefinition,
} from "@foldworks/workflow";

import type { Message } from "./message";
import {
  type NodeKind,
  type NodeSize,
  type WorkflowNode,
} from "./model";
import { className, kindStyles, styles } from "./styles";

export type NodeRenderer = (
  node: WorkflowNode,
  h: HtmlBuilder<Message>,
) => ReadonlyArray<Html>;

export type ExampleNodeTypeDefinition = NodeTypeDefinition<
  WorkflowNode,
  NodeRenderer
> & Readonly<{
  label: string;
  symbol: string;
  description: string;
  movable: boolean;
  deletable: boolean;
}>;

export const nodeSizes: Record<NodeSize, Dimensions> = {
  compact: { width: 252, height: 38 },
  default: { width: 252, height: 62 },
  wide: { width: 310, height: 72 },
};

const standardView =
  (label: string, symbol: string) =>
  (node: WorkflowNode, h: HtmlBuilder<Message>): ReadonlyArray<Html> => [
    h.div([h.Class(className(styles.nodeHeader))], [
      h.span([h.Class(className(styles.nodeIdentity))], [
        h.span(
          [h.Class(className(styles.nodeIcon, kindStyles[node.type]))],
          [symbol],
        ),
        h.span([h.Class(className(styles.nodeTitle))], [node.data.title || label]),
      ]),
      node.type === "start" || node.type === "end"
        ? h.empty
        : h.span([h.Class(className(styles.nodeRemoveHint)), h.AriaHidden(true)], ["×"]),
    ]),
    h.p([h.Class(className(styles.nodeDescription))], [
      node.data.description || "There is no text",
    ]),
  ];

const compactView =
  (label: string, symbol: string) =>
  (node: WorkflowNode, h: HtmlBuilder<Message>): ReadonlyArray<Html> => [
    h.div([h.Class(className(styles.nodeHeader, styles.nodeHeaderCompact))], [
      h.span([h.Class(className(styles.nodeIdentity))], [
        h.span(
          [h.Class(className(styles.nodeIcon, kindStyles[node.type]))],
          [symbol],
        ),
        h.span([h.Class(className(styles.nodeTitle))], [node.data.title || label]),
      ]),
      h.span([h.Class(className(styles.nodeRemoveHint)), h.AriaHidden(true)], ["×"]),
    ]),
  ];

const makeNode = (
  id: string,
  type: NodeKind,
  title: string,
  description: string,
  size: NodeSize,
  branches: WorkflowNode["branches"] = [],
): WorkflowNode => ({ id, type, data: { title, description, size }, branches });

const definitions: Record<NodeKind, ExampleNodeTypeDefinition> = {
  start: {
    label: "Start",
    symbol: "↗",
    description: "Workflow entry point",
    movable: false,
    deletable: false,
    create: (id) => makeNode(id, "start", "Start", "There is no text", "default"),
    size: (node) => nodeSizes[node.data.size],
    render: standardView("Start", "↗"),
  },
  action: {
    label: "Action",
    symbol: "‹›",
    description: "Run an operation",
    movable: true,
    deletable: true,
    palette: { label: "Action", description: "Run an operation", symbol: "‹›" },
    create: (id) => makeNode(id, "action", "New action", "There is no text", "default"),
    size: (node) => nodeSizes[node.data.size],
    render: standardView("Action", "‹›"),
  },
  approval: {
    label: "Approval",
    symbol: "✓",
    description: "Wait for a decision",
    movable: true,
    deletable: true,
    palette: { label: "Approval", description: "Wait for a decision", symbol: "✓" },
    create: (id) => makeNode(id, "approval", "Request approval", "There is no text", "default"),
    size: (node) => nodeSizes[node.data.size],
    render: standardView("Approval", "✓"),
  },
  condition: {
    label: "Condition",
    symbol: "⌁",
    description: "Create Then and Else paths",
    movable: true,
    deletable: true,
    palette: { label: "Condition", description: "Create Then and Else paths", symbol: "⌁" },
    create: (id) => makeNode(
      id,
      "condition",
      "New condition",
      "There is no text",
      "default",
      [
        { id: `${id}:then`, label: "Then", elements: [] },
        { id: `${id}:else`, label: "Else", elements: [] },
      ],
    ),
    size: (node) => nodeSizes[node.data.size],
    render: standardView("Condition", "⌁"),
  },
  delay: {
    label: "Delay",
    symbol: "◷",
    description: "Pause before continuing",
    movable: true,
    deletable: true,
    palette: { label: "Delay", description: "Pause before continuing", symbol: "◷" },
    create: (id) => makeNode(id, "delay", "Wait", "There is no text", "default"),
    size: (node) => nodeSizes[node.data.size],
    render: standardView("Delay", "◷"),
  },
  switch: {
    label: "Switch",
    symbol: "⇅",
    description: "Route into named cases",
    movable: true,
    deletable: true,
    palette: { label: "Switch", description: "Route into named cases", symbol: "⇅" },
    create: (id) => makeNode(
      id,
      "switch",
      "New switch",
      "",
      "compact",
      [{ id: `${id}:default`, label: "Default", elements: [] }],
    ),
    size: (node) => nodeSizes[node.data.size],
    render: compactView("Switch", "⇅"),
  },
  end: {
    label: "End",
    symbol: "⚑",
    description: "Workflow completion",
    movable: false,
    deletable: false,
    create: (id) => makeNode(id, "end", "End", "There is no text", "default"),
    size: (node) => nodeSizes[node.data.size],
    render: standardView("End", "⚑"),
  },
};

export const nodeTypes = defineNodeTypes(definitions);

export const insertableNodeKinds = Object.keys(nodeTypes).filter(
  (kind): kind is NodeKind => nodeTypes[kind as NodeKind].palette !== undefined,
);
