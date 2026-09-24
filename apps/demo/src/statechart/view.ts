import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  Circle,
  CircleDot,
  Columns2,
  LayoutGrid,
  Maximize2,
  Redo2,
  RotateCcw,
  Scan,
  Square,
  StickyNote,
  Undo2,
  Workflow,
  ZoomIn,
  ZoomOut,
  type LucideIconData,
} from "@lucide/icons";
import {
  boundaryPoint,
  Diagram,
  expandRect,
  findAnnotation,
  findEdge,
  findNode,
  nodeAt,
  paintOrder,
  pathForPoints,
  polylineMidpoint,
  rectCenter,
  sidePoint,
  smoothPathForPoints,
  unionRects,
  type DiagramScene,
  type Point,
  type Rect,
  type SceneEdge,
  type SceneNode,
} from "@foldworks/diagram";
import { History } from "@foldworks/history";
import {
  Button as UiButton,
  Field as UiField,
  Icon as UiIcon,
  SegmentedControl as UiSegmentedControl,
} from "@foldworks/ui";

import {
  activeStates,
  enabledTransitions,
  findMachine,
  isComplete,
  isContainerKind,
  layoutMachine,
  lintMachine,
  operations,
  type MachineDocument,
  type StateKind,
  type StateNode,
} from "./machine";
import { Message } from "./message";
import type { Model } from "./model";
import { className, styles } from "./styles";
import {
  currentDocument,
  currentMachineId,
  currentScene,
  dropContainer,
  labelForKind,
  translated,
} from "./update";

const toCanvasMessage = (message: Diagram.Message): Message =>
  Message.GotCanvasMessage({ message });

type Derived = Readonly<{
  document: MachineDocument;
  scene: DiagramScene;
  dragging: ReadonlySet<string>;
  dropTargetId: string | undefined;
  connection:
    | Readonly<{ from: Point; to: Point; targetId: string | undefined; isValid: boolean }>
    | undefined;
  active: ReadonlySet<string>;
  enabled: ReadonlySet<string>;
}>;

/** Derives everything the canvas renders. While dragging, the document is
 *  re-laid out with the dragged elements pinned at their preview positions so
 *  edges and containers follow the pointer. */
const derive = (model: Model): Derived => {
  const document = currentDocument(model);
  const baseScene = currentScene(model);
  const drag = Option.getOrUndefined(Diagram.maybeDragPreview(model.canvas));
  const preview =
    drag === undefined ? undefined : translated(document, baseScene, drag.ids, drag.delta);
  const scene = preview === undefined ? baseScene : layoutMachine(preview, model.direction);
  const [only] = drag?.ids ?? [];
  const container =
    drag === undefined || drag.ids.length !== 1 || only === undefined
      ? undefined
      : dropContainer(document, baseScene, only, drag.drop);
  const dropTargetId =
    typeof container === "string" &&
    (findAnnotation(document, only ?? "") !== undefined ||
      operations.canNest(document, only ?? "", container))
      ? container
      : undefined;
  const link = Option.getOrUndefined(Diagram.maybeConnectionPreview(model.canvas));
  const target = link === undefined ? undefined : nodeAt(baseScene, link.to);
  const simulating = model.mode === "Simulate";
  return {
    document,
    scene,
    dragging: new Set(drag?.ids ?? []),
    dropTargetId,
    connection:
      link === undefined
        ? undefined
        : {
            from: link.from,
            to: link.to,
            targetId: target?.id,
            isValid:
              target !== undefined &&
              operations.connectionRejection(document, link.source, { nodeId: target.id }) ===
                undefined,
          },
    active: simulating ? activeStates(document, model.configuration) : new Set(),
    enabled: simulating
      ? new Set(enabledTransitions(document, model.configuration).map((edge) => edge.id))
      : new Set(),
  };
};

const kindIcons: Record<StateKind, LucideIconData> = {
  initial: CircleDot,
  atomic: Square,
  compound: Boxes,
  parallel: Columns2,
  final: Circle,
  submachine: Workflow,
};

// Canvas -------------------------------------------------------------------

const arrowHead = (points: ReadonlyArray<Point>): string => {
  const tip = points[points.length - 1];
  const before = points[points.length - 2];
  if (tip === undefined || before === undefined) return "";
  const length = Math.max(Math.hypot(tip.x - before.x, tip.y - before.y), 1);
  const ux = (tip.x - before.x) / length;
  const uy = (tip.y - before.y) / length;
  const baseX = tip.x - ux * 9;
  const baseY = tip.y - uy * 9;
  return `M ${tip.x} ${tip.y} L ${baseX - uy * 4.5} ${baseY + ux * 4.5} L ${baseX + uy * 4.5} ${baseY - ux * 4.5} Z`;
};

const edgePath = (edge: SceneEdge) =>
  edge.shape === "Curve" ? smoothPathForPoints(edge.points) : pathForPoints(edge.points, 8);

const edgeAnchor = (edge: SceneEdge): Point =>
  edge.labelPosition ?? polylineMidpoint(edge.points) ?? { x: 0, y: 0 };

const attachmentTarget = (scene: DiagramScene, id: string): Rect | Point | undefined =>
  scene.nodes.get(id) ?? scene.edges.find((edge) => edge.id === id)?.labelPosition;

const edgeLayerView = (model: Model, derived: Derived, h: HtmlBuilder<Message>): Html => {
  const { document, scene } = derived;
  const simulating = model.mode === "Simulate";
  const attachments = scene.annotations.flatMap((annotation) =>
    annotation.attachedTo.flatMap((targetId) => {
      const target = attachmentTarget(scene, targetId);
      if (target === undefined) return [];
      const targetCenter = "width" in target ? rectCenter(target) : target;
      const from = boundaryPoint(annotation, targetCenter);
      const to = "width" in target ? boundaryPoint(target, rectCenter(annotation)) : target;
      return [
        h.keyed("path")(`attachment:${annotation.id}:${targetId}`, [
          h.D(`M ${from.x} ${from.y} L ${to.x} ${to.y}`),
          h.Class(className(styles.attachment)),
        ]),
      ];
    }),
  );

  const edges = scene.edges.flatMap((edge) => {
    const transition = findEdge(document, edge.id);
    if (transition === undefined) return [];
    const isSelected = Diagram.isSelected(model.canvas, edge.id);
    const isEnabled = derived.enabled.has(edge.id);
    const tone = className(
      styles.edgePath,
      isSelected && styles.edgeSelected,
      isEnabled && styles.edgeEnabled,
      simulating && !isEnabled && styles.edgeDimmed,
    );
    const anchor = edgeAnchor(edge);
    return [
      h.keyed("path")(`edge:${edge.id}`, [
        h.D(edgePath(edge)),
        h.Class(tone),
        h.DataAttribute("edge-id", edge.id),
      ]),
      h.keyed("path")(`arrow:${edge.id}`, [
        h.D(arrowHead(edge.points)),
        h.Class(
          className(
            styles.edgeArrow,
            isSelected && styles.arrowSelected,
            isEnabled && styles.arrowEnabled,
            simulating && !isEnabled && styles.edgeDimmed,
          ),
        ),
      ]),
      h.keyed("path")(`hit:${edge.id}`, [
        h.D(edgePath(edge)),
        h.Class(className(styles.edgeHit)),
        h.OnPointerDown((_pointerType, button, _screenX, _screenY, _timeStamp, clientX, clientY) =>
          button === 0
            ? Option.some(
                toCanvasMessage(
                  Diagram.Message.PressedElement({
                    id: edge.id,
                    isMovable: false,
                    clientX,
                    clientY,
                    anchorX: anchor.x,
                    anchorY: anchor.y,
                  }),
                ),
              )
            : Option.none(),
        ),
      ]),
    ];
  });

  const connection = derived.connection;
  const preview =
    connection === undefined
      ? []
      : [
          h.keyed("path")("connection-preview", [
            h.D(
              `M ${connection.from.x} ${connection.from.y} L ${connection.to.x} ${connection.to.y}`,
            ),
            h.Class(
              className(
                styles.preview,
                connection.targetId !== undefined && !connection.isValid && styles.previewInvalid,
              ),
            ),
          ]),
        ];

  // Size the layer to the scene (plus room for the connection preview) so
  // negative coordinates, such as self-loops above the top row, stay visible.
  const pad = 80;
  const bounds = expandRect(
    connection === undefined
      ? scene.bounds
      : (unionRects([scene.bounds, { ...connection.to, width: 0, height: 0 }]) ?? scene.bounds),
    pad,
  );
  return h.svg(
    [
      h.Class(className(styles.edgeLayer)),
      h.ViewBox(`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`),
      h.Width(`${bounds.width}`),
      h.Height(`${bounds.height}`),
      h.Style({ transform: `translate(${bounds.x}px, ${bounds.y}px)` }),
      h.AriaHidden(true),
    ],
    [...attachments, ...edges, ...preview],
  );
};

const portAnchor = (model: Model, node: SceneNode): Point =>
  sidePoint(node, model.direction === "Down" ? "Bottom" : "Right");

const stateView = (
  model: Model,
  derived: Derived,
  sceneNode: SceneNode,
  state: StateNode,
  h: HtmlBuilder<Message>,
): Html => {
  const { kind, name } = state.data;
  const editing = model.mode === "Edit";
  const isSelected = Diagram.isSelected(model.canvas, state.id);
  const isContainer = isContainerKind(kind);
  const isActive = derived.active.has(state.id);
  const connection = derived.connection;
  const portPoint = portAnchor(model, sceneNode);
  const machine =
    state.data.machineId === undefined
      ? undefined
      : findMachine(model.library, state.data.machineId);
  const header =
    kind === "initial" || kind === "final"
      ? []
      : [
          h.div(
            [h.Class(className(isContainer ? styles.containerHeader : styles.nodeHeader))],
            [
              h.span([h.Class(className(styles.nodeName))], [name]),
              kind === "submachine"
                ? h.button(
                    [
                      h.Type("button"),
                      h.Class(className(styles.openButton)),
                      h.AriaLabel(`Open ${machine?.name ?? "submachine"}`),
                      h.OnClick(Message.ClickedOpenSubmachine({ stateId: state.id })),
                    ],
                    [`Open ${machine?.name ?? ""}`.trim()],
                  )
                : h.span(
                    [h.Class(className(styles.nodeKind))],
                    [kind === "atomic" ? "" : kind === "parallel" ? "parallel" : "compound"],
                  ),
            ],
          ),
        ];
  const port =
    editing && kind !== "final"
      ? [
          h.span(
            [
              h.Class(className(styles.port, isSelected && styles.portVisible)),
              h.Style({
                left: model.direction === "Down" ? "50%" : "100%",
                top: model.direction === "Down" ? "100%" : "50%",
              }),
              ...Diagram.portAttributes(
                {
                  model: model.canvas,
                  toParentMessage: toCanvasMessage,
                  source: { nodeId: state.id },
                  anchor: portPoint,
                  label: `Drag to add a transition from ${name}`,
                },
                h,
              ),
            ],
            [],
          ),
        ]
      : [];

  return h.keyed("div")(
    `state:${state.id}`,
    [
      h.Class(
        className(
          styles.node,
          isContainer && styles.container,
          kind === "parallel" && styles.parallel,
          kind === "submachine" && styles.submachine,
          kind === "initial" && styles.pseudo,
          kind === "final" && styles.final,
          isSelected && styles.selected,
          derived.dragging.has(state.id) && styles.dragging,
          derived.dropTargetId === state.id && styles.dropTarget,
          connection?.targetId === state.id &&
            (connection.isValid ? styles.connectTarget : styles.connectInvalid),
          isActive && (isContainer ? styles.activeContainer : styles.active),
        ),
      ),
      h.Style({
        height: `${sceneNode.height}px`,
        transform: `translate(${sceneNode.x}px, ${sceneNode.y}px)`,
        width: `${sceneNode.width}px`,
      }),
      h.DataAttribute("state-id", state.id),
      h.DataAttribute("state-kind", kind),
      h.DataAttribute("active", isActive ? "true" : "false"),
      ...Diagram.elementAttributes(
        {
          model: model.canvas,
          toParentMessage: toCanvasMessage,
          id: state.id,
          anchor: rectCenter(sceneNode),
          isMovable: editing,
          label: `${labelForKind(kind)}: ${name}${isActive ? ", active" : ""}`,
        },
        h,
      ),
    ],
    [...header, ...port],
  );
};

const labelView = (
  model: Model,
  derived: Derived,
  edge: SceneEdge,
  h: HtmlBuilder<Message>,
): Html => {
  const transition = findEdge(derived.document, edge.id);
  if (
    transition === undefined ||
    (transition.data.event === "" && transition.data.guard === undefined)
  ) {
    return h.empty;
  }
  const anchor = edgeAnchor(edge);
  const isEnabled = derived.enabled.has(edge.id);
  return h.keyed("div")(
    `label:${edge.id}`,
    [
      h.Class(
        className(
          styles.label,
          Diagram.isSelected(model.canvas, edge.id) && styles.labelSelected,
          isEnabled && styles.labelEnabled,
        ),
      ),
      h.Style({ transform: `translate(${anchor.x}px, ${anchor.y}px) translate(-50%, -50%)` }),
      h.DataAttribute("transition-id", edge.id),
      h.DataAttribute("enabled", isEnabled ? "true" : "false"),
      ...Diagram.elementAttributes(
        {
          model: model.canvas,
          toParentMessage: toCanvasMessage,
          id: edge.id,
          anchor,
          isMovable: false,
          label: `Transition ${transition.data.event}${isEnabled ? ", enabled. Press Enter to fire." : ""}`,
        },
        h,
      ),
    ],
    [
      transition.data.event,
      transition.data.guard === undefined
        ? h.empty
        : h.span([h.Class(className(styles.guard))], [`[${transition.data.guard}]`]),
    ],
  );
};

const noteView = (
  model: Model,
  derived: Derived,
  annotation: DiagramScene["annotations"][number],
  h: HtmlBuilder<Message>,
): Html => {
  const note = findAnnotation(derived.document, annotation.id);
  if (note === undefined) return h.empty;
  return h.keyed("div")(
    `note:${annotation.id}`,
    [
      h.Class(
        className(
          styles.note,
          Diagram.isSelected(model.canvas, annotation.id) && styles.selected,
          derived.dragging.has(annotation.id) && styles.dragging,
        ),
      ),
      h.Style({
        height: `${annotation.height}px`,
        transform: `translate(${annotation.x}px, ${annotation.y}px)`,
        width: `${annotation.width}px`,
      }),
      h.DataAttribute("note-id", annotation.id),
      ...Diagram.elementAttributes(
        {
          model: model.canvas,
          toParentMessage: toCanvasMessage,
          id: annotation.id,
          anchor: rectCenter(annotation),
          isMovable: model.mode === "Edit",
          label: `Note: ${note.data.text}`,
        },
        h,
      ),
    ],
    [note.data.text],
  );
};

const zoomBarView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class(className(styles.zoomBar))],
    [
      UiButton.view(
        {
          icon: ZoomOut,
          ariaLabel: "Zoom out",
          variant: "ghost",
          size: "icon",
          onClick: toCanvasMessage(Diagram.Message.ClickedZoomOut()),
        },
        h,
      ),
      h.span(
        [h.Class(className(styles.zoomValue))],
        [`${Math.round(model.canvas.viewport.zoom * 100)}%`],
      ),
      UiButton.view(
        {
          icon: ZoomIn,
          ariaLabel: "Zoom in",
          variant: "ghost",
          size: "icon",
          onClick: toCanvasMessage(Diagram.Message.ClickedZoomIn()),
        },
        h,
      ),
      UiButton.view(
        {
          icon: Maximize2,
          ariaLabel: "Fit to view",
          variant: "ghost",
          size: "icon",
          onClick: Message.ClickedFit(),
          attributes: [h.Title("Fit to view")],
        },
        h,
      ),
    ],
  );

const breadcrumbsView = (model: Model, derived: Derived, h: HtmlBuilder<Message>): Html => {
  const states = derived.document.nodes.filter((node) => node.data.kind !== "initial").length;
  return h.nav(
    [h.Class(className(styles.breadcrumbs)), h.AriaLabel("Machine path")],
    [
      ...model.path.flatMap((machineId, index) => {
        const machine = findMachine(model.library, machineId);
        const isCurrent = index === model.path.length - 1;
        return [
          index === 0
            ? h.empty
            : h.span(
                [h.Class(className(styles.crumbSeparator)), h.AriaHidden(true)],
                [UiIcon.view({ icon: ChevronRight, size: 12 }, h)],
              ),
          h.button(
            [
              h.Type("button"),
              h.Class(className(styles.crumb, isCurrent && styles.crumbCurrent)),
              ...(isCurrent
                ? [h.AriaCurrent("page")]
                : [h.OnClick(Message.ClickedBreadcrumb({ index }))]),
            ],
            [machine?.name ?? machineId],
          ),
        ];
      }),
      h.span(
        [h.Class(className(styles.crumbMeta))],
        [
          `${states} states · ${derived.document.edges.length} transitions · ${derived.document.annotations.length} notes`,
        ],
      ),
    ],
  );
};

const canvasView = (model: Model, derived: Derived, h: HtmlBuilder<Message>): Html => {
  const nodes = paintOrder(derived.scene).flatMap((sceneNode) => {
    const state = findNode(derived.document, sceneNode.id);
    return state === undefined ? [] : [stateView(model, derived, sceneNode, state, h)];
  });
  return h.div(
    [h.Class(className(styles.stage))],
    [
      breadcrumbsView(model, derived, h),
      h.div(
        [
          h.Class(
            className(
              styles.viewport,
              model.canvas.gesture._tag === "Panning" && styles.viewportPanning,
            ),
          ),
          h.DataAttribute("statechart-canvas", "true"),
          h.DataAttribute("mode", model.mode.toLowerCase()),
          ...Diagram.canvasAttributes({ model: model.canvas, toParentMessage: toCanvasMessage }, h),
        ],
        [
          h.div(
            [
              h.Class(className(styles.world)),
              h.Style({ transform: Diagram.worldTransform(model.canvas) }),
            ],
            [
              edgeLayerView(model, derived, h),
              ...nodes,
              ...derived.scene.annotations.map((annotation) =>
                noteView(model, derived, annotation, h),
              ),
              ...derived.scene.edges.map((edge) => labelView(model, derived, edge, h)),
            ],
          ),
          zoomBarView(model, h),
          h.div(
            [h.Class(className(styles.hint))],
            [
              model.mode === "Edit"
                ? "Drag states into compound states · drag a handle to connect · Delete removes"
                : "Click a highlighted transition to fire it",
            ],
          ),
        ],
      ),
    ],
  );
};

// Inspector ----------------------------------------------------------------

const section = (title: string, children: ReadonlyArray<Html>, h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class(className(styles.paletteSection))],
    [h.p([h.Class(className(styles.eyebrow))], [title]), ...children],
  );

const simulationView = (model: Model, derived: Derived, h: HtmlBuilder<Message>): Html => {
  const enabled = enabledTransitions(derived.document, model.configuration);
  const complete = isComplete(derived.document, model.configuration);
  const names = model.configuration.map((id) => findNode(derived.document, id)?.data.name ?? id);
  return section(
    "Simulation",
    [
      h.p(
        [h.Class(className(styles.muted))],
        [
          complete
            ? `Reached ${names.join(", ")}. The machine is done.`
            : `Active: ${names.join(", ") || "none"}`,
        ],
      ),
      h.ul(
        [h.Class(className(styles.list))],
        enabled
          .filter((edge) => edge.data.event !== "")
          .map((edge) =>
            h.li(
              [],
              [
                h.button(
                  [
                    h.Type("button"),
                    h.Class(className(styles.listButton, styles.eventButton)),
                    h.OnClick(Message.ClickedFireTransition({ edgeId: edge.id })),
                    h.DataAttribute("fire-transition", edge.id),
                  ],
                  [
                    edge.data.event,
                    h.span(
                      [h.Class(className(styles.muted))],
                      [`→ ${findNode(derived.document, edge.target.nodeId)?.data.name ?? ""}`],
                    ),
                  ],
                ),
              ],
            ),
          ),
      ),
      model.log.length === 0
        ? h.empty
        : h.ol(
            [h.Class(className(styles.log))],
            model.log.map((entry) => h.li([], [entry])),
          ),
      UiButton.view(
        {
          label: "Restart",
          icon: RotateCcw,
          variant: "outline",
          size: "sm",
          onClick: Message.ClickedRestartSimulation(),
        },
        h,
      ),
    ],
    h,
  );
};

const overviewView = (model: Model, derived: Derived, h: HtmlBuilder<Message>): Html => {
  const machine = findMachine(model.library, currentMachineId(model));
  const issues = machine === undefined ? [] : lintMachine(model.library, machine);
  const count = (predicate: (node: StateNode) => boolean) =>
    derived.document.nodes.filter(predicate).length;
  return h.div(
    [],
    [
      section(
        "Machine",
        [
          h.h2([h.Class(className(styles.heading))], [machine?.name ?? "Machine"]),
          h.div(
            [h.Class(className(styles.stats))],
            [
              ["States", count((node) => node.data.kind !== "initial")],
              ["Nested", count((node) => node.parentId !== undefined)],
              ["Submachines", count((node) => node.data.kind === "submachine")],
            ].map(([label, value]) =>
              h.div(
                [h.Class(className(styles.stat))],
                [
                  h.span([h.Class(className(styles.statValue))], [`${value}`]),
                  h.span([h.Class(className(styles.statLabel))], [`${label}`]),
                ],
              ),
            ),
          ),
          h.p(
            [h.Class(className(styles.muted))],
            [
              "One diagram document: states nest through parentId, transitions may form cycles and self-loops, and notes sit beside the graph.",
            ],
          ),
        ],
        h,
      ),
      section(
        issues.length === 0
          ? "No issues"
          : `${issues.length} issue${issues.length === 1 ? "" : "s"}`,
        [
          issues.length === 0
            ? h.p(
                [h.Class(className(styles.muted))],
                ["Every state is reachable and every container has an initial state."],
              )
            : h.ul(
                [h.Class(className(styles.list))],
                issues.map((issue) =>
                  h.li(
                    [],
                    [
                      h.button(
                        [
                          h.Type("button"),
                          h.Class(className(styles.listButton, styles.issue)),
                          h.OnClick(Message.ClickedSelectElement({ id: issue.elementId })),
                        ],
                        [issue.message],
                      ),
                    ],
                  ),
                ),
              ),
        ],
        h,
      ),
    ],
  );
};

const stateInspector = (
  model: Model,
  state: StateNode,
  derived: Derived,
  h: HtmlBuilder<Message>,
): Html => {
  const others = model.library.machines.filter((machine) => machine.id !== currentMachineId(model));
  const parent =
    state.parentId === undefined ? undefined : findNode(derived.document, state.parentId);
  const editing = model.mode === "Edit";
  return section(
    labelForKind(state.data.kind),
    [
      UiField.input(
        {
          id: "statechart-state-name",
          label: "Name",
          value: state.data.name,
          isDisabled: !editing,
          onInput: (value) => Message.ChangedStateName({ value }),
        },
        h,
      ),
      UiField.select(
        {
          id: "statechart-state-kind",
          label: "Kind",
          value: state.data.kind,
          isDisabled: !editing,
          onChange: (value) => Message.ChangedStateKind({ value }),
          options: (
            ["atomic", "compound", "parallel", "final", "submachine", "initial"] as const
          ).map((kind) => ({
            value: kind,
            label: labelForKind(kind),
          })),
        },
        h,
      ),
      state.data.kind === "submachine"
        ? UiField.select(
            {
              id: "statechart-submachine",
              label: "Runs machine",
              value: state.data.machineId ?? "",
              isDisabled: !editing,
              onChange: (value) => Message.ChangedSubmachine({ value }),
              options: others.map((machine) => ({ value: machine.id, label: machine.name })),
            },
            h,
          )
        : h.empty,
      state.data.kind === "submachine"
        ? UiButton.view(
            {
              label: "Open submachine",
              icon: ArrowUpRight,
              variant: "outline",
              size: "sm",
              onClick: Message.ClickedOpenSubmachine({ stateId: state.id }),
            },
            h,
          )
        : h.empty,
      h.p(
        [h.Class(className(styles.muted))],
        [
          parent === undefined ? "Top-level state." : `Nested in ${parent.data.name}.`,
          " ",
          `${derived.document.edges.filter((edge) => edge.source.nodeId === state.id).length} outgoing, `,
          `${derived.document.edges.filter((edge) => edge.target.nodeId === state.id).length} incoming.`,
        ],
      ),
      editing
        ? UiButton.view(
            {
              label: "Delete state",
              variant: "danger",
              isFullWidth: true,
              onClick: Message.ClickedDeleteSelection(),
            },
            h,
          )
        : h.empty,
    ],
    h,
  );
};

const transitionInspector = (
  model: Model,
  edgeId: string,
  derived: Derived,
  h: HtmlBuilder<Message>,
): Html => {
  const edge = findEdge(derived.document, edgeId);
  if (edge === undefined) return h.empty;
  const source = findNode(derived.document, edge.source.nodeId)?.data.name ?? "?";
  const target = findNode(derived.document, edge.target.nodeId)?.data.name ?? "?";
  const editing = model.mode === "Edit";
  return section(
    "Transition",
    [
      h.p(
        [h.Class(className(styles.muted))],
        [
          edge.source.nodeId === edge.target.nodeId
            ? `${source} → itself`
            : `${source} → ${target}`,
        ],
      ),
      UiField.input(
        {
          id: "statechart-transition-event",
          label: "Event",
          value: edge.data.event,
          isDisabled: !editing,
          onInput: (value) => Message.ChangedTransitionEvent({ value }),
        },
        h,
      ),
      UiField.input(
        {
          id: "statechart-transition-guard",
          label: "Guard",
          value: edge.data.guard ?? "",
          placeholder: "Optional condition",
          isDisabled: !editing,
          onInput: (value) => Message.ChangedTransitionGuard({ value }),
        },
        h,
      ),
      editing
        ? UiButton.view(
            {
              label: "Delete transition",
              variant: "danger",
              isFullWidth: true,
              onClick: Message.ClickedDeleteSelection(),
            },
            h,
          )
        : h.empty,
    ],
    h,
  );
};

const noteInspector = (
  model: Model,
  noteId: string,
  derived: Derived,
  h: HtmlBuilder<Message>,
): Html => {
  const note = findAnnotation(derived.document, noteId);
  if (note === undefined) return h.empty;
  return section(
    "Note",
    [
      UiField.textarea(
        {
          id: "statechart-note-text",
          label: "Text",
          value: note.data.text,
          minRows: 4,
          isDisabled: model.mode !== "Edit",
          onInput: (value) => Message.ChangedNoteText({ value }),
        },
        h,
      ),
      h.p(
        [h.Class(className(styles.muted))],
        [
          (note.attachedTo ?? []).length === 0
            ? "A free-floating note."
            : `Attached to ${(note.attachedTo ?? [])
                .map(
                  (id) =>
                    findNode(derived.document, id)?.data.name ??
                    findEdge(derived.document, id)?.data.event ??
                    id,
                )
                .join(", ")}.`,
        ],
      ),
      model.mode === "Edit"
        ? UiButton.view(
            {
              label: "Delete note",
              variant: "danger",
              isFullWidth: true,
              onClick: Message.ClickedDeleteSelection(),
            },
            h,
          )
        : h.empty,
    ],
    h,
  );
};

const inspectorView = (model: Model, derived: Derived, h: HtmlBuilder<Message>): Html => {
  const [selected] = model.canvas.selection;
  const state = selected === undefined ? undefined : findNode(derived.document, selected);
  const detail =
    selected === undefined
      ? overviewView(model, derived, h)
      : state !== undefined
        ? stateInspector(model, state, derived, h)
        : findEdge(derived.document, selected) !== undefined
          ? transitionInspector(model, selected, derived, h)
          : noteInspector(model, selected, derived, h);
  return h.aside(
    [h.Class(className(styles.inspector)), h.AriaLabel("Statechart inspector")],
    [model.mode === "Simulate" ? simulationView(model, derived, h) : h.empty, detail],
  );
};

// Palette and toolbar ------------------------------------------------------

const paletteItems: ReadonlyArray<
  Readonly<{ kind: StateKind; label: string; description: string }>
> = [
  { kind: "atomic", label: "State", description: "A leaf state" },
  { kind: "compound", label: "Compound state", description: "Nests child states" },
  { kind: "parallel", label: "Parallel state", description: "Runs regions together" },
  { kind: "initial", label: "Initial state", description: "Entry point of a level" },
  { kind: "final", label: "Final state", description: "Completes a level" },
  { kind: "submachine", label: "Submachine", description: "Runs another machine" },
];

const paletteButton = (
  icon: LucideIconData,
  label: string,
  description: string,
  onClick: Message,
  isDisabled: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.li(
    [],
    [
      h.button(
        [
          h.Type("button"),
          h.Class(className(styles.paletteButton)),
          h.OnClick(onClick),
          h.Disabled(isDisabled),
          h.DataAttribute("palette-item", label),
        ],
        [
          h.span(
            [h.Class(className(styles.paletteIcon))],
            [UiIcon.view({ icon, size: 15, strokeWidth: 2.1 }, h)],
          ),
          h.span(
            [],
            [
              h.p([h.Class(className(styles.paletteName))], [label]),
              h.p([h.Class(className(styles.paletteDescription))], [description]),
            ],
          ),
        ],
      ),
    ],
  );

const paletteView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const editing = model.mode === "Edit";
  return h.div(
    [],
    [
      h.div(
        [h.Class(className(styles.paletteSection))],
        [
          h.p([h.Class(className(styles.paletteLabel))], ["Add to selection"]),
          h.ul(
            [h.Class(className(styles.paletteList))],
            [
              ...paletteItems.map((item) =>
                paletteButton(
                  kindIcons[item.kind],
                  item.label,
                  item.description,
                  Message.ClickedAddState({ kind: item.kind }),
                  !editing,
                  h,
                ),
              ),
              paletteButton(
                StickyNote,
                "Note",
                "Annotate the selection",
                Message.ClickedAddNote(),
                !editing,
                h,
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class(className(styles.paletteSection))],
        [
          h.p([h.Class(className(styles.paletteLabel))], ["Machines"]),
          h.ul(
            [h.Class(className(styles.paletteList))],
            model.library.machines.map((machine) =>
              paletteButton(
                machine.id === model.library.rootMachineId ? Workflow : Scan,
                machine.name,
                machine.id === currentMachineId(model)
                  ? "Editing"
                  : `${machine.document.nodes.filter((node) => node.data.kind !== "initial").length} states`,
                Message.ClickedOpenMachine({ machineId: machine.id }),
                machine.id === currentMachineId(model),
                h,
              ),
            ),
          ),
        ],
      ),
    ],
  );
};

const toolbarView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class(className(styles.toolbar))],
    [
      UiButton.view(
        {
          icon: Undo2,
          ariaLabel: "Undo",
          variant: "ghost",
          size: "icon",
          isDisabled: !History.canUndo(model.history),
          onClick: Message.ClickedUndo(),
          attributes: [h.Title("Undo (⌘Z)")],
        },
        h,
      ),
      UiButton.view(
        {
          icon: Redo2,
          ariaLabel: "Redo",
          variant: "ghost",
          size: "icon",
          isDisabled: !History.canRedo(model.history),
          onClick: Message.ClickedRedo(),
          attributes: [h.Title("Redo (⌘⇧Z)")],
        },
        h,
      ),
      UiSegmentedControl.view(
        {
          value: model.mode,
          ariaLabel: "Statechart mode",
          options: [
            { value: "Edit", label: "Edit" },
            { value: "Simulate", label: "Simulate" },
          ],
          onChange: (mode) => Message.SelectedMode({ mode }),
        },
        h,
      ),
      UiSegmentedControl.view(
        {
          value: model.direction,
          ariaLabel: "Layout direction",
          options: [
            { value: "Down", label: "Top-down" },
            { value: "Right", label: "Left-right" },
          ],
          onChange: (direction) => Message.SelectedDirection({ direction }),
        },
        h,
      ),
      UiButton.view(
        {
          label: "Auto layout",
          icon: LayoutGrid,
          variant: "outline",
          size: "sm",
          isDisabled: model.mode !== "Edit",
          onClick: Message.ClickedAutoLayout(),
        },
        h,
      ),
      UiButton.view(
        {
          label: "Reset",
          icon: RotateCcw,
          ariaLabel: "Reset example",
          variant: "outline",
          size: "sm",
          onClick: Message.ClickedReset(),
        },
        h,
      ),
    ],
  );

export type ViewInputs = Readonly<{
  region: "Palette" | "Toolbar" | "Content";
}>;

export const view = defineView<Model, Message, ViewInputs>((model, inputs, h) => {
  switch (inputs.region) {
    case "Palette":
      return paletteView(model, h);
    case "Toolbar":
      return toolbarView(model, h);
    case "Content": {
      const derived = derive(model);
      return h.div(
        [h.Class(className(styles.workspace))],
        [canvasView(model, derived, h), inspectorView(model, derived, h)],
      );
    }
  }
});

export const statechartSummary = (model: Model): string => {
  const document = currentDocument(model);
  const machine = findMachine(model.library, currentMachineId(model));
  return `${machine?.name ?? "Machine"} · ${document.nodes.length} states · ${model.library.machines.length} machines`;
};
