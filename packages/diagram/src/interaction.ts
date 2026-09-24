import { Effect, Option, Schema as S, Stream } from "effect";
import { Subscription } from "foldkit";
import type { Attribute, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { defineTaggedUnion } from "foldkit/schema";
import type * as Update from "foldkit/update";

import { EndpointSchema, type Endpoint } from "./document";
import type { Point } from "./geometry";

export const DEFAULT_ACTIVATION_THRESHOLD = 4;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;
const ZOOM_STEP = 1.2;

const Viewport = S.Struct({ x: S.Number, y: S.Number, zoom: S.Number });
export type Viewport = typeof Viewport.Type;

const Gesture = defineTaggedUnion({
  Idle: {},
  Pressing: {
    ids: S.Array(S.String),
    primaryId: S.String,
    isMovable: S.Boolean,
    originClientX: S.Number,
    originClientY: S.Number,
    anchorX: S.Number,
    anchorY: S.Number,
  },
  Dragging: {
    ids: S.Array(S.String),
    primaryId: S.String,
    originClientX: S.Number,
    originClientY: S.Number,
    anchorX: S.Number,
    anchorY: S.Number,
    deltaX: S.Number,
    deltaY: S.Number,
  },
  Connecting: {
    source: EndpointSchema,
    originClientX: S.Number,
    originClientY: S.Number,
    anchorX: S.Number,
    anchorY: S.Number,
    currentX: S.Number,
    currentY: S.Number,
  },
  Panning: {
    originClientX: S.Number,
    originClientY: S.Number,
    startX: S.Number,
    startY: S.Number,
    hasMoved: S.Boolean,
  },
});
export type Gesture = typeof Gesture.Type;

/** Canvas interaction state: viewport, selection, and the active pointer
 *  gesture. Documents stay in the application; this model only reports
 *  intent through OutMessages. */
export const Model = S.Struct({
  id: S.String,
  viewport: Viewport,
  selection: S.Array(S.String),
  activationThreshold: S.Number,
  gesture: Gesture,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  PressedElement: {
    id: S.String,
    isMovable: S.Boolean,
    clientX: S.Number,
    clientY: S.Number,
    anchorX: S.Number,
    anchorY: S.Number,
  },
  PressedPort: {
    source: EndpointSchema,
    clientX: S.Number,
    clientY: S.Number,
    anchorX: S.Number,
    anchorY: S.Number,
  },
  PressedCanvas: { clientX: S.Number, clientY: S.Number },
  MovedPointer: { clientX: S.Number, clientY: S.Number },
  ReleasedPointer: {},
  CancelledGesture: {},
  PressedElementKey: { id: S.String, key: S.String, shiftKey: S.Boolean },
  SelectedElements: { ids: S.Array(S.String) },
  ClickedZoomIn: {},
  ClickedZoomOut: {},
  ClickedResetViewport: {},
  ChangedViewport: { x: S.Number, y: S.Number, zoom: S.Number },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  ChangedSelection: { ids: S.Array(S.String) },
  Clicked: { id: S.String },
  /** Elements were dragged or nudged by a world-space delta. `dropX` and
   *  `dropY` are the new center of the primary element, for hit testing a
   *  container to nest into. */
  MovedElements: {
    ids: S.Array(S.String),
    primaryId: S.String,
    deltaX: S.Number,
    deltaY: S.Number,
    dropX: S.Number,
    dropY: S.Number,
    isKeyboard: S.Boolean,
  },
  /** A connection was dragged from `source` and released at a world point. */
  RequestedConnection: { source: EndpointSchema, x: S.Number, y: S.Number },
  RequestedDelete: { ids: S.Array(S.String) },
  Cancelled: {},
});
export type OutMessage = typeof OutMessage.Type;

export type InitConfig = Readonly<{
  id: string;
  viewport?: Viewport;
  selection?: ReadonlyArray<string>;
  activationThreshold?: number;
}>;

export const init = (config: InitConfig): Model => ({
  id: config.id,
  viewport: config.viewport ?? { x: 0, y: 0, zoom: 1 },
  selection: config.selection ?? [],
  activationThreshold: config.activationThreshold ?? DEFAULT_ACTIVATION_THRESHOLD,
  gesture: Gesture.Idle(),
});

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>;

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

const sameIds = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((id, index) => b[index] === id);

const withSelection = (model: Model, ids: ReadonlyArray<string>): UpdateReturn =>
  sameIds(model.selection, ids)
    ? { model }
    : { model: { ...model, selection: ids }, outMessage: OutMessage.ChangedSelection({ ids }) };

const idle = (model: Model): Model => ({ ...model, gesture: Gesture.Idle() });

const NUDGE: Readonly<Record<string, Point>> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** Zooms around a point in screen space, keeping it fixed on screen. */
export const zoomAt = (
  viewport: Viewport,
  zoom: number,
  focus: Point = { x: 0, y: 0 },
): Viewport => {
  const next = clampZoom(zoom);
  const ratio = next / viewport.zoom;
  return {
    zoom: next,
    x: focus.x - (focus.x - viewport.x) * ratio,
    y: focus.y - (focus.y - viewport.y) * ratio,
  };
};

export const screenToWorld = (viewport: Viewport, point: Point): Point => ({
  x: (point.x - viewport.x) / viewport.zoom,
  y: (point.y - viewport.y) / viewport.zoom,
});

export const worldToScreen = (viewport: Viewport, point: Point): Point => ({
  x: point.x * viewport.zoom + viewport.x,
  y: point.y * viewport.zoom + viewport.y,
});

/** Computes a viewport that fits `bounds` inside a screen area of the given
 *  size with padding. */
export const fitViewport = (
  bounds: Readonly<{ x: number; y: number; width: number; height: number }>,
  screen: Readonly<{ width: number; height: number }>,
  padding = 48,
): Viewport => {
  const zoom = clampZoom(
    Math.min(
      1,
      (screen.width - padding * 2) / Math.max(bounds.width, 1),
      (screen.height - padding * 2) / Math.max(bounds.height, 1),
    ),
  );
  return {
    zoom,
    x: (screen.width - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (screen.height - bounds.height * zoom) / 2 - bounds.y * zoom,
  };
};

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    PressedElement: ({ id, isMovable, clientX, clientY, anchorX, anchorY }) => {
      // Nested elements bubble their presses to ancestors; the innermost
      // element is dispatched first and claims the gesture.
      if (model.gesture._tag !== "Idle") return { model };
      const ids = model.selection.includes(id) ? model.selection : [id];
      return {
        model: {
          ...model,
          gesture: Gesture.Pressing({
            ids,
            primaryId: id,
            isMovable,
            originClientX: clientX,
            originClientY: clientY,
            anchorX,
            anchorY,
          }),
        },
      };
    },
    PressedPort: ({ source, clientX, clientY, anchorX, anchorY }) => {
      if (model.gesture._tag !== "Idle") return { model };
      return {
        model: {
          ...model,
          gesture: Gesture.Connecting({
            source,
            originClientX: clientX,
            originClientY: clientY,
            anchorX,
            anchorY,
            currentX: anchorX,
            currentY: anchorY,
          }),
        },
      };
    },
    PressedCanvas: ({ clientX, clientY }) => {
      if (model.gesture._tag !== "Idle") return { model };
      return {
        model: {
          ...model,
          gesture: Gesture.Panning({
            originClientX: clientX,
            originClientY: clientY,
            startX: model.viewport.x,
            startY: model.viewport.y,
            hasMoved: false,
          }),
        },
      };
    },
    MovedPointer: ({ clientX, clientY }) => {
      const gesture = model.gesture;
      const zoom = model.viewport.zoom;
      switch (gesture._tag) {
        case "Idle":
          return { model };
        case "Pressing": {
          const distance = Math.hypot(
            clientX - gesture.originClientX,
            clientY - gesture.originClientY,
          );
          if (!gesture.isMovable || distance < model.activationThreshold) return { model };
          const selection = gesture.ids;
          return {
            model: {
              ...model,
              selection,
              gesture: Gesture.Dragging({
                ids: gesture.ids,
                primaryId: gesture.primaryId,
                originClientX: gesture.originClientX,
                originClientY: gesture.originClientY,
                anchorX: gesture.anchorX,
                anchorY: gesture.anchorY,
                deltaX: (clientX - gesture.originClientX) / zoom,
                deltaY: (clientY - gesture.originClientY) / zoom,
              }),
            },
            ...(sameIds(model.selection, selection)
              ? {}
              : { outMessage: OutMessage.ChangedSelection({ ids: selection }) }),
          };
        }
        case "Dragging":
          return {
            model: {
              ...model,
              gesture: {
                ...gesture,
                deltaX: (clientX - gesture.originClientX) / zoom,
                deltaY: (clientY - gesture.originClientY) / zoom,
              },
            },
          };
        case "Connecting":
          return {
            model: {
              ...model,
              gesture: {
                ...gesture,
                currentX: gesture.anchorX + (clientX - gesture.originClientX) / zoom,
                currentY: gesture.anchorY + (clientY - gesture.originClientY) / zoom,
              },
            },
          };
        case "Panning": {
          const hasMoved =
            gesture.hasMoved ||
            Math.hypot(clientX - gesture.originClientX, clientY - gesture.originClientY) >=
              model.activationThreshold;
          return {
            model: {
              ...model,
              viewport: hasMoved
                ? {
                    ...model.viewport,
                    x: gesture.startX + clientX - gesture.originClientX,
                    y: gesture.startY + clientY - gesture.originClientY,
                  }
                : model.viewport,
              gesture: { ...gesture, hasMoved },
            },
          };
        }
      }
    },
    ReleasedPointer: () => {
      const gesture = model.gesture;
      switch (gesture._tag) {
        case "Idle":
          return { model };
        case "Pressing": {
          const selected = withSelection(idle(model), [gesture.primaryId]);
          return {
            model: selected.model,
            outMessage: OutMessage.Clicked({ id: gesture.primaryId }),
          };
        }
        case "Dragging":
          return {
            model: idle(model),
            outMessage: OutMessage.MovedElements({
              ids: gesture.ids,
              primaryId: gesture.primaryId,
              deltaX: gesture.deltaX,
              deltaY: gesture.deltaY,
              dropX: gesture.anchorX + gesture.deltaX,
              dropY: gesture.anchorY + gesture.deltaY,
              isKeyboard: false,
            }),
          };
        case "Connecting":
          return {
            model: idle(model),
            outMessage: OutMessage.RequestedConnection({
              source: gesture.source,
              x: gesture.currentX,
              y: gesture.currentY,
            }),
          };
        case "Panning":
          return gesture.hasMoved ? { model: idle(model) } : withSelection(idle(model), []);
      }
    },
    CancelledGesture: () => {
      if (model.gesture._tag === "Idle") return withSelection(model, []);
      const restored =
        model.gesture._tag === "Panning"
          ? { ...model.viewport, x: model.gesture.startX, y: model.gesture.startY }
          : model.viewport;
      return {
        model: { ...idle(model), viewport: restored },
        outMessage: OutMessage.Cancelled(),
      };
    },
    PressedElementKey: ({ id, key, shiftKey }) => {
      const ids = model.selection.includes(id) ? model.selection : [id];
      const nudge = NUDGE[key];
      if (nudge !== undefined) {
        const step = shiftKey ? 10 : 1;
        return {
          model: { ...model, selection: ids },
          outMessage: OutMessage.MovedElements({
            ids,
            primaryId: id,
            deltaX: nudge.x * step,
            deltaY: nudge.y * step,
            dropX: Number.NaN,
            dropY: Number.NaN,
            isKeyboard: true,
          }),
        };
      }
      if (key === "Delete" || key === "Backspace") {
        return {
          model: { ...model, selection: [] },
          outMessage: OutMessage.RequestedDelete({ ids }),
        };
      }
      if (key === "Enter" || key === " ") {
        const selected = withSelection(model, [id]);
        return { model: selected.model, outMessage: OutMessage.Clicked({ id }) };
      }
      if (key === "Escape") return withSelection(model, []);
      return { model };
    },
    SelectedElements: ({ ids }) => withSelection(model, ids),
    ClickedZoomIn: () => ({
      model: { ...model, viewport: zoomAt(model.viewport, model.viewport.zoom * ZOOM_STEP) },
    }),
    ClickedZoomOut: () => ({
      model: { ...model, viewport: zoomAt(model.viewport, model.viewport.zoom / ZOOM_STEP) },
    }),
    ClickedResetViewport: () => ({ model: { ...model, viewport: { x: 0, y: 0, zoom: 1 } } }),
    ChangedViewport: ({ x, y, zoom }) => ({
      model: { ...model, viewport: { x, y, zoom: clampZoom(zoom) } },
    }),
  });

/** Replaces the selection without emitting an OutMessage, for applications
 *  that change selection from their own update. */
export const select = (model: Model, ids: ReadonlyArray<string>): Model =>
  sameIds(model.selection, ids) ? model : { ...model, selection: ids };

export const isSelected = (model: Model, id: string): boolean => model.selection.includes(id);

export const isActive = (model: Model): boolean => model.gesture._tag !== "Idle";

export type DragPreview = Readonly<{
  ids: ReadonlyArray<string>;
  primaryId: string;
  delta: Point;
  drop: Point;
}>;

export const maybeDragPreview = (model: Model): Option.Option<DragPreview> =>
  model.gesture._tag === "Dragging"
    ? Option.some({
        ids: model.gesture.ids,
        primaryId: model.gesture.primaryId,
        delta: { x: model.gesture.deltaX, y: model.gesture.deltaY },
        drop: {
          x: model.gesture.anchorX + model.gesture.deltaX,
          y: model.gesture.anchorY + model.gesture.deltaY,
        },
      })
    : Option.none();

export type ConnectionPreview = Readonly<{ source: Endpoint; from: Point; to: Point }>;

export const maybeConnectionPreview = (model: Model): Option.Option<ConnectionPreview> =>
  model.gesture._tag === "Connecting"
    ? Option.some({
        source: model.gesture.source,
        from: { x: model.gesture.anchorX, y: model.gesture.anchorY },
        to: { x: model.gesture.currentX, y: model.gesture.currentY },
      })
    : Option.none();

/** CSS for the world layer. Apply `transform-origin: 0 0` alongside it. */
export const worldTransform = (model: Model): string =>
  `translate(${model.viewport.x}px, ${model.viewport.y}px) scale(${model.viewport.zoom})`;

type AttributeConfig<ParentMessage> = Readonly<{
  model: Model;
  toParentMessage: (message: Message) => ParentMessage;
}>;

/** Attributes for the canvas background: pressing it pans, and releasing it
 *  without moving clears the selection. */
export const canvasAttributes = <ParentMessage>(
  config: AttributeConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Attribute<ParentMessage>> => [
  h.DataAttribute("diagram-canvas", config.model.id),
  h.DataAttribute("diagram-gesture", config.model.gesture._tag.toLowerCase()),
  h.Style({ "touch-action": "none" }),
  h.OnPointerDown((_pointerType, button, _screenX, _screenY, _timeStamp, clientX, clientY) =>
    button === 0
      ? Option.some(config.toParentMessage(Message.PressedCanvas({ clientX, clientY })))
      : Option.none(),
  ),
];

export type ElementAttributeConfig<ParentMessage> = AttributeConfig<ParentMessage> &
  Readonly<{
    id: string;
    /** World-space center of the element, reported back as the drop point. */
    anchor: Point;
    isMovable?: boolean;
    label?: string;
  }>;

/** Attributes for a selectable node, annotation, or edge hit area. Pointer
 *  presses select and drag; arrow keys nudge; Delete requests removal. */
export const elementAttributes = <ParentMessage>(
  config: ElementAttributeConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Attribute<ParentMessage>> => {
  const selected = isSelected(config.model, config.id);
  const dragging =
    config.model.gesture._tag === "Dragging" && config.model.gesture.ids.includes(config.id);
  return [
    h.Tabindex(0),
    h.DataAttribute("diagram-element", config.id),
    h.DataAttribute("selected", selected ? "true" : "false"),
    h.DataAttribute("dragging", dragging ? "true" : "false"),
    h.AriaSelected(selected),
    ...(config.label === undefined ? [] : [h.AriaLabel(config.label)]),
    h.OnPointerDown((_pointerType, button, _screenX, _screenY, _timeStamp, clientX, clientY) =>
      button === 0
        ? Option.some(
            config.toParentMessage(
              Message.PressedElement({
                id: config.id,
                isMovable: config.isMovable ?? true,
                clientX,
                clientY,
                anchorX: config.anchor.x,
                anchorY: config.anchor.y,
              }),
            ),
          )
        : Option.none(),
    ),
    h.OnKeyDownPreventDefault((key, modifiers) =>
      NUDGE[key] !== undefined && config.isMovable === false
        ? Option.none()
        : NUDGE[key] !== undefined || ["Delete", "Backspace", "Enter", " ", "Escape"].includes(key)
          ? Option.some(
              config.toParentMessage(
                Message.PressedElementKey({
                  id: config.id,
                  key,
                  shiftKey: modifiers.shiftKey,
                }),
              ),
            )
          : Option.none(),
    ),
  ];
};

export type PortAttributeConfig<ParentMessage> = AttributeConfig<ParentMessage> &
  Readonly<{ source: Endpoint; anchor: Point; label?: string }>;

/** Attributes for a connection handle. Dragging from it previews a new edge
 *  and emits `RequestedConnection` on release. */
export const portAttributes = <ParentMessage>(
  config: PortAttributeConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Attribute<ParentMessage>> => [
  h.DataAttribute("diagram-port", config.source.portId ?? config.source.nodeId),
  h.DataAttribute("diagram-port-node", config.source.nodeId),
  h.Style({ "touch-action": "none" }),
  ...(config.label === undefined ? [] : [h.AriaLabel(config.label), h.Title(config.label)]),
  h.OnPointerDown((_pointerType, button, _screenX, _screenY, _timeStamp, clientX, clientY) =>
    button === 0
      ? Option.some(
          config.toParentMessage(
            Message.PressedPort({
              source: config.source,
              clientX,
              clientY,
              anchorX: config.anchor.x,
              anchorY: config.anchor.y,
            }),
          ),
        )
      : Option.none(),
  ),
];

/** Document-level pointer tracking while a gesture is active, and Escape to
 *  cancel it. */
export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  documentPointer: entry(
    { isActive: S.Boolean },
    {
      modelToDependencies: (model) => ({ isActive: model.gesture._tag !== "Idle" }),
      dependenciesToStream: ({ isActive }) =>
        Stream.when(
          Stream.mergeAll(
            [
              Stream.fromEventListener<PointerEvent>(document, "pointermove").pipe(
                Stream.map(
                  (event): Message =>
                    Message.MovedPointer({ clientX: event.clientX, clientY: event.clientY }),
                ),
              ),
              Stream.fromEventListener<PointerEvent>(document, "pointerup").pipe(
                Stream.map((): Message => Message.ReleasedPointer()),
              ),
              Stream.fromEventListener<PointerEvent>(document, "pointercancel").pipe(
                Stream.map((): Message => Message.CancelledGesture()),
              ),
            ],
            { concurrency: "unbounded" },
          ),
          Effect.sync(() => isActive),
        ),
    },
  ),
  documentEscape: entry(
    { isActive: S.Boolean },
    {
      modelToDependencies: (model) => ({ isActive: model.gesture._tag !== "Idle" }),
      dependenciesToStream: ({ isActive }) =>
        Stream.when(
          Stream.fromEventListener<KeyboardEvent>(document, "keydown").pipe(
            Stream.filter((event) => event.key === "Escape"),
            Stream.map(() => Message.CancelledGesture()),
          ),
          Effect.sync(() => isActive),
        ),
    },
  ),
}));
