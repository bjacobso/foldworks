import { Effect, Queue, Stream } from "effect";
import { Mount } from "foldkit";
import { applyEdits, normalizeText, validSelection, type Selection, type TextEdit } from "../document";
import { Message } from "./message";
import { difference, editingPlan, pairPlan, type EditPlan } from "./operations";
import type { Model } from "./model";
import type { NativeInput, Request } from "./update";
import { lineAt } from "./tokenize";

const selectionOf = (input: HTMLTextAreaElement): Selection => input.selectionDirection === "backward"
  ? { anchor: input.selectionEnd, head: input.selectionStart } : { anchor: input.selectionStart, head: input.selectionEnd };
const setSelection = (input: HTMLTextAreaElement, selection: Selection) => input.setSelectionRange(
  Math.min(selection.anchor, selection.head), Math.max(selection.anchor, selection.head), selection.anchor > selection.head ? "backward" : "forward",
);

type BrowserMessage = Extract<Message, { _tag: "Mounted" | "Edited" | "Selected" | "Scrolled" | "Composition" | "Run" | "OpenSearch" | "OpenCompletion" | "MoveCompletion" | "FailedMount" }>;

/** Browser input/selection plumbing only. Foldkit renders every highlighted line and owns history. */
export const ObserveInput = Mount.defineStream("ObserveNativeEditor", {
  messages: [Message.Mounted, Message.Edited, Message.Selected, Message.Scrolled, Message.Composition, Message.Run, Message.OpenSearch, Message.OpenCompletion, Message.MoveCompletion, Message.FailedMount],
  execute: ({ element }) => Stream.callback<BrowserMessage>((queue) => Effect.gen(function* () {
    yield* Effect.acquireRelease(Effect.sync(() => {
      const input = element as NativeInput;
      const surface = input.closest<HTMLElement>(".native-editor__surface")!;
      const mirror = surface.querySelector<HTMLElement>(".native-editor__mirror")!;
      const gutter = surface.querySelector<HTMLElement>(".native-editor__gutter-lines")!;
      let model = input.foldkitNative;
      let text = model.document.text;
      let revision = model.document.revision;
      let session = model.document.session;
      let lease = crypto.randomUUID();
      let composing = false;
      let compositionId = 0;
      let requestedCompletion = false;
      let lastSelection = model.selection;
      let pending = new Map<number, string>();
      let frame = 0;
      let disposed = false;
      let capturedBefore = model.selection;
      const emit = (message: BrowserMessage) => { if (!disposed) Queue.offerUnsafe(queue, message); };
      const identity = () => ({ lease, session });
      const layout = () => {
        if (disposed) return;
        mirror.style.width = `${input.clientWidth}px`;
        mirror.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`;
        gutter.style.transform = `translateY(${-input.scrollTop}px)`;
        if (model.options.lineWrapping) {
          const visible = mirror.querySelectorAll<HTMLElement>("[data-native-line]");
          const numbers = gutter.querySelectorAll<HTMLElement>("[data-native-number]");
          visible.forEach((line, index) => { if (numbers[index]) numbers[index]!.style.height = `${line.getBoundingClientRect().height}px`; });
        } else gutter.querySelectorAll<HTMLElement>("[data-native-number]").forEach((line) => { line.style.height = ""; });
      };
      const scheduleLayout = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          layout();
          if (!disposed) emit(Message.Scrolled({ ...identity(), top: input.scrollTop, left: input.scrollLeft, height: input.clientHeight }));
        });
      };
      const select = () => {
        if (disposed || composing || input.value !== text) return;
        const selection = selectionOf(input);
        if (selection.anchor === lastSelection.anchor && selection.head === lastSelection.head) return;
        lastSelection = selection; capturedBefore = selection;
        emit(Message.Selected({ ...identity(), revision, selection }));
      };
      const commit = (edits: readonly TextEdit[], before: Selection, selection: Selection, kind: string, groupId = 0) => {
        const next = applyEdits(text, edits);
        if (!validSelection(next, selection)) throw new Error("Invalid selection.");
        const baseRevision = revision;
        // A canceled composition can leave a history group with no net text change.
        // Traveling through it must still acknowledge and advance the history stack.
        if (next !== text || (groupId > 0 && (kind === "undo" || kind === "redo"))) {
          text = next; revision++;
          pending.set(revision, text);
          emit(Message.Edited({ ...identity(), baseRevision, edits, before, selection, kind, time: Date.now(), groupId }));
        } else emit(Message.Selected({ ...identity(), revision, selection }));
        lastSelection = selection;
      };
      const apply = (plan: EditPlan, kind: string, groupId = 0, focus = true) => {
        const before = selectionOf(input);
        input.value = applyEdits(text, plan.edits);
        setSelection(input, plan.selection);
        if (focus) input.focus({ preventScroll: true });
        commit(plan.edits, before, plan.selection, kind, groupId);
        scheduleLayout();
      };
      const reconcile = (next: Model) => {
        const changed = model.document !== next.document;
        const reset = session !== next.document.session;
        const acknowledged = pending.get(next.document.revision) === next.document.text;
        model = next;
        if (next.completion.open) requestedCompletion = false;
        if (reset || (changed && !acknowledged && (next.document.revision !== revision || next.document.text !== text))) {
          if (composing && !reset) return;
          text = next.document.text; revision = next.document.revision; session = next.document.session;
          pending.clear(); input.value = text; setSelection(input, next.selection); lastSelection = next.selection;
          if (reset) {
            lease = crypto.randomUUID(); composing = false; input.scrollTop = input.scrollLeft = 0;
            emit(Message.Mounted(identity()));
          }
        } else for (const key of pending.keys()) if (key <= next.document.revision) pending.delete(key);
        // The highlighted DOM is patched after this property; measure at the next frame.
        layout();
        if (next.document !== previousRenderedDocument || next.options.lineWrapping !== previousWrapping) {
          previousRenderedDocument = next.document; previousWrapping = next.options.lineWrapping; scheduleLayout();
        }
      };
      let previousRenderedDocument = model.document;
      let previousWrapping = model.options.lineWrapping;
      input.value = text; setSelection(input, model.selection);
      Object.defineProperty(input, "foldkitNative", { configurable: true, get: () => model, set: reconcile });
      input.nativeRequest = (request: Request) => {
        if (disposed || request.lease !== lease || request.session !== session || request.revision !== revision) return "The document changed before the command ran. Try again.";
        if (composing) return "Finish composing text before running this command.";
        if (model.options.readOnly && request.edits.length) return "The editor is read only.";
        try {
          apply(request, request.kind, request.groupId, request.focus);
          if (request.reveal) {
            const row = model.options.lineWrapping
              ? mirror.querySelectorAll<HTMLElement>("[data-native-line]")[lineAt(model.starts, request.selection.head)]?.offsetTop ?? 0
              : lineAt(model.starts, request.selection.head) * 22 + 12;
            if (row < input.scrollTop || row + 22 > input.scrollTop + input.clientHeight) input.scrollTop = Math.max(0, row - input.clientHeight / 2);
            layout();
          }
          return "";
        } catch (error) { return String(error); }
      };
      const onInput = (event: Event) => {
        const inputEvent = event as InputEvent;
        const after = normalizeText(input.value);
        const edits = difference(text, after);
        const selection = selectionOf(input);
        if (edits.length) commit(edits, capturedBefore, selection, composing ? `composition:${lease}:${compositionId}` : inputEvent.inputType || "input");
        capturedBefore = selection;
        scheduleLayout();
      };
      const beforeInput = (event: Event) => {
        const inputEvent = event as InputEvent;
        capturedBefore = selectionOf(input);
        if (composing || inputEvent.isComposing || !inputEvent.cancelable || model.options.readOnly) return;
        if (inputEvent.inputType === "historyUndo" || inputEvent.inputType === "historyRedo") {
          event.preventDefault(); emit(Message.Run({ action: inputEvent.inputType === "historyUndo" ? "undo" : "redo" })); return;
        }
        if (inputEvent.inputType === "insertText" && inputEvent.data?.length === 1) {
          // Pair only in lexical code. Do not interfere with typing inside strings/comments.
          const row = lineAt(model.starts, capturedBefore.head);
          const column = capturedBefore.head - model.starts[row]!;
          const token = model.lines[row]?.tokens.find((token) => token.from < column && token.to >= column);
          if (model.document.revision === revision && (token?.kind === "string" || token?.kind === "comment")) return;
          const plan = pairPlan(text, capturedBefore, inputEvent.data);
          if (plan) { event.preventDefault(); apply(plan, "pair"); }
        }
      };
      const keydown = (event: KeyboardEvent) => {
        if (event.isComposing || composing || event.keyCode === 229) return;
        const mod = event.ctrlKey || event.metaKey;
        if ((model.completion.open || requestedCompletion) && ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) {
          event.preventDefault();
          if (event.key === "Escape") { requestedCompletion = false; emit(Message.OpenCompletion({ open: false })); }
          else if (event.key === "Enter") { requestedCompletion = false; emit(Message.Run({ action: "complete" })); }
          else emit(Message.MoveCompletion({ delta: event.key === "ArrowDown" ? 1 : -1 }));
          return;
        }
        if (mod && event.key.toLowerCase() === "f") { event.preventDefault(); emit(Message.OpenSearch({ open: true })); return; }
        if (event.ctrlKey && event.code === "Space") { event.preventDefault(); requestedCompletion = true; emit(Message.OpenCompletion({ open: true })); return; }
        if (event.key === "Escape") { emit(Message.OpenCompletion({ open: false })); return; }
        if (mod && ["z", "y"].includes(event.key.toLowerCase())) {
          event.preventDefault(); emit(Message.Run({ action: event.key.toLowerCase() === "y" || event.shiftKey ? "redo" : "undo" })); return;
        }
        if (model.options.readOnly) return;
        const action = event.key === "Enter" && !mod ? "newline"
          : mod && event.key === "]" ? "indent" : mod && event.key === "[" ? "outdent"
          : mod && event.key === "/" ? "comment"
          : mod && event.shiftKey && event.key.toLowerCase() === "k" ? "deleteLine"
          : event.altKey && event.shiftKey && event.key === "ArrowDown" ? "duplicate" : undefined;
        if (action) { event.preventDefault(); apply(editingPlan(text, selectionOf(input), action, model.options.tabSize, ["yaml", "yml"].includes(model.document.languageId) ? "#" : "//"), action); }
        // Tab intentionally stays browser navigation; indentation has dedicated shortcuts.
      };
      const compositionStart = () => { composing = true; compositionId++; capturedBefore = selectionOf(input); emit(Message.Composition({ ...identity(), active: true })); };
      const compositionEnd = () => {
        // The final input event can precede or follow compositionend across browsers.
        onInput(new InputEvent("input", { inputType: "insertCompositionText" }));
        composing = false; emit(Message.Composition({ ...identity(), active: false }));
      };
      const scroll = () => { layout(); scheduleLayout(); };
      const blur = (event: Event) => {
        requestedCompletion = false;
        if ((event as FocusEvent).relatedTarget instanceof Element && ((event as FocusEvent).relatedTarget as Element).closest(".native-editor__completion")) return;
        emit(Message.OpenCompletion({ open: false }));
      };
      const events: readonly [string, EventListener][] = [
        ["beforeinput", beforeInput], ["input", onInput], ["keydown", keydown as EventListener],
        ["select", select], ["selectionchange", select], ["keyup", select], ["pointerup", select],
        ["scroll", scroll], ["compositionstart", compositionStart], ["compositionend", compositionEnd], ["blur", blur],
      ];
      for (const [event, handler] of events) input.addEventListener(event, handler);
      const observer = new ResizeObserver(scheduleLayout); observer.observe(input);
      scheduleLayout(); emit(Message.Mounted(identity()));
      return () => {
        disposed = true; observer.disconnect(); cancelAnimationFrame(frame);
        for (const [event, handler] of events) input.removeEventListener(event, handler);
        delete input.nativeRequest;
        Object.defineProperty(input, "foldkitNative", { configurable: true, writable: true, value: model });
      };
    }), (dispose) => Effect.sync(dispose));
    return yield* Effect.never;
  })),
});
