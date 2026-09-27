import { Effect } from "effect";
import { Mount } from "foldkit";

import { Message } from "./message";

const SHOW_DELAY_MS = 250;
const HIDE_DELAY_MS = 120;
const GAP = 6;
const EDGE = 8;

const detailsSelector = '[data-has-details="true"]';

/** Describes the cell details element referenced by `aria-describedby`. */
export const detailsId = (cellId: string): string => `${cellId}:details`;

const place = (popover: HTMLElement, cell: HTMLElement): void => {
  const anchor = cell.getBoundingClientRect();
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  const below = anchor.bottom + GAP;
  const top =
    below + height > window.innerHeight - EDGE ? Math.max(EDGE, anchor.top - GAP - height) : below;
  const left = Math.min(
    Math.max(EDGE, anchor.left),
    Math.max(EDGE, window.innerWidth - width - EDGE),
  );
  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
};

/** Wires the grid's single hover-details popover. Cells carry their text in a
 * hidden description element; this listener copies it into one top-layer
 * popover on hover or focus, so hundreds of cells need no model state and
 * details are never clipped by the scroller. */
export const HoverDetails = Mount.define("DataGridHoverDetails", {
  messages: [Message.MountedHoverDetails],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const popover = element as HTMLElement;
        const root = popover.closest(".fk-data-grid") ?? popover.parentElement;
        if (root === null || typeof popover.showPopover !== "function") {
          return { dispose: () => {} };
        }
        let current: HTMLElement | undefined;
        let showTimer = 0;
        let hideTimer = 0;
        const isOpen = () => popover.matches(":popover-open");
        const clearTimers = () => {
          window.clearTimeout(showTimer);
          window.clearTimeout(hideTimer);
        };
        const show = (cell: HTMLElement) => {
          clearTimers();
          const text = cell.querySelector(":scope > .fk-data-grid__details")?.textContent ?? "";
          if (text === "") return;
          current = cell;
          popover.textContent = text;
          if (!isOpen()) popover.showPopover();
          place(popover, cell);
        };
        const hide = () => {
          clearTimers();
          current = undefined;
          if (isOpen()) popover.hidePopover();
        };
        const cellFrom = (target: EventTarget | null): HTMLElement | undefined => {
          if (!(target instanceof Element)) return undefined;
          const cell = target.closest<HTMLElement>(detailsSelector);
          return cell !== null && root.contains(cell) ? cell : undefined;
        };
        const onPointerOver = (event: Event) => {
          const cell = cellFrom(event.target);
          if (cell === undefined) return;
          // pointerout fires first and schedules a hide; entering a details cell cancels it.
          window.clearTimeout(hideTimer);
          if (cell === current) return;
          window.clearTimeout(showTimer);
          // Sweeping across a dense matrix switches instantly once a popover is open.
          if (isOpen()) show(cell);
          else showTimer = window.setTimeout(() => show(cell), SHOW_DELAY_MS);
        };
        const onPointerOut = (event: Event) => {
          const next = (event as PointerEvent).relatedTarget;
          if (next instanceof Node && (popover.contains(next) || current?.contains(next))) return;
          // Replace, never orphan, a pending hide: a stale timer would cancel a later show.
          clearTimers();
          hideTimer = window.setTimeout(hide, HIDE_DELAY_MS);
        };
        const onFocusIn = (event: Event) => {
          const cell = cellFrom(event.target);
          if (cell === undefined) hide();
          else show(cell);
        };
        const onFocusOut = (event: Event) => {
          const next = (event as FocusEvent).relatedTarget;
          if (!(next instanceof Node) || cellFrom(next) === undefined) hide();
        };
        const onKeyDown = (event: Event) => {
          if ((event as KeyboardEvent).key === "Escape" && isOpen()) hide();
        };
        root.addEventListener("pointerover", onPointerOver);
        root.addEventListener("pointerout", onPointerOut);
        root.addEventListener("focusin", onFocusIn);
        root.addEventListener("focusout", onFocusOut);
        root.addEventListener("keydown", onKeyDown);
        root.addEventListener("scroll", hide, { capture: true, passive: true });
        popover.addEventListener("pointerover", () => window.clearTimeout(hideTimer));
        popover.addEventListener("pointerout", onPointerOut);
        return {
          dispose: () => {
            clearTimers();
            root.removeEventListener("pointerover", onPointerOver);
            root.removeEventListener("pointerout", onPointerOut);
            root.removeEventListener("focusin", onFocusIn);
            root.removeEventListener("focusout", onFocusOut);
            root.removeEventListener("keydown", onKeyDown);
            root.removeEventListener("scroll", hide, { capture: true });
            if (isOpen()) popover.hidePopover();
          },
        };
      }),
      ({ dispose }) => Effect.sync(dispose),
    ).pipe(Effect.as(Message.MountedHoverDetails())),
});
