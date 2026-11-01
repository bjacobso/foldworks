import { Effect, Option, Schema as S } from "effect";
import { Command, Subscription, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { Html, HtmlBuilder } from "foldkit/html";

import {
  ancestorIds,
  childrenOf,
  type DiagramDocument,
  type DiagramNode,
  type NoteData,
} from "./document";
import { createLayeredLayout, type LayeredDirection } from "./layout";
import * as Diagram from "./interaction";

export type GraphTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";
export type GraphNodeData = Readonly<{ label: string; description?: string; tone?: GraphTone }>;
export type GraphEdgeData = Readonly<{ label?: string; tone?: GraphTone }>;
export type GraphDocument = DiagramDocument<GraphNodeData, GraphEdgeData>;

export const Model = S.Struct({
  canvas: Diagram.Model,
  collapsedIds: S.Array(S.String),
  focusId: S.Option(S.String),
  hops: S.Number,
  direction: S.Literals(["Down", "Right"]),
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  GotCanvasMessage: { message: Diagram.Message },
  SelectedNode: { id: S.String },
  ActivatedNode: { id: S.String },
  ToggledNode: { id: S.String },
  ChangedNeighborhood: { id: S.Option(S.String), hops: S.Number },
  RequestedFit: {},
  MeasuredCanvas: { width: S.Number, height: S.Number, focusId: S.Option(S.String) },
  RequestedFocus: { id: S.String },
  CompletedFocus: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Selected: { id: S.String },
  ClearedSelection: {},
  Activated: { id: S.String },
  ChangedExpansion: { id: S.String, isExpanded: S.Boolean },
});
export type OutMessage = typeof OutMessage.Type;

export const init = (
  config: Readonly<{
    id: string;
    collapsedIds?: readonly string[];
    focusId?: string;
    hops?: number;
    direction?: LayeredDirection;
  }>,
): Model => ({
  canvas: Diagram.init({ id: config.id }),
  collapsedIds: config.collapsedIds ?? [],
  focusId: Option.fromUndefinedOr(config.focusId),
  hops: Number.isFinite(config.hops) ? Math.max(0, Math.floor(config.hops!)) : 1,
  direction: config.direction ?? "Down",
});

/** Undirected N-hop exploration, preserving document order and handling cycles. */
export const neighborhoodIds = (
  document: GraphDocument,
  id: string,
  hops: number,
): ReadonlySet<string> => {
  const ids = new Set<string>();
  if (!document.nodes.some((node) => node.id === id)) return ids;
  ids.add(id);
  const neighbors = new Map<string, string[]>();
  for (const edge of document.edges) {
    neighbors.set(edge.source.nodeId, [
      ...(neighbors.get(edge.source.nodeId) ?? []),
      edge.target.nodeId,
    ]);
    neighbors.set(edge.target.nodeId, [
      ...(neighbors.get(edge.target.nodeId) ?? []),
      edge.source.nodeId,
    ]);
  }
  let frontier = [id];
  const limit = Number.isFinite(hops)
    ? Math.min(document.nodes.length, Math.max(0, Math.floor(hops)))
    : 0;
  const known = new Set(document.nodes.map((node) => node.id));
  for (let depth = 0; depth < limit; depth++) {
    const next: string[] = [];
    for (const node of frontier)
      for (const neighbor of neighbors.get(node) ?? []) {
        if (ids.has(neighbor) || !known.has(neighbor)) continue;
        ids.add(neighbor);
        next.push(neighbor);
      }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return ids;
};

/** Hide collapsed descendants and reroute external edges to the collapsed parent. */
export const visibleDocument = (model: Model, document: GraphDocument): GraphDocument => {
  const focus = Option.getOrUndefined(model.focusId);
  const neighborhood =
    focus === undefined ? undefined : new Set(neighborhoodIds(document, focus, model.hops));
  if (neighborhood !== undefined)
    for (const id of [...neighborhood])
      for (const ancestor of ancestorIds(document.nodes, id)) neighborhood.add(ancestor);
  const nodes = document.nodes.filter(
    (node) =>
      (neighborhood === undefined || neighborhood.has(node.id)) &&
      !ancestorIds(document.nodes, node.id).some((id) => model.collapsedIds.includes(id)),
  );
  const shown = new Set(nodes.map((node) => node.id));
  const endpoint = (id: string) =>
    shown.has(id) ? id : ancestorIds(document.nodes, id).find((ancestor) => shown.has(ancestor));
  const edges = document.edges.flatMap((edge) => {
    // Neighborhood filtering must not invent edges from nodes outside the neighborhood.
    if (
      neighborhood !== undefined &&
      (!neighborhood.has(edge.source.nodeId) || !neighborhood.has(edge.target.nodeId))
    )
      return [];
    const source = endpoint(edge.source.nodeId);
    const target = endpoint(edge.target.nodeId);
    if (
      source === undefined ||
      target === undefined ||
      (source === target && edge.source.nodeId !== edge.target.nodeId)
    )
      return [];
    return [
      {
        ...edge,
        source: source === edge.source.nodeId ? edge.source : { nodeId: source },
        target: target === edge.target.nodeId ? edge.target : { nodeId: target },
      },
    ];
  });
  return { nodes, edges, annotations: [] };
};

export const layout = (document: GraphDocument, direction: LayeredDirection = "Down") =>
  createLayeredLayout<GraphNodeData, GraphEdgeData, NoteData>({
    nodeSize: (node) => node.size ?? { width: 180, height: 64 },
    direction,
    edgeRouting: "Orthogonal",
    containerPadding: { top: 76, right: 24, bottom: 24, left: 24 },
  })(document);

/** Up/down follow incoming/outgoing edges; left/right walk siblings in source order. */
export const navigationTarget = (
  document: GraphDocument,
  id: string,
  key: string,
  direction: LayeredDirection = "Down",
): string | undefined => {
  const node = document.nodes.find((node) => node.id === id);
  if (node === undefined) return undefined;
  const previous = direction === "Down" ? "ArrowUp" : "ArrowLeft";
  const next = direction === "Down" ? "ArrowDown" : "ArrowRight";
  if (key === previous || key === next) {
    const edge = document.edges.find((edge) =>
      key === next
        ? edge.source.nodeId === id && edge.target.nodeId !== id
        : edge.target.nodeId === id && edge.source.nodeId !== id,
    );
    return key === next ? edge?.target.nodeId : edge?.source.nodeId;
  }
  const siblings = childrenOf(document.nodes, node.parentId);
  const at = siblings.findIndex((sibling) => sibling.id === id);
  const offset =
    key === (direction === "Down" ? "ArrowLeft" : "ArrowUp")
      ? -1
      : key === (direction === "Down" ? "ArrowRight" : "ArrowDown")
        ? 1
        : 0;
  return offset === 0 ? undefined : siblings[at + offset]?.id;
};

const MeasureCanvas = Command.define("MeasureGraphCanvas", {
  args: { id: S.String, focusId: S.Option(S.String) },
  messages: [Message.MeasuredCanvas],
  execute: ({ id, focusId }) =>
    Effect.sync(() => {
      const canvas = document.getElementById(id)?.querySelector<HTMLElement>("[data-graph-canvas]");
      return Message.MeasuredCanvas({
        width: canvas?.clientWidth ?? 800,
        height: canvas?.clientHeight ?? 500,
        focusId,
      });
    }),
});
const FocusNode = Command.define("FocusGraphNode", {
  args: { id: S.String, nodeId: S.String },
  messages: [Message.CompletedFocus],
  execute: ({ id, nodeId }) =>
    Effect.promise(
      () =>
        new Promise<typeof Message.CompletedFocus.Type>((resolve) =>
          requestAnimationFrame(() => {
            document
              .getElementById(id)
              ?.querySelector<HTMLElement>(`[data-graph-node="${CSS.escape(nodeId)}"]`)
              ?.focus({ preventScroll: true });
            resolve(Message.CompletedFocus());
          }),
        ),
    ),
});

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>;
const select = (model: Model, id: string): UpdateReturn => ({
  model: { ...model, canvas: Diagram.select(model.canvas, [id]) },
  outMessage: OutMessage.Selected({ id }),
});

/** The host supplies its document; graph interaction never edits it. */
export const update = (model: Model, message: Message, document: GraphDocument): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    GotCanvasMessage: ({ message }) => {
      const result = Diagram.update(model.canvas, message);
      return {
        model: { ...model, canvas: result.model },
        ...(result.outMessage?._tag === "ChangedSelection" && result.outMessage.ids.length === 0
          ? { outMessage: OutMessage.ClearedSelection() }
          : {}),
      };
    },
    SelectedNode: ({ id }) =>
      document.nodes.some((node) => node.id === id) ? select(model, id) : { model },
    ActivatedNode: ({ id }) =>
      document.nodes.some((node) => node.id === id)
        ? {
            model: { ...model, canvas: Diagram.select(model.canvas, [id]) },
            outMessage: OutMessage.Activated({ id }),
          }
        : { model },
    ToggledNode: ({ id }) => {
      if (!document.nodes.some((node) => node.id === id)) return { model };
      const isExpanded = model.collapsedIds.includes(id);
      const next = {
        ...model,
        collapsedIds: isExpanded
          ? model.collapsedIds.filter((key) => key !== id)
          : [...model.collapsedIds, id],
      };
      const selected = model.canvas.selection[0];
      if (selected !== undefined && ancestorIds(document.nodes, selected).includes(id))
        next.canvas = Diagram.select(model.canvas, [id]);
      return { model: next, outMessage: OutMessage.ChangedExpansion({ id, isExpanded }) };
    },
    ChangedNeighborhood: ({ id, hops }) => ({
      model: {
        ...model,
        focusId: id,
        hops: Number.isFinite(hops) ? Math.max(0, Math.floor(hops)) : 1,
      },
    }),
    RequestedFit: () => ({
      model,
      commands: [MeasureCanvas({ id: model.canvas.id, focusId: Option.none() })],
    }),
    RequestedFocus: ({ id }) => {
      if (!document.nodes.some((node) => node.id === id)) return { model };
      const ancestors = ancestorIds(document.nodes, id);
      const next = {
        ...model,
        collapsedIds: model.collapsedIds.filter((key) => !ancestors.includes(key)),
        focusId: Option.isSome(model.focusId) ? Option.some(id) : model.focusId,
        canvas: Diagram.select(model.canvas, [id]),
      };
      return {
        model: next,
        commands: [
          MeasureCanvas({ id: model.canvas.id, focusId: Option.some(id) }),
          FocusNode({ id: model.canvas.id, nodeId: id }),
        ],
      };
    },
    MeasuredCanvas: ({ width, height, focusId }) => {
      const scene = layout(visibleDocument(model, document), model.direction);
      const focused = Option.isSome(focusId) ? scene.nodes.get(focusId.value) : undefined;
      const bounds = focused ?? scene.bounds;
      return {
        model: {
          ...model,
          canvas: { ...model.canvas, viewport: Diagram.fitViewport(bounds, { width, height }) },
        },
      };
    },
    CompletedFocus: () => ({ model }),
  });

const canvasSubscriptions = Subscription.lift(Diagram.subscriptions)<Model, Message>({
  read: (model) => Option.some(model.canvas),
  toParentMessage: (message) => Message.GotCanvasMessage({ message }),
});

export const subscriptions = {
  graphDocumentPointer: canvasSubscriptions.documentPointer,
  graphDocumentEscape: canvasSubscriptions.documentEscape,
};

export type ViewConfig<ParentMessage> = Readonly<{
  model: Model;
  document: GraphDocument;
  toParentMessage: (message: Message) => ParentMessage;
  label?: string;
  height?: number;
  showList?: boolean;
}>;

export const view = <ParentMessage>(
  config: ViewConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { model, toParentMessage: send } = config;
  const document = visibleDocument(model, config.document);
  const scene = layout(document, model.direction);
  const edgeById = new Map(document.edges.map((edge) => [edge.id, edge]));
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  const candidate = model.canvas.selection[0];
  const selected = document.nodes.some((node) => node.id === candidate)
    ? candidate
    : document.nodes[0]?.id;
  const nodeAttrs = (node: DiagramNode<GraphNodeData>, isList = false) => [
    h.Type("button"),
    h.DataAttribute(isList ? "graph-list-node" : "graph-node", node.id),
    h.DataAttribute(
      isList ? "graph-list-dom-id" : "graph-dom-id",
      `${encodeURIComponent(model.canvas.id)}:${encodeURIComponent(node.id)}`,
    ),
    h.DataAttribute("tone", node.data.tone ?? "neutral"),
    h.AriaPressed(model.canvas.selection.includes(node.id) ? "true" : "false"),
    h.AriaLabel(
      node.data.description === undefined
        ? node.data.label
        : `${node.data.label}: ${node.data.description}`,
    ),
    h.OnClick(send(Message.SelectedNode({ id: node.id }))),
    h.OnDoubleClick(send(Message.ActivatedNode({ id: node.id }))),
    h.OnKeyDownFocus((key) => {
      if (key === "Enter")
        return Option.some({
          focusSelector: `[data-${isList ? "graph-list-dom-id" : "graph-dom-id"}="${encodeURIComponent(model.canvas.id)}:${encodeURIComponent(node.id)}"]`,
          message: send(Message.ActivatedNode({ id: node.id })),
        });
      const target = navigationTarget(document, node.id, key, model.direction);
      return target === undefined
        ? Option.none()
        : Option.some({
            focusSelector: `[data-${isList ? "graph-list-dom-id" : "graph-dom-id"}="${encodeURIComponent(model.canvas.id)}:${encodeURIComponent(target)}"]`,
            message: send(Message.SelectedNode({ id: target })),
          });
    }),
  ];
  const canvasSend = (message: Diagram.Message) => send(Message.GotCanvasMessage({ message }));
  return h.section(
    [h.Id(model.canvas.id), h.Class("fw-graph"), h.AriaLabel(config.label ?? "Graph")],
    [
      h.div(
        [h.Class("fw-graph__toolbar"), h.Role("toolbar"), h.AriaLabel("Graph controls")],
        [
          h.button([h.Type("button"), h.OnClick(send(Message.RequestedFit()))], ["Fit graph"]),
          h.button(
            [h.Type("button"), h.OnClick(canvasSend(Diagram.Message.ClickedZoomOut()))],
            ["Zoom out"],
          ),
          h.button(
            [h.Type("button"), h.OnClick(canvasSend(Diagram.Message.ClickedZoomIn()))],
            ["Zoom in"],
          ),
          ...(Option.isNone(model.focusId)
            ? []
            : [
                h.button(
                  [
                    h.Type("button"),
                    h.OnClick(
                      send(
                        Message.ChangedNeighborhood({ id: model.focusId, hops: model.hops + 1 }),
                      ),
                    ),
                  ],
                  ["Expand neighborhood"],
                ),
                h.button(
                  [
                    h.Type("button"),
                    h.Disabled(model.hops <= 0),
                    h.OnClick(
                      send(
                        Message.ChangedNeighborhood({
                          id: model.focusId,
                          hops: Math.max(0, model.hops - 1),
                        }),
                      ),
                    ),
                  ],
                  ["Collapse neighborhood"],
                ),
                h.button(
                  [
                    h.Type("button"),
                    h.OnClick(
                      send(Message.ChangedNeighborhood({ id: Option.none(), hops: model.hops })),
                    ),
                  ],
                  ["Show all"],
                ),
              ]),
        ],
      ),
      h.div(
        [
          h.Class("fw-graph__canvas"),
          h.DataAttribute("graph-canvas", "true"),
          h.Style({ height: `${config.height ?? 500}px` }),
        ],
        [
          h.div(
            [
              ...Diagram.canvasAttributes({ model: model.canvas, toParentMessage: canvasSend }, h),
              h.Class("fw-graph__background"),
            ],
            [],
          ),
          h.div(
            [
              h.Class("fw-graph__world"),
              h.Style({ transform: Diagram.worldTransform(model.canvas) }),
            ],
            [
              h.svg(
                [
                  h.Class("fw-graph__edges"),
                  h.AriaHidden(true),
                  h.Width(String(Math.max(1, scene.bounds.x + scene.bounds.width))),
                  h.Height(String(Math.max(1, scene.bounds.y + scene.bounds.height))),
                ],
                scene.edges.flatMap((edge) => {
                  const data = edgeById.get(edge.id)?.data;
                  const points = edge.points;
                  const last = points.at(-1);
                  const previous = points.at(-2);
                  const arrow =
                    last === undefined || previous === undefined
                      ? []
                      : (() => {
                          const angle = Math.atan2(last.y - previous.y, last.x - previous.x);
                          const back = {
                            x: last.x - 9 * Math.cos(angle),
                            y: last.y - 9 * Math.sin(angle),
                          };
                          return [
                            h.polyline(
                              [
                                h.Points(
                                  `${back.x + 4 * Math.sin(angle)},${back.y - 4 * Math.cos(angle)} ${last.x},${last.y} ${back.x - 4 * Math.sin(angle)},${back.y + 4 * Math.cos(angle)}`,
                                ),
                              ],
                              [],
                            ),
                          ];
                        })();
                  return [
                    h.g(
                      [h.DataAttribute("tone", data?.tone ?? "neutral")],
                      [
                        h.polyline(
                          [h.Points(points.map((point) => `${point.x},${point.y}`).join(" "))],
                          [],
                        ),
                        ...arrow,
                      ],
                    ),
                  ];
                }),
              ),
              ...[...scene.nodes.values()].map((position) => {
                const node = nodeById.get(position.id)!;
                const hasChildren = config.document.nodes.some(
                  (child) => child.parentId === node.id,
                );
                return h.keyed("div")(
                  node.id,
                  [
                    h.Class("fw-graph__node"),
                    h.DataAttribute("container", position.isContainer ? "true" : "false"),
                    h.DataAttribute("tone", node.data.tone ?? "neutral"),
                    h.Style({
                      left: `${position.x}px`,
                      top: `${position.y}px`,
                      width: `${position.width}px`,
                      height: `${position.height}px`,
                    }),
                  ],
                  [
                    h.button(
                      [
                        ...nodeAttrs(node),
                        h.Class("fw-graph__node-label"),
                        h.Tabindex(node.id === selected ? 0 : -1),
                      ],
                      [node.data.label],
                    ),
                    ...(hasChildren
                      ? [
                          h.button(
                            [
                              h.Type("button"),
                              h.Class("fw-graph__disclosure"),
                              h.AriaLabel(
                                `${model.collapsedIds.includes(node.id) ? "Expand" : "Collapse"} ${node.data.label}`,
                              ),
                              h.AriaExpanded(!model.collapsedIds.includes(node.id)),
                              h.OnClick(send(Message.ToggledNode({ id: node.id }))),
                            ],
                            [model.collapsedIds.includes(node.id) ? "+" : "−"],
                          ),
                        ]
                      : []),
                  ],
                );
              }),
              // Labels paint above node headers; compound edges can pass through them.
              h.svg(
                [
                  h.Class("fw-graph__edges"),
                  h.AriaHidden(true),
                  h.Width(String(Math.max(1, scene.bounds.x + scene.bounds.width))),
                  h.Height(String(Math.max(1, scene.bounds.y + scene.bounds.height))),
                ],
                scene.edges.flatMap((edge) => {
                  const data = edgeById.get(edge.id)?.data;
                  return data?.label === undefined || edge.labelPosition === undefined
                    ? []
                    : [
                        h.g(
                          [h.DataAttribute("tone", data.tone ?? "neutral")],
                          [
                            h.text(
                              [
                                h.X(String(edge.labelPosition.x)),
                                h.Y(String(edge.labelPosition.y - 6)),
                                h.TextAnchor("middle"),
                              ],
                              [data.label],
                            ),
                          ],
                        ),
                      ];
                }),
              ),
            ],
          ),
        ],
      ),
      ...(config.showList === false
        ? []
        : [
            h.details(
              [h.Class("fw-graph__list")],
              [
                h.summary([], ["Graph as a list"]),
                h.ul(
                  [],
                  document.nodes.map((node) =>
                    h.li(
                      [],
                      [
                        h.button([...nodeAttrs(node, true)], [node.data.label]),
                        ...(config.document.nodes.some((child) => child.parentId === node.id)
                          ? [
                              h.button(
                                [
                                  h.Type("button"),
                                  h.AriaExpanded(!model.collapsedIds.includes(node.id)),
                                  h.OnClick(send(Message.ToggledNode({ id: node.id }))),
                                ],
                                [model.collapsedIds.includes(node.id) ? "Expand" : "Collapse"],
                              ),
                            ]
                          : []),
                        h.ul(
                          [],
                          document.edges
                            .filter((edge) => edge.source.nodeId === node.id)
                            .map((edge) =>
                              h.li(
                                [],
                                [
                                  `${edge.data.label ?? "To"}: ${document.nodes.find((target) => target.id === edge.target.nodeId)?.data.label ?? edge.target.nodeId}`,
                                ],
                              ),
                            ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ]),
    ],
  );
};
