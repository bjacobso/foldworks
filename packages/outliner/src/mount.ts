import { Effect, Queue, Stream } from "effect";
import { Mount } from "foldkit";
import { Completion, isOver, offsetAtPoint } from "@foldworks/text-intelligence";

import { caretLines } from "./caret";
import { keepsFocus, resolveKey, type Action, type KeyInput, type Platform } from "./keymap";
import { Message } from "./message";
import { domIds, type Model } from "./model";
import { dropTarget, find, roots, visibleRows, type DropTarget } from "./outline";
import { selectedIds, selectedRoots } from "./selectors";
import { serializeOutline } from "./text";

/** Horizontal distance for one level of nesting, shared with the stylesheet. */
export const INDENT = 24;
const DRAG_THRESHOLD = 4;
const SCROLL_EDGE = 48;
const SETTLE_TIMEOUT = 200;
/** How long the pointer rests on text before asking for hover information. */
const HOVER_DELAY = 350;
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"]);
/** Messages that change the document other than by typing. */
const EDITS: ReadonlySet<string> = new Set([
  "Pressed",
  "PastedText",
  "AcceptedCompletion",
  "Dropped",
]);
/** Dispatched on the element the outline just focused, so held keys can follow. */
export const FOCUSED_EVENT = "fw-outliner-focused";
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The view hands the latest model to the surface through this element property. */
export const MODEL_PROPERTY = "foldworksOutliner";
type Host = HTMLElement & { [MODEL_PROPERTY]?: Model };

type SurfaceMessage = Extract<
  Message,
  {
    _tag:
      | "Pressed"
      | "EditedText"
      | "FocusedText"
      | "PastedText"
      | "ToggledCollapsed"
      | "ClickedBullet"
      | "SelectedRange"
      | "StartedDrag"
      | "MovedDrag"
      | "Dropped"
      | "CancelledDrag"
      | "Hovered"
      | "DismissedHover"
      | "RequestedCompletion"
      | "MovedCompletion"
      | "AcceptedCompletion"
      | "DismissedCompletion";
  }
>;

const detectPlatform = (): Platform =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? "mac"
    : "other";

const rowIdOf = (target: EventTarget | null): string | undefined =>
  target instanceof Element
    ? (target.closest<HTMLElement>("[data-outline-row]")?.dataset.outlineRow ?? undefined)
    : undefined;

const isText = (target: EventTarget | null): target is HTMLTextAreaElement =>
  target instanceof HTMLTextAreaElement && target.dataset.outlineText !== undefined;

const scrollParent = (element: HTMLElement): HTMLElement | undefined => {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return undefined;
};

const sameTarget = (a: DropTarget | null, b: DropTarget | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

type Drag = {
  pointerId: number;
  rowId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  ids: ReadonlyArray<string>;
  depth: number;
  target: DropTarget | null;
  ghost: HTMLElement | null;
  frame: number;
};

/**
 * Browser plumbing for the outline: key resolution with caret geometry, text
 * input, clipboard, range selection, and pointer drag and drop. Every change
 * to the document goes through `update`.
 */
export const Surface = Mount.defineStream("OutlinerSurface", {
  messages: [
    Message.Pressed,
    Message.EditedText,
    Message.FocusedText,
    Message.PastedText,
    Message.ToggledCollapsed,
    Message.ClickedBullet,
    Message.SelectedRange,
    Message.StartedDrag,
    Message.MovedDrag,
    Message.Dropped,
    Message.CancelledDrag,
    Message.Hovered,
    Message.DismissedHover,
    Message.RequestedCompletion,
    Message.MovedCompletion,
    Message.AcceptedCompletion,
    Message.DismissedCompletion,
  ],
  execute: ({ element }) =>
    Stream.callback<SurfaceMessage>((queue) =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            const host = element as Host;
            const doc = host.ownerDocument;
            const platform = detectPlatform();
            let disposed = false;
            let drag: Drag | undefined;
            let press: { rowId: string; headId: string } | undefined;
            const emit = (message: SurfaceMessage) => {
              if (disposed) return;
              // After an edit that is not typing, such as undo, the model's text is
              // the truth, even where it matches something typed earlier.
              if (EDITS.has(message._tag)) unacknowledged.clear();
              Queue.offerUnsafe(queue, message);
            };
            let latest: Model | undefined = host[MODEL_PROPERTY];
            const model = (): Model | undefined => latest;

            // Typing outruns rendering. A render can carry an item's text from a
            // few keystrokes ago, and writing it would erase what was typed since.
            // Text sent to the model is remembered until the model has it; when a
            // render lands behind it, the newer text and caret are put back.
            type Typed = Readonly<{ value: string; start: number; end: number }>;
            const unacknowledged = new Map<string, Typed[]>();
            let composing = false;
            const acknowledge = (next: Model) => {
              for (const [id, typed] of unacknowledged) {
                const text = find(next.items, id)?.text;
                const at =
                  text === undefined ? -1 : typed.findIndex((entry) => entry.value === text);
                const ahead = at < 0 ? [] : typed.slice(at + 1);
                if (ahead.length === 0) {
                  // Caught up, or changed some other way, such as undo: the model wins.
                  unacknowledged.delete(id);
                  continue;
                }
                unacknowledged.set(id, ahead);
                const newest = ahead[ahead.length - 1]!;
                queueMicrotask(() => {
                  const element = doc.getElementById(domIds(next.id).text(id));
                  if (!(element instanceof HTMLTextAreaElement) || composing) return;
                  if (element.value === newest.value) return;
                  element.value = newest.value;
                  if (doc.activeElement === element) {
                    element.setSelectionRange(newest.start, newest.end);
                  }
                });
              }
            };
            Object.defineProperty(host, MODEL_PROPERTY, {
              configurable: true,
              get: () => latest,
              set: (next: Model) => {
                latest = next;
                acknowledge(next);
              },
            });

            // Actions that move focus re-render before the new caret exists. Keys
            // typed in that gap are held and replayed where focus lands.
            let held: KeyInput[] = [];
            let settling = false;
            let settleTimer: ReturnType<typeof setTimeout> | undefined;

            const awaitFocus = () => {
              settling = true;
              clearTimeout(settleTimer);
              settleTimer = setTimeout(release, SETTLE_TIMEOUT);
            };

            const pressAction = (action: Action, id: string, start = 0, end = 0, goalX = 0) => {
              emit(Message.Pressed({ action, id, start, end, goalX }));
              if (!keepsFocus(action)) awaitFocus();
            };

            /**
             * While suggestions show for this text, they claim the keys that pick
             * one, ahead of the key map, so Return never splits under them.
             */
            const completionKey = (
              event: KeyInput,
              target: HTMLTextAreaElement,
              id: string,
            ): boolean => {
              const list = model()?.completion;
              if (list === null || list === undefined || list.id !== id) return false;
              // Only suggestions on screen take keys.
              if (doc.getElementById(domIds(model()!.id).completion) === null) return false;
              const shown = Completion.visible(list, target.value, target.selectionEnd);
              const plain = !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
              if (shown.length === 0 || !plain) return false;
              switch (event.key) {
                case "ArrowDown":
                case "ArrowUp":
                  emit(Message.MovedCompletion({ delta: event.key === "ArrowDown" ? 1 : -1 }));
                  return true;
                case "Enter":
                case "Tab":
                  emit(
                    Message.AcceptedCompletion({ index: Math.min(list.index, shown.length - 1) }),
                  );
                  // Accepting moves the caret after a render; hold what is typed meanwhile.
                  awaitFocus();
                  return true;
                case "Escape":
                  emit(Message.DismissedCompletion());
                  return true;
                case "ArrowLeft":
                case "ArrowRight":
                case "Home":
                case "End":
                case "PageUp":
                case "PageDown":
                  // Moving the caret away from the word puts the suggestions away.
                  emit(Message.DismissedCompletion());
                  return false;
                default:
                  return false;
              }
            };

            /** Resolves and dispatches a key against an element; `true` when the outline used it. */
            const handleKey = (
              event: KeyInput,
              target: EventTarget | null,
              replayed = false,
            ): boolean => {
              if (isText(target)) {
                const id = rowIdOf(target);
                if (id === undefined) return false;
                // Held keys were typed before any suggestions could be seen.
                if (!replayed && completionKey(event, target, id)) return true;
                const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
                const lines = vertical
                  ? caretLines(target)
                  : { onFirstLine: false, onLastLine: false, x: 0 };
                const action = resolveKey(
                  event,
                  {
                    mode: "Text",
                    caret: {
                      start: target.selectionStart,
                      end: target.selectionEnd,
                      length: target.value.length,
                      onFirstLine: lines.onFirstLine,
                      onLastLine: lines.onLastLine,
                    },
                  },
                  platform,
                );
                if (action === undefined) return false;
                if (action === "Complete") {
                  emit(
                    Message.RequestedCompletion({
                      id,
                      start: target.selectionStart,
                      end: target.selectionEnd,
                    }),
                  );
                  return true;
                }
                pressAction(action, id, target.selectionStart, target.selectionEnd, lines.x);
                return true;
              }
              const id = target instanceof HTMLElement ? target.dataset.outlineRow : undefined;
              if (id === undefined) return false;
              const action = resolveKey(event, { mode: "Rows" }, platform);
              if (action === undefined) return false;
              pressAction(action, id);
              return true;
            };

            const replay = (event: KeyInput) => {
              const target = doc.activeElement;
              if (target === null || !host.contains(target) || handleKey(event, target, true))
                return;
              if (!isText(target) || event.ctrlKey || event.metaKey) return;
              const text = event.key === "Enter" ? "\n" : event.key.length === 1 ? event.key : "";
              const command =
                text !== ""
                  ? "insertText"
                  : event.key === "Backspace"
                    ? "delete"
                    : event.key === "Delete"
                      ? "forwardDelete"
                      : undefined;
              // execCommand keeps the browser's own input events and caret handling.
              if (command !== undefined && !doc.execCommand(command, false, text)) {
                if (text === "") return;
                target.setRangeText(text, target.selectionStart, target.selectionEnd, "end");
                target.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
              }
            };

            function release() {
              clearTimeout(settleTimer);
              settling = false;
              while (held.length > 0 && !settling) replay(held.shift()!);
            }

            // Hover: the pointer rests on a character, then the host is asked about it.
            let hoverTimer: ReturnType<typeof setTimeout> | undefined;
            let hoverPoint: { x: number; y: number } | undefined;
            const hoverPopup = () => doc.getElementById(domIds(model()?.id ?? "").hover);
            const hoveredRects = () =>
              [...host.querySelectorAll(".fw-text-hovered")].flatMap((element) => [
                ...element.getClientRects(),
              ]);
            const emitHover = (target: { id: string; offset: number } | null) => {
              const current = model()?.hover ?? null;
              const unchanged =
                target === null
                  ? // The pointer only dismisses what it asked for, not information shown for the caret.
                    current === null || current.source === "Keyboard"
                  : current?.source === "Pointer" &&
                    current.id === target.id &&
                    current.offset === target.offset;
              if (!unchanged) emit(Message.Hovered({ target }));
            };
            const settleHover = () => {
              const point = hoverPoint;
              const under = point === undefined ? null : doc.elementFromPoint(point.x, point.y);
              const id = isText(under) ? rowIdOf(under) : undefined;
              const mirror = under?.parentElement?.querySelector("[data-outline-mirror]");
              const offset =
                point === undefined || mirror === null || mirror === undefined
                  ? undefined
                  : offsetAtPoint(mirror, point.x, point.y);
              emitHover(id === undefined || offset === undefined ? null : { id, offset });
            };
            const trackHover = (event: PointerEvent) => {
              if (event.pointerType === "touch") return;
              const target = event.target instanceof Element ? event.target : null;
              if (
                target?.closest("[data-text-popup]") ||
                isOver(hoveredRects(), event.clientX, event.clientY)
              ) {
                clearTimeout(hoverTimer);
                return;
              }
              hoverPoint = { x: event.clientX, y: event.clientY };
              clearTimeout(hoverTimer);
              hoverTimer = setTimeout(settleHover, HOVER_DELAY);
            };
            const leave = () => {
              hoverPoint = undefined;
              clearTimeout(hoverTimer);
              hoverTimer = setTimeout(settleHover, HOVER_DELAY);
            };

            const keydown = (event: KeyboardEvent) => {
              if (drag?.active && event.key === "Escape") {
                event.preventDefault();
                endDrag(false);
                return;
              }
              if (hoverPopup() !== null && !MODIFIER_KEYS.has(event.key)) {
                clearTimeout(hoverTimer);
                const plain = !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
                if (event.key === "Escape" && plain) {
                  event.preventDefault();
                  emit(Message.DismissedHover());
                  return;
                }
                // Information shown for the caret goes away once the caret moves on.
                if (model()?.hover?.source === "Keyboard") emit(Message.DismissedHover());
              }
              if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
              if (settling) {
                if (MODIFIER_KEYS.has(event.key)) return;
                event.preventDefault();
                held.push({
                  key: event.key,
                  code: event.code,
                  shiftKey: event.shiftKey,
                  altKey: event.altKey,
                  ctrlKey: event.ctrlKey,
                  metaKey: event.metaKey,
                });
                return;
              }
              const target = event.target;
              if (handleKey(event, target)) {
                event.preventDefault();
                return;
              }
              if (target === doc.getElementById(domIds(model()?.id ?? "").tree)) {
                // Tab and Shift+Tab indent inside the outline; from the bare tree, Tab leaves it.
                if (event.key === "Tab" && !event.shiftKey) {
                  const next = [...doc.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
                    (candidate) =>
                      !host.contains(candidate) &&
                      (host.compareDocumentPosition(candidate) &
                        Node.DOCUMENT_POSITION_FOLLOWING) !==
                        0,
                  );
                  if (next !== undefined) {
                    event.preventDefault();
                    next.focus();
                  }
                  return;
                }
                const first =
                  host.querySelector<HTMLElement>("[data-outline-row]")?.dataset.outlineRow;
                if (first !== undefined && (event.key === "ArrowDown" || event.key === "Enter")) {
                  event.preventDefault();
                  emit(Message.SelectedRange({ anchorId: first, headId: first }));
                }
              }
            };

            const input = (event: Event) => {
              const target = event.target;
              if (!isText(target)) return;
              const id = rowIdOf(target);
              if (id === undefined) return;
              const typed = unacknowledged.get(id) ?? [];
              typed.push({
                value: target.value,
                start: target.selectionStart,
                end: target.selectionEnd,
              });
              unacknowledged.set(id, typed.slice(-64));
              emit(
                Message.EditedText({
                  id,
                  text: target.value,
                  start: target.selectionStart,
                  end: target.selectionEnd,
                  time: event.timeStamp,
                }),
              );
            };

            const beforeinput = (event: InputEvent) => {
              // The outline owns undo; the textarea's own stack would desynchronize it.
              if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
                const target = event.target;
                const id = rowIdOf(target);
                if (!isText(target) || id === undefined) return;
                event.preventDefault();
                pressAction(
                  event.inputType === "historyUndo" ? "Undo" : "Redo",
                  id,
                  target.selectionStart,
                  target.selectionEnd,
                );
              }
            };

            const focusin = (event: FocusEvent) => {
              const target = event.target;
              if (!isText(target)) return;
              const id = rowIdOf(target);
              if (id === undefined) return;
              emit(
                Message.FocusedText({ id, start: target.selectionStart, end: target.selectionEnd }),
              );
            };

            const selectionText = (): string | undefined => {
              const current = model();
              if (current === undefined || current.mode !== "Rows") return undefined;
              const nodes = selectedRoots(current)
                .map((id) => find(current.items, id))
                .filter((node) => node !== undefined);
              return nodes.length === 0 ? undefined : serializeOutline(nodes);
            };

            const copy = (event: ClipboardEvent) => {
              if (isText(event.target)) return;
              const text = selectionText();
              if (text === undefined || event.clipboardData === null) return;
              event.preventDefault();
              event.clipboardData.setData("text/plain", text);
              const id = model()?.selection?.headId;
              if (event.type === "cut" && id !== undefined) pressAction("Delete", id);
            };

            const compositionstart = () => {
              composing = true;
            };

            const compositionend = () => {
              composing = false;
            };

            const paste = (event: ClipboardEvent) => {
              const text = event.clipboardData?.getData("text/plain") ?? "";
              if (text === "") return;
              const target = event.target;
              if (isText(target)) {
                // Single lines paste natively; several lines become several items.
                if (!/\r|\n/.test(text.replace(/[\r\n]+$/, ""))) return;
                const id = rowIdOf(target);
                if (id === undefined) return;
                event.preventDefault();
                awaitFocus();
                emit(
                  Message.PastedText({
                    id,
                    mode: "Text",
                    start: target.selectionStart,
                    end: target.selectionEnd,
                    text,
                  }),
                );
                return;
              }
              const id = model()?.selection?.headId;
              if (id === undefined) return;
              event.preventDefault();
              emit(Message.PastedText({ id, mode: "Rows", start: 0, end: 0, text }));
            };

            const rowAt = (x: number, y: number): string | undefined =>
              rowIdOf(doc.elementFromPoint(x, y));

            const computeTarget = (current: Drag): DropTarget | null => {
              const state = model();
              if (state === undefined) return null;
              const rows = visibleRows(state.items, state.scopeId);
              const dragged = new Set(current.ids);
              const parents = new Map(rows.map((row) => [row.id, row.parentId]));
              const hidden = (id: string): boolean => {
                for (let at: string | null = id; at !== null; at = parents.get(at) ?? null) {
                  if (dragged.has(at)) return true;
                }
                return false;
              };
              let gap = 0;
              for (const row of rows) {
                if (hidden(row.id)) continue;
                const rect = doc
                  .getElementById(domIds(state.id).row(row.id))
                  ?.getBoundingClientRect();
                if (rect === undefined || rect.top + rect.height / 2 >= current.y) break;
                gap += 1;
              }
              const depth = current.depth + (current.x - current.startX) / INDENT;
              return dropTarget(rows, current.ids, gap, depth, state.scopeId);
            };

            const placeGhost = (current: Drag) => {
              if (current.ghost !== null) {
                current.ghost.style.transform = `translate(${current.x + 14}px, ${current.y + 10}px)`;
              }
            };

            const retarget = (current: Drag) => {
              const target = computeTarget(current);
              if (!sameTarget(target, current.target)) {
                current.target = target;
                emit(Message.MovedDrag({ target }));
              }
            };

            const autoscroll = () => {
              const current = drag;
              if (current === undefined || !current.active || disposed) return;
              const scroller = scrollParent(host);
              const top = scroller?.getBoundingClientRect().top ?? 0;
              const bottom = scroller?.getBoundingClientRect().bottom ?? window.innerHeight;
              const delta =
                current.y < top + SCROLL_EDGE
                  ? -Math.ceil((top + SCROLL_EDGE - current.y) / 4)
                  : current.y > bottom - SCROLL_EDGE
                    ? Math.ceil((current.y - (bottom - SCROLL_EDGE)) / 4)
                    : 0;
              if (delta !== 0) {
                if (scroller === undefined) window.scrollBy(0, delta);
                else scroller.scrollTop += delta;
                retarget(current);
              }
              current.frame = requestAnimationFrame(autoscroll);
            };

            const startDrag = (current: Drag) => {
              const state = model();
              if (state === undefined) return;
              const selected = state.mode === "Rows" ? selectedIds(state) : [];
              current.ids = selected.includes(current.rowId)
                ? roots(state.items, selected)
                : [current.rowId];
              current.depth =
                visibleRows(state.items, state.scopeId).find((row) => row.id === current.ids[0])
                  ?.depth ?? 0;
              current.active = true;
              const ghost = doc.createElement("div");
              ghost.className = "fw-outliner-ghost";
              const first = find(state.items, current.ids[0]!)?.text.split("\n")[0] || "Untitled";
              ghost.textContent =
                current.ids.length > 1 ? `${first}  +${current.ids.length - 1}` : first;
              doc.body.append(ghost);
              current.ghost = ghost;
              doc.documentElement.classList.add("fw-outliner-dragging");
              placeGhost(current);
              emit(Message.StartedDrag({ ids: current.ids }));
              retarget(current);
              current.frame = requestAnimationFrame(autoscroll);
            };

            const endDrag = (dropped: boolean) => {
              const current = drag;
              drag = undefined;
              if (current === undefined) return;
              cancelAnimationFrame(current.frame);
              current.ghost?.remove();
              doc.documentElement.classList.remove("fw-outliner-dragging");
              if (current.active) emit(dropped ? Message.Dropped() : Message.CancelledDrag());
            };

            const pointerdown = (event: PointerEvent) => {
              const target = event.target instanceof Element ? event.target : null;
              if (target === null || event.button !== 0) return;
              // A press anywhere but the suggestions themselves puts them away.
              if (model()?.completion && !target.closest("[data-text-popup]")) {
                emit(Message.DismissedCompletion());
              }
              if (target.closest("[data-outline-control]")) {
                // Controls act without taking focus away from the text being edited.
                event.preventDefault();
                return;
              }
              const handle = target.closest<HTMLElement>("[data-outline-handle]");
              const id = rowIdOf(target);
              if (handle !== null && id !== undefined) {
                event.preventDefault();
                handle.setPointerCapture(event.pointerId);
                drag = {
                  pointerId: event.pointerId,
                  rowId: id,
                  startX: event.clientX,
                  startY: event.clientY,
                  x: event.clientX,
                  y: event.clientY,
                  active: false,
                  ids: [id],
                  depth: 0,
                  target: null,
                  ghost: null,
                  frame: 0,
                };
                return;
              }
              if (id === undefined) return;
              const state = model();
              const activeRow = rowIdOf(doc.activeElement);
              const anchorId =
                state?.mode === "Rows" && state.selection !== null
                  ? state.selection.anchorId
                  : host.contains(doc.activeElement)
                    ? activeRow
                    : undefined;
              if (event.shiftKey && anchorId !== undefined && anchorId !== id) {
                event.preventDefault();
                emit(Message.SelectedRange({ anchorId, headId: id }));
                return;
              }
              press = { rowId: id, headId: id };
            };

            const pointermove = (event: PointerEvent) => {
              const current = drag;
              if (current !== undefined && current.pointerId === event.pointerId) {
                current.x = event.clientX;
                current.y = event.clientY;
                if (!current.active) {
                  const distance = Math.hypot(
                    current.x - current.startX,
                    current.y - current.startY,
                  );
                  if (distance < DRAG_THRESHOLD) return;
                  startDrag(current);
                  return;
                }
                placeGhost(current);
                retarget(current);
                return;
              }
              if (event.buttons === 0) trackHover(event);
              if (press === undefined || (event.buttons & 1) === 0) return;
              const over = rowAt(event.clientX, event.clientY);
              if (over === undefined || over === press.headId) return;
              // Dragging across rows from inside text switches to selecting whole rows.
              press.headId = over;
              if (over !== press.rowId || model()?.mode === "Rows") {
                doc.getSelection()?.removeAllRanges();
                emit(Message.SelectedRange({ anchorId: press.rowId, headId: over }));
              }
            };

            const pointerup = (event: PointerEvent) => {
              press = undefined;
              const current = drag;
              if (current === undefined || current.pointerId !== event.pointerId) return;
              if (current.active) {
                current.x = event.clientX;
                current.y = event.clientY;
                retarget(current);
                endDrag(true);
              } else {
                drag = undefined;
                emit(Message.ClickedBullet({ id: current.rowId }));
              }
            };

            const pointercancel = () => {
              press = undefined;
              endDrag(false);
            };

            const click = (event: MouseEvent) => {
              const toggle =
                event.target instanceof Element
                  ? event.target.closest<HTMLElement>("[data-outline-toggle]")
                  : null;
              const id = toggle?.dataset.outlineToggle;
              if (id === undefined) return;
              event.preventDefault();
              emit(Message.ToggledCollapsed({ id, recursive: event.altKey }));
            };

            const documentKeydown = (event: KeyboardEvent) => {
              if (drag?.active && event.key === "Escape" && !host.contains(event.target as Node)) {
                event.preventDefault();
                endDrag(false);
              }
            };

            const listeners: ReadonlyArray<readonly [EventTarget, string, EventListener]> = [
              [host, "keydown", keydown as EventListener],
              [host, "input", input],
              [host, "compositionstart", compositionstart],
              [host, "compositionend", compositionend],
              [host, "beforeinput", beforeinput as EventListener],
              [host, "focusin", focusin as EventListener],
              [host, "copy", copy as EventListener],
              [host, "cut", copy as EventListener],
              [host, "paste", paste as EventListener],
              [host, "pointerdown", pointerdown as EventListener],
              [host, "pointermove", pointermove as EventListener],
              [host, "pointercancel", pointercancel],
              [host, "pointerleave", leave],
              [host, "click", click as EventListener],
              [host, FOCUSED_EVENT, release],
              [doc, "pointerup", pointerup as EventListener],
              [doc, "keydown", documentKeydown as EventListener],
            ];
            for (const [target, type, listener] of listeners)
              target.addEventListener(type, listener);
            return () => {
              disposed = true;
              Object.defineProperty(host, MODEL_PROPERTY, {
                configurable: true,
                writable: true,
                value: latest,
              });
              clearTimeout(settleTimer);
              clearTimeout(hoverTimer);
              endDrag(false);
              for (const [target, type, listener] of listeners) {
                target.removeEventListener(type, listener);
              }
            };
          }),
          (dispose) => Effect.sync(dispose),
        );
        return yield* Effect.never;
      }),
    ),
});
