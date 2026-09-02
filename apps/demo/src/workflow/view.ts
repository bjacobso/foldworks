import { Option } from "effect";
import { type Document, type Html, type HtmlBuilder } from "foldkit/html";

import { Button, Dialog } from "@foldkit/ui";
import { Workflow } from "@foldworks/workflow";
import {
  Badge as UiBadge,
  Button as UiButton,
  Field as UiField,
  Toolbar as UiToolbar,
} from "@foldworks/ui";

import { dataGridView, people } from "../data-grid/demo";
import {
  formBuilderToolbarActions,
  formBuilderView,
  formGhostView,
  formPaletteView,
} from "../form-builder/view";
import {
  GRAPH_CONTAINER_ID,
  PALETTE_CONTAINER_ID,
  allNodes,
  canMoveNode,
  dropTargetId,
  findNode,
  kindFromPaletteItem,
  nodeSubtree,
  paletteItemId,
  previewDocumentForDrop,
  type NodeSubtree,
} from "./graph";
import {
  pathForPoints,
  layoutWorkflow,
  type StructuredWorkflowLayout,
} from "./layout";
import { Message } from "./message";
import {
  type Model,
  type NodeKind,
  type WorkflowNode,
} from "./model";
import {
  insertableNodeKinds,
  nodeSizes,
  nodeTypes,
} from "./node-types";
import {
  dataGridRouter,
  demoFromRoute,
  formBuilderPath,
  workflowRouter,
} from "./route";
import {
  className,
  kindStyles,
  nodeTransitionClass,
  styles,
} from "./styles";

const toWorkflowMessage = (message: Workflow.Message): Message =>
  Message.GotWorkflowMessage({ message });

const isDraggedItem = (model: Model, itemId: string) =>
  Option.exists(
    Workflow.maybeDraggedItemId(model.workflow),
    (draggedId) => draggedId === itemId,
  );

const paletteItemView = (
  model: Model,
  kind: NodeKind,
  index: number,
  h: HtmlBuilder<Message>,
): Html => {
  const definition = nodeTypes[kind];
  const palette = definition.palette;
  if (palette === undefined) return h.empty;
  const itemId = paletteItemId(kind);
  return h.keyed("li")(
    itemId,
    [
      h.Class(
        className(
          styles.paletteItem,
          isDraggedItem(model, itemId) && styles.paletteItemDragging,
        ),
      ),
      ...Workflow.draggable(
        {
          model: model.workflow,
          toParentMessage: toWorkflowMessage,
          itemId,
          containerId: PALETTE_CONTAINER_ID,
          index,
        },
        h,
      ),
    ],
    [
      h.span(
        [h.Class(className(styles.paletteIcon, kindStyles[kind]))],
        [palette.symbol],
      ),
      h.div([], [
        h.p([h.Class(className(styles.paletteName))], [palette.label]),
        h.p([h.Class(className(styles.paletteDescription))], [palette.description]),
      ]),
      h.span([h.Class(className(styles.paletteHandle)), h.AriaHidden(true)], ["⠿"]),
    ],
  );
};

const paletteView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const demo = demoFromRoute(model.route);
  return h.aside(
    [h.Class(className(styles.palette)), h.AriaLabel("Workflow node palette")],
    [
      h.div([h.Class(className(styles.brandRow))], [
        h.div([h.Class(className(styles.brandMark)), h.AriaHidden(true)], ["O"]),
        h.p([h.Class(className(styles.brand))], ["Demo"]),
      ]),
      h.nav([h.Class(className(styles.demoNav)), h.AriaLabel("Example views")], [
        h.a(
          [
            h.Href(workflowRouter()),
            h.Class(className(styles.demoNavItem, demo === "Workflow" && styles.demoNavItemActive)),
            h.AriaCurrent(demo === "Workflow" ? "page" : "false"),
          ],
          [h.span([h.AriaHidden(true)], ["⌁"]), "Workflow builder"],
        ),
        h.a(
          [
            h.Href(dataGridRouter()),
            h.Class(className(styles.demoNavItem, demo === "DataGrid" && styles.demoNavItemActive)),
            h.AriaCurrent(demo === "DataGrid" ? "page" : "false"),
          ],
          [h.span([h.AriaHidden(true)], ["▦"]), "Data grid"],
        ),
        h.a(
          [
            h.Href(formBuilderPath(model.formExampleId, model.formMode)),
            h.Class(className(styles.demoNavItem, demo === "FormBuilder" && styles.demoNavItemActive)),
            h.AriaCurrent(demo === "FormBuilder" ? "page" : "false"),
          ],
          [h.span([h.AriaHidden(true)], ["▤"]), "Form builder"],
        ),
      ]),
      demo === "Workflow"
        ? h.div([], [
            h.p([h.Class(className(styles.paletteLabel))], ["Drag to an insertion point"]),
            h.ul(
              [h.Class(className(styles.paletteList))],
              insertableNodeKinds.map((kind, index) =>
                paletteItemView(model, kind, index, h),
              ),
            ),
          ])
        : demo === "DataGrid"
          ? h.div([h.Class(className(styles.gridFeatureList))], [
              h.p([h.Class(className(styles.paletteLabel))], ["Initial grid primitives"]),
              h.p([], ["Typed column definitions"]),
              h.p([], ["Headless derived row model"]),
              h.p([], ["Sorting and custom cells"]),
              h.p([], ["Keyboard selection"]),
              h.p([], ["Resizable columns"]),
            ])
          : formPaletteView(model, h),
      h.p(
        [h.Class(className(styles.paletteHint))],
        [
          demo === "Workflow"
            ? "Node types, sizes, branches, and views are registered by this application. The workflow package owns structure and interaction."
            : demo === "DataGrid"
              ? "The application owns row data and cell rendering. The package owns table derivation and interaction state."
              : "Sections define journey order and reference actors. Drag fields between pages, pages between sections, and sections across the document.",
        ],
      ),
    ],
  );
};

const toolbarView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const demo = demoFromRoute(model.route);
  return UiToolbar.view(
    {
      title: demo === "Workflow"
        ? "Candidate workflow"
        : demo === "DataGrid"
          ? "People operations"
          : model.formDocument.title,
      description: demo === "Workflow"
        ? `${allNodes(model.document).length} nodes · structured auto-layout`
        : demo === "DataGrid"
          ? `${people.length} people · controlled Foldkit data grid`
          : `${model.formDocument.sections.length} sections · ${model.formDocument.actors.length} actors`,
      actions: [
        UiBadge.view({ label: "Draft saved", tone: "success", dot: true }, h),
        demo === "Workflow"
          ? UiButton.view(
              {
                label: "Reset example",
                onClick: Message.ClickedResetWorkflow(),
                variant: "outline",
                size: "sm",
              },
              h,
            )
          : demo === "DataGrid"
            ? UiBadge.view({ label: "Headless core + DOM view" }, h)
            : formBuilderToolbarActions(model, h),
      ],
    },
    h,
  );
};

const selectedNodeId = (model: Model) => Option.getOrUndefined(model.selectedNodeId);

const draggedSubtree = (model: Model): NodeSubtree | undefined => {
  const draggedId = Option.getOrUndefined(
    Workflow.maybeDraggedItemId(model.workflow),
  );
  return draggedId === undefined
    ? undefined
    : nodeSubtree(model.document, draggedId);
};

const nodeView = (
  model: Model,
  node: WorkflowNode,
  layout: StructuredWorkflowLayout,
  subtree: NodeSubtree | undefined,
  h: HtmlBuilder<Message>,
): Html => {
  const position = layout.nodes.get(node.id);
  if (position === undefined) return h.empty;
  const definition = nodeTypes[node.type];
  const isDragging = subtree?.rootId === node.id;
  const isDraggingSubtree = subtree?.nodeIds.has(node.id) === true;
  const isDraggingDescendant = isDraggingSubtree && !isDragging;
  const isSelected = selectedNodeId(model) === node.id;
  const draggable = canMoveNode(model.document, node.id)
    ? Workflow.draggable(
        {
          model: model.workflow,
          toParentMessage: toWorkflowMessage,
          itemId: node.id,
          containerId: GRAPH_CONTAINER_ID,
          index: allNodes(model.document).findIndex((candidate) => candidate.id === node.id),
        },
        h,
      )
    : [];

  return h.keyed("button")(
    node.id,
    [
      h.Type("button"),
      h.Class(
        className(
          styles.node,
          node.data.size === "compact" && styles.nodeCompact,
          styles.nodeHoverable,
          isDragging && styles.nodeDragging,
          isDraggingDescendant && styles.nodeDraggingDescendant,
          isSelected && styles.nodeSelected,
        ),
      ),
      ...draggable,
      h.Style({
        "-webkit-user-select": "none",
        height: `${position.height}px`,
        "touch-action": "none",
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        "user-select": "none",
        viewTransitionClass: nodeTransitionClass,
        viewTransitionName: `workflow-${node.id}`,
        width: `${position.width}px`,
      }),
      h.OnClick(Message.ClickedNode({ nodeId: node.id })),
      h.AriaLabel(`${definition.label}: ${node.data.title}. Open settings.`),
      h.DataAttribute("drag-source", isDragging ? "true" : "false"),
      h.DataAttribute("drag-subtree", isDraggingSubtree ? "true" : "false"),
      h.DataAttribute("node-id", node.id),
      h.DataAttribute("node-type", node.type),
    ],
    [
      h.div(
        [h.Class(className(isDraggingSubtree && styles.nodeDraggingContent))],
        definition.render(node, h),
      ),
    ],
  );
};

const connectorLayerView = (
  model: Model,
  layout: StructuredWorkflowLayout,
  subtree: NodeSubtree | undefined,
  h: HtmlBuilder<Message>,
): Html => {
  const activeLocation = Option.getOrUndefined(Workflow.maybeDropLocation(model.workflow));
  const activeId = activeLocation === undefined
    ? undefined
    : dropTargetId(activeLocation);

  return h.svg(
    [
      h.Class(className(styles.edgeLayer)),
      h.ViewBox(`0 0 ${layout.width} ${layout.height}`),
      h.Width(`${layout.width}`),
      h.Height(`${layout.height}`),
      h.AriaHidden(true),
    ],
    [
      ...layout.connectors.map((connector) =>
        h.keyed("path")(
          connector.id,
          [
            h.D(pathForPoints(connector.points)),
            h.Class(
              className(
                styles.edgePath,
                subtree !== undefined &&
                  ((connector.ownerElementId !== undefined &&
                    subtree.nodeIds.has(connector.ownerElementId)) ||
                    (connector.flowId !== undefined &&
                      subtree.flowIds.has(connector.flowId))) &&
                  styles.edgePathDraggingSubtree,
                activeId !== undefined &&
                  connector.locationId === activeId &&
                  styles.edgePathActive,
              ),
            ),
            h.DataAttribute(
              "drag-subtree-connector",
              subtree !== undefined &&
                ((connector.ownerElementId !== undefined &&
                  subtree.nodeIds.has(connector.ownerElementId)) ||
                  (connector.flowId !== undefined &&
                    subtree.flowIds.has(connector.flowId)))
                ? "true"
                : "false",
            ),
          ],
        ),
      ),
      ...layout.junctions.map((junction) =>
        h.keyed("circle")(
          junction.id,
          [
            h.Attribute("cx", `${junction.x}`),
            h.Attribute("cy", `${junction.y}`),
            h.Attribute("r", "3"),
            h.Class(
              className(
                styles.junction,
                subtree?.nodeIds.has(junction.ownerElementId) === true &&
                  styles.junctionDraggingSubtree,
              ),
            ),
          ],
        ),
      ),
    ],
  );
};

const branchLabelViews = (
  layout: StructuredWorkflowLayout,
  subtree: NodeSubtree | undefined,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  layout.branchLabels.map((label) =>
    h.keyed("span")(
      label.id,
      [
        h.Class(
          className(
            styles.branchLabel,
            subtree?.nodeIds.has(label.ownerElementId) === true &&
              styles.branchLabelDraggingSubtree,
          ),
        ),
        h.Style({ left: `${label.x}px`, top: `${label.y}px` }),
      ],
      [label.text],
    ),
  );

const insertionViews = (
  model: Model,
  layout: StructuredWorkflowLayout,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const isDragging = Workflow.isDragging(model.workflow);
  const target = Option.getOrUndefined(Workflow.maybeDropTarget(model.workflow));
  const draggedId = Option.getOrUndefined(Workflow.maybeDraggedItemId(model.workflow));
  const dragged = Option.getOrUndefined(draggedNode(model));

  return layout.insertions.flatMap((insertion) => {
    const isValid = draggedId === undefined ||
      previewDocumentForDrop(model.document, draggedId, insertion.id) !== undefined;
    if (isDragging && !isValid) return [];
    const isActive = target?.containerId === insertion.id;
    return [
      h.keyed("div")(
        insertion.id,
        [
          h.Class(className(styles.edgeTargetZone)),
          h.Style({ left: `${insertion.x}px`, top: `${insertion.y}px` }),
          h.DataAttribute("location-id", insertion.id),
          h.DataAttribute("drop-active", isActive ? "true" : "false"),
          ...Workflow.droppable(insertion.id, "Insert node"),
        ],
        [
          Button.view(
            {
              onClick: Message.ClickedQuickAdd({ locationId: insertion.id }),
              toView: (attributes) =>
                h.button(
                  [
                    ...attributes.button,
                    h.Class(
                      className(
                        styles.edgeTarget,
                        isDragging && styles.edgeTargetDragging,
                        isActive && styles.edgeTargetActive,
                      ),
                    ),
                    h.AriaLabel(
                      isActive && dragged !== undefined
                        ? `Drop ${dragged.node.data.title} here`
                        : "Add an action here",
                    ),
                    h.Title(isActive ? "Drop node here" : "Add action"),
                  ],
                  ["+"],
                ),
            },
            h,
          ),
        ],
      ),
    ];
  });
};

const draggedNode = (model: Model) =>
  Option.flatMap(Workflow.maybeDraggedItemId(model.workflow), (itemId) => {
    const kind = kindFromPaletteItem(itemId);
    if (kind !== undefined) {
      return Option.some({
        node: nodeTypes[kind].create("drag-preview"),
        kind,
        nodeCount: 1,
      });
    }
    const node = findNode(model.document, itemId);
    const subtree = nodeSubtree(model.document, itemId);
    return node === undefined
      ? Option.none()
      : Option.some({
          node,
          kind: node.type,
          nodeCount: subtree?.nodeIds.size ?? 1,
        });
  });

const ghostView = (model: Model, h: HtmlBuilder<Message>): Html =>
  Option.match(Workflow.ghostStyle(model.workflow), {
    onNone: () => h.empty,
    onSome: (ghostStyle) =>
      Option.match(draggedNode(model), {
        onNone: () => h.empty,
        onSome: ({ node, kind, nodeCount }) => {
          const definition = nodeTypes[kind];
          return h.div(
            [
              h.Style(ghostStyle),
              h.Class(className(styles.ghost)),
              h.AriaHidden(true),
            ],
            [
              h.span(
                [h.Class(className(styles.nodeIdentity))],
                [
                  h.span(
                    [h.Class(className(styles.nodeIcon, kindStyles[kind]))],
                    [definition.symbol],
                  ),
                  h.span([h.Class(className(styles.nodeTitle))], [node.data.title]),
                ],
              ),
              nodeCount > 1
                ? h.span([h.Class(className(styles.ghostCount))], [
                    `${nodeCount} nodes`,
                  ])
                : h.empty,
            ],
          );
        },
      }),
  });

const canvasView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const layout = layoutWorkflow(model.document);
  const nodes = allNodes(model.document);
  const subtree = draggedSubtree(model);
  return h.div(
    [h.Class(className(styles.canvasViewport))],
    [
      h.div(
        [
          h.Class(className(styles.canvas)),
          h.DataAttribute("workflow-canvas", "true"),
          h.Style({ height: `${layout.height}px`, width: `${layout.width}px` }),
        ],
        [
          connectorLayerView(model, layout, subtree, h),
          ...branchLabelViews(layout, subtree, h),
          ...insertionViews(model, layout, h),
          ...nodes.map((node) => nodeView(model, node, layout, subtree, h)),
        ],
      ),
      ghostView(model, h),
    ],
  );
};

const textField = (
  id: string,
  label: string,
  value: string,
  onInput: (value: string) => Message,
  h: HtmlBuilder<Message>,
): Html =>
  UiField.input(
    {
      id,
      label,
      value,
      onInput,
    },
    h,
  );

const selectField = (
  id: string,
  label: string,
  value: string,
  values: ReadonlyArray<string>,
  onChange: (value: string) => Message,
  h: HtmlBuilder<Message>,
  isDisabled = false,
): Html =>
  UiField.select(
    {
      id,
      label,
      value,
      onChange,
      isDisabled,
      options: values.map((option) => ({ value: option, label: option })),
    },
    h,
  );

const inspectorContent = (
  model: Model,
  node: WorkflowNode,
  render: Dialog.RenderInfo,
  h: HtmlBuilder<Message>,
): Html => {
  const definition = nodeTypes[node.type];
  return h.dialog(
    [...render.dialog, h.Class(className(styles.dialog))],
    render.isVisible
      ? [
          h.div([...render.backdrop, h.Class(className(styles.backdrop))]),
          h.section(
            [...render.panel, h.Class(className(styles.sheet))],
            [
              h.header([h.Class(className(styles.sheetHeader))], [
                h.div([], [
                  h.p([h.Class(className(styles.sheetEyebrow))], [`${definition.label} settings`]),
                  h.h2(
                    [...render.title, h.Class(className(styles.sheetTitle))],
                    [node.data.title.length > 0 ? node.data.title : "Untitled node"],
                  ),
                  h.p(
                    [...render.description, h.Class(className(styles.sheetDescription))],
                    ["Changes update the structured workflow immediately."],
                  ),
                ]),
                h.button(
                  [
                    ...render.closeButton,
                    h.Class(className(styles.closeButton)),
                    h.AriaLabel("Close node settings"),
                  ],
                  ["×"],
                ),
              ]),
              h.div([h.Class(className(styles.sheetBody))], [
                textField(
                  "node-title",
                  "Name",
                  node.data.title,
                  (value) => Message.ChangedSelectedNodeTitle({ value }),
                  h,
                ),
                UiField.textarea(
                  {
                    id: "node-description",
                    label: "Description",
                    value: node.data.description,
                    onInput: (value) => Message.ChangedSelectedNodeDescription({ value }),
                  },
                  h,
                ),
                h.div([h.Class(className(styles.fieldGrid))], [
                  selectField(
                    "node-type",
                    "Registered type",
                    node.type,
                    [node.type],
                    (value) => Message.ChangedSelectedNodeType({ value }),
                    h,
                    true,
                  ),
                  selectField(
                    "node-size",
                    "Size",
                    node.data.size,
                    Object.keys(nodeSizes),
                    (value) => Message.ChangedSelectedNodeSize({ value }),
                    h,
                  ),
                ]),
                h.p(
                  [h.Class(className(styles.sheetNote))],
                  [
                    node.branches.length > 0
                      ? `This registered node owns ${node.branches.length} nested flow${node.branches.length === 1 ? "" : "s"}; they move with it.`
                      : "This is a registered leaf node and can be placed in any valid flow.",
                  ],
                ),
                UiButton.view(
                  {
                    label: "Delete node",
                    onClick: Message.ClickedDeleteSelectedNode(),
                    isDisabled: !canMoveNode(model.document, node.id),
                    isFullWidth: true,
                    variant: "danger",
                  },
                  h,
                ),
              ]),
            ],
          ),
        ]
      : [],
  );
};

const inspectorView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const node = Option.flatMap(model.selectedNodeId, (nodeId) =>
    Option.fromNullishOr(findNode(model.document, nodeId)),
  );
  return h.submodel({
    slotId: model.inspector.id,
    model: model.inspector,
    view: Dialog.view,
    viewInputs: {
      toView: (render) =>
        Option.match(node, {
          onNone: () => h.dialog([...render.dialog]),
          onSome: (selected) => inspectorContent(model, selected, render, h),
        }),
    },
    toParentMessage: (message) => Message.GotInspectorMessage({ message }),
  });
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const demo = demoFromRoute(model.route);
  return {
    title: demo === "Workflow"
      ? "Workflow · Demo"
      : demo === "DataGrid"
        ? "Data grid · Demo"
        : "Form builder · Demo",
    body: h.main(
      [
        h.Class(className(
          styles.app,
          demo === "FormBuilder" && model.formMode === "Preview" && styles.appFormPreview,
        )),
      ],
      [
        demo === "FormBuilder" && model.formMode === "Preview"
          ? h.empty
          : paletteView(model, h),
        h.section([h.Class(className(styles.workspace))], [
          toolbarView(model, h),
          demo === "Workflow"
            ? canvasView(model, h)
            : demo === "DataGrid"
              ? dataGridView(model, h)
              : formBuilderView(model, h),
        ]),
        demo === "Workflow" ? inspectorView(model, h) : h.empty,
        demo === "FormBuilder" ? formGhostView(model, h) : h.empty,
        h.div(
          [h.Class(className(styles.srOnly)), h.AriaLive("assertive")],
          [model.announcement],
        ),
      ],
    ),
  };
};
