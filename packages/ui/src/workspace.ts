import { Effect, Queue, Schema as S, Stream } from "effect";
import { Command, Dom, Mount, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { Html, HtmlBuilder } from "foldkit/html";
import * as stylex from "@stylexjs/stylex";
import * as Button from "./button";
import { sxAttrs } from "./sx";

/** One controlled split. Nest splits to construct larger workspaces. Sizes are CSS pixels. */
export const Model = S.Struct({
  id: S.String,
  orientation: S.Literals(["Horizontal", "Vertical"]),
  side: S.Literals(["Start", "End"]),
  size: S.Number,
  minSize: S.Number,
  maxSize: S.Number,
  secondaryMinSize: S.Number,
  collapsible: S.Boolean,
  collapsed: S.Boolean,
  extent: S.Number,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  Resized: { size: S.Number },
  CancelledResize: { size: S.Number },
  Measured: { extent: S.Number },
  Toggled: {},
  Focused: {},
});
export type Message = typeof Message.Type;
const handleSize = 8;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const init = (config: Pick<Model, "id"> & Partial<Omit<Model, "id" | "extent">>): Model => {
  const model: Model = {
    orientation: "Horizontal", side: "Start", size: 260,
    minSize: 160, maxSize: 600, secondaryMinSize: 240,
    collapsible: true, collapsed: false, ...config, extent: 0,
  };
  if (!model.id || ![model.size, model.minSize, model.maxSize, model.secondaryMinSize].every(Number.isFinite)
    || model.minSize < 0 || model.secondaryMinSize < 0 || model.maxSize < model.minSize) {
    throw new Error("Workspace requires an ID and finite, nonnegative, ordered size limits.");
  }
  return { ...model, size: clamp(model.size, model.minSize, model.maxSize), collapsed: model.collapsible && model.collapsed };
};

export const maximumSize = (model: Model): number => model.extent > 0
  ? Math.max(model.minSize, Math.min(model.maxSize, model.extent - model.secondaryMinSize - handleSize))
  : model.maxSize;

/** The preferred size survives temporary viewport constraints and collapse/restore. */
export const currentSize = (model: Model): number => model.collapsed ? 0
  : clamp(model.size, model.minSize, maximumSize(model));

const FocusSplitter = Command.define("FocusWorkspaceSplitter", {
  args: { id: S.String }, messages: [Message.Focused],
  execute: ({ id }) => Dom.focus(`#${CSS.escape(id)}-splitter`).pipe(Effect.ignore, Effect.as(Message.Focused())),
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> => Message.match(message, {
  Resized: ({ size }) => ({ model: Number.isFinite(size)
    ? { ...model, size: clamp(size, model.minSize, maximumSize(model)), collapsed: false } : model }),
  CancelledResize: ({ size }) => ({ model: Number.isFinite(size)
    ? { ...model, size: clamp(size, model.minSize, model.maxSize) } : model }),
  Measured: ({ extent }) => ({ model: Number.isFinite(extent) && extent > 0 && extent !== model.extent
    ? { ...model, extent } : model }),
  Toggled: () => model.collapsible
    ? { model: { ...model, collapsed: !model.collapsed }, commands: [FocusSplitter({ id: model.id })] }
    : { model },
  Focused: () => ({ model }),
});

// A scoped input bridge owns browser listeners only; model updates own all layout state.
type BrowserMessage = Exclude<Message, { _tag: "Focused" }>;
const ObserveSplitter = Mount.defineStream("ObserveWorkspaceSplitter", {
  messages: [Message.Resized, Message.CancelledResize, Message.Measured, Message.Toggled],
  execute: ({ element }) => Stream.callback<BrowserMessage>((queue) => Effect.gen(function* () {
    yield* Effect.acquireRelease(Effect.sync(() => {
      const handle = element as HTMLElement;
      const track = handle.parentElement!;
      let drag: { pointer: number; coordinate: number; size: number; preferred: number } | undefined;
      const emit = (message: BrowserMessage) => Queue.offerUnsafe(queue, message);
      const horizontal = () => handle.dataset.axis === "Horizontal";
      const sign = () => (handle.dataset.side === "End" ? -1 : 1)
        * (horizontal() && getComputedStyle(track).direction === "rtl" ? -1 : 1);
      const number = (key: string) => Number(handle.dataset[key]);
      const measure = () => emit(Message.Measured({ extent: horizontal() ? track.clientWidth : track.clientHeight }));
      const finish = (cancel: boolean) => {
        if (!drag) return;
        const previous = drag;
        drag = undefined;
        if (cancel) emit(Message.CancelledResize({ size: previous.preferred }));
        if (handle.hasPointerCapture(previous.pointer)) handle.releasePointerCapture(previous.pointer);
      };
      const down = (event: PointerEvent) => {
        if (!event.isPrimary || event.button !== 0 || handle.dataset.collapsed === "true" || drag) return;
        event.preventDefault();
        handle.focus();
        drag = { pointer: event.pointerId, coordinate: horizontal() ? event.clientX : event.clientY,
          size: number("size"), preferred: number("preferred") };
        handle.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag || drag.pointer !== event.pointerId) return;
        if (handle.dataset.collapsed === "true") { finish(false); return; }
        const coordinate = horizontal() ? event.clientX : event.clientY;
        emit(Message.Resized({ size: drag.size + (coordinate - drag.coordinate) * sign() }));
      };
      const up = (event: PointerEvent) => { if (drag?.pointer === event.pointerId) { move(event); finish(false); } };
      const cancel = (event: PointerEvent) => { if (drag?.pointer === event.pointerId) finish(true); };
      const lost = () => finish(false);
      const key = (event: KeyboardEvent) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const previous = horizontal() ? "ArrowLeft" : "ArrowUp";
        const next = horizontal() ? "ArrowRight" : "ArrowDown";
        let message: BrowserMessage | undefined;
        if (event.key === "Escape" && drag) { event.preventDefault(); finish(true); return; }
        if (event.key === "Enter" && handle.dataset.collapsible === "true") message = Message.Toggled();
        else if (event.key === "Home") message = Message.Resized({ size: number("min") });
        else if (event.key === "End") message = Message.Resized({ size: number("max") });
        else if (event.key === previous || event.key === next) message = Message.Resized({
          size: number("size") + (event.key === next ? 1 : -1) * sign() * (event.shiftKey ? 50 : 10),
        });
        if (message) { event.preventDefault(); emit(message); }
      };
      handle.addEventListener("pointerdown", down);
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", cancel);
      handle.addEventListener("lostpointercapture", lost);
      handle.addEventListener("keydown", key);
      const observer = new ResizeObserver(measure);
      observer.observe(track);
      // Changing the split axis may leave the track's physical box unchanged.
      const axisObserver = new MutationObserver(measure);
      axisObserver.observe(handle, { attributes: true, attributeFilter: ["data-axis"] });
      measure();
      return () => {
        handle.removeEventListener("pointerdown", down);
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", cancel);
        handle.removeEventListener("lostpointercapture", lost);
        handle.removeEventListener("keydown", key);
        observer.disconnect();
        axisObserver.disconnect();
        if (drag && handle.hasPointerCapture(drag.pointer)) handle.releasePointerCapture(drag.pointer);
        drag = undefined;
      };
    }), (dispose) => Effect.sync(dispose));
    return yield* Effect.never;
  })),
});

const styles = stylex.create({
  root: { display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: "minmax(0, 1fr)", minHeight: 0, minWidth: 0, height: "100%", overflow: "auto" },
  track: { display: "grid", minWidth: 0, minHeight: 0 },
  pane: { display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", minWidth: 0, minHeight: 0, overflow: "hidden", backgroundColor: "var(--foldworks-ui-canvas)" },
  header: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "space-between", padding: "8px 12px", minWidth: 0, backgroundColor: "var(--foldworks-ui-surface)", borderBottom: "1px solid var(--foldworks-ui-border)" },
  label: { fontSize: "11px", fontWeight: 650, margin: 0, overflowWrap: "anywhere" },
  body: { minHeight: 0, minWidth: 0, overflow: "auto", overscrollBehavior: "contain" },
  contained: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gridTemplateRows: "minmax(0, 1fr)", overflow: "hidden" },
  handle: { backgroundColor: { default: "var(--foldworks-ui-border)", ":hover": "var(--foldworks-ui-focus)", ":focus-visible": "var(--foldworks-ui-focus)" }, touchAction: "none", userSelect: "none", outline: { default: "none", ":focus-visible": "2px solid var(--foldworks-ui-focus)" }, outlineOffset: "-2px", cursor: "col-resize", zIndex: 1 },
  verticalHandle: { cursor: "row-resize" },
});

export type Pane = Readonly<{
  label: string;
  children: ReadonlyArray<Html | string>;
  /** Auto owns scrolling; Contained lets a nested workspace/editor own it. */
  scroll?: "Auto" | "Contained";
  /** Hide redundant chrome when content already has a heading. Restore controls remain available. */
  showHeader?: boolean;
}>;

export const view = <ParentMessage>(config: Readonly<{
  model: Model;
  primary: Pane;
  secondary: Pane;
  toParentMessage: (message: Message) => ParentMessage;
}>, h: HtmlBuilder<ParentMessage>): Html => {
  const { model, toParentMessage } = config;
  const horizontal = model.orientation === "Horizontal";
  const size = currentSize(model);
  const primaryId = `${model.id}-primary`;
  const dimensions = [`${size}px`, `${handleSize}px`, `minmax(${model.secondaryMinSize}px, 1fr)`];
  if (model.side === "End") dimensions.reverse();
  const minimum = (model.collapsed ? 0 : model.minSize) + model.secondaryMinSize + handleSize;
  const placement = (position: number) => horizontal ? { gridColumn: String(position), gridRow: "1" }
    : { gridRow: String(position), gridColumn: "1" };
  const pane = (value: Pane, primary: boolean) => {
    const showHeader = value.showHeader !== false || (!primary && model.collapsed && model.collapsible);
    return h.section([
    ...sxAttrs(h, styles.pane), h.Id(primary ? primaryId : `${model.id}-secondary`),
    h.AriaLabel(value.label),
    // Preserve mounted children and their state while removing hidden controls from focus order.
    h.Style({ ...placement(primary === (model.side === "Start") ? 1 : 3),
      gridTemplateRows: showHeader ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)",
      ...(primary && model.collapsed ? { display: "none" } : {}) }),
  ], [
    ...(showHeader ? [h.div(sxAttrs(h, styles.header), [
      h.h2(sxAttrs(h, styles.label), [value.label]),
      ...((primary || model.collapsed) && model.collapsible ? [Button.view({
        label: `${model.collapsed ? "Show" : "Hide"} ${config.primary.label}`,
        variant: "ghost", size: "xs", onClick: toParentMessage(Message.Toggled()),
      }, h)] : []),
    ])] : []),
    h.div(sxAttrs(h, styles.body, value.scroll === "Contained" && styles.contained), value.children),
  ]);
  };
  const primary = pane(config.primary, true);
  const secondary = pane(config.secondary, false);
  const handle = h.div([
    ...sxAttrs(h, styles.handle, !horizontal && styles.verticalHandle),
    h.Style(placement(2)),
    h.Id(`${model.id}-splitter`),
    h.Role("separator"), h.Tabindex(0), h.AriaLabel(config.primary.label), h.AriaControls(primaryId),
    h.AriaOrientation(horizontal ? "vertical" : "horizontal"),
    h.AriaValuemin(model.collapsible ? 0 : model.minSize), h.AriaValuemax(maximumSize(model)), h.AriaValuenow(size),
    h.AriaValuetext(model.collapsed ? "Collapsed" : `${Math.round(size)} pixels`),
    h.DataAttribute("axis", model.orientation), h.DataAttribute("side", model.side),
    h.DataAttribute("size", String(size)), h.DataAttribute("preferred", String(model.size)),
    h.DataAttribute("min", String(model.minSize)), h.DataAttribute("max", String(maximumSize(model))),
    h.DataAttribute("collapsed", String(model.collapsed)), h.DataAttribute("collapsible", String(model.collapsible)),
    h.OnMount(Mount.mapMessage(ObserveSplitter(), toParentMessage)),
  ], []);
  return h.div([...sxAttrs(h, styles.root), h.DataAttribute("workspace", model.id)], [
    h.div([...sxAttrs(h, styles.track), h.Style(horizontal
      ? { gridTemplateColumns: dimensions.join(" "), gridTemplateRows: "minmax(0, 1fr)", minWidth: `${minimum}px` }
      : { gridTemplateRows: dimensions.join(" "), gridTemplateColumns: "minmax(0, 1fr)", minHeight: `${minimum}px` })],
    model.side === "Start" ? [primary, handle, secondary] : [secondary, handle, primary]),
  ]);
};
