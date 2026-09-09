import type { Html, HtmlBuilder } from "foldkit/html";
import {
  collapsed,
  find,
  leaves,
  normalizeRuns,
  orderedRange,
  plainText,
  safeUrl,
  text,
  walk,
  type Block,
  type Mark,
  type Point,
  type Registry,
  type Run,
  type Selection,
} from "./document";
import { Message, reduce, type Model } from "./model";
import { mountBlockView } from "./node-view";

const EVENT = "foldworks-editor-message";
const surfaces = new WeakMap<Element, Surface>();
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const domLength = (node: Node): number => {
  if (node.nodeType === 3) return node.textContent?.length ?? 0;
  if (
    node instanceof HTMLElement &&
    (node.contentEditable === "false" || node.dataset.placeholder)
  )
    return 0;
  if (node.nodeName === "BR") return 1;
  return Array.from(node.childNodes).reduce(
    (sum, child) => sum + domLength(child),
    0,
  );
};
const offsetIn = (root: Node, target: Node, offset: number): number => {
  if (root === target)
    return root.nodeType === 3
      ? offset
      : Array.from(root.childNodes)
          .slice(0, offset)
          .reduce((sum, child) => sum + domLength(child), 0);
  let result = 0;
  for (const child of Array.from(root.childNodes)) {
    if (child === target || child.contains(target))
      return result + offsetIn(child, target, offset);
    result += domLength(child);
  }
  return result;
};
const domPoint = (root: Node, offset: number): readonly [Node, number] => {
  if (root.nodeType === 3)
    return [root, Math.min(offset, root.textContent?.length ?? 0)];
  for (const [index, child] of Array.from(root.childNodes).entries()) {
    const length = domLength(child);
    if (child.nodeName === "BR" && offset <= length)
      return [root, index + (offset > 0 ? 1 : 0)];
    if (offset <= length && length > 0) return domPoint(child, offset);
    offset -= length;
  }
  return [root, root.childNodes.length];
};
const readRuns = (
  root: Node,
  marks: ReadonlyArray<Mark> = [],
): ReadonlyArray<Run> =>
  normalizeRuns(
    Array.from(root.childNodes).flatMap((node) => {
      if (node.nodeType === 3) return [text(node.textContent ?? "", marks)];
      if (!(node instanceof HTMLElement) || node.contentEditable === "false")
        return [];
      if (node.tagName === "BR")
        return node.dataset.placeholder ? [] : [text("\n", marks)];
      const type = (
        {
          STRONG: "bold",
          B: "bold",
          EM: "italic",
          I: "italic",
          S: "strike",
          DEL: "strike",
          CODE: "code",
          A: "link",
        } as Record<string, Mark["type"]>
      )[node.tagName];
      const value = node.getAttribute("href") ?? "";
      return readRuns(
        node,
        type && (type !== "link" || safeUrl(value))
          ? [...marks, { type, value: type === "link" ? value : "" }]
          : marks,
      );
    }),
  );
type Rendered = {
  dom: HTMLElement;
  body: HTMLElement;
  node: Block;
  top: boolean;
  custom?: ReturnType<typeof mountBlockView>;
};

class Surface {
  model: Model;
  private nodes = new Map<string, Rendered>();
  private abort = new AbortController();
  private composing = false;
  private composition: { id: string; revision: number } | undefined;
  private compositionTimer: ReturnType<typeof setTimeout> | undefined;
  private dragged: string | undefined;
  private destroyed = false;
  private selectionMenu: HTMLElement | undefined;
  private observer: MutationObserver;
  private reconciliationScheduled = false;
  private nativeDirty = false;
  private renderedEditable: boolean | undefined;
  constructor(
    private host: HTMLElement,
    model: Model,
    private registry: Registry,
  ) {
    this.model = model;
    this.render(false);
    const listen = (
      target: EventTarget,
      event: string,
      handler: (event: any) => void,
    ) => target.addEventListener(event, handler, { signal: this.abort.signal });
    listen(host, "beforeinput", (event: InputEvent) => this.beforeInput(event));
    listen(host, "input", () => {
      if (!this.composing) this.reconcile();
    });
    listen(host, "compositionstart", () => {
      const point = this.selection()?.anchor;
      if (point) {
        this.composing = true;
        this.composition = { id: point.id, revision: this.model.revision };
      }
    });
    listen(host, "compositionend", () => {
      this.composing = false;
      // Final input may follow compositionend. Reconcile exactly once after it.
      this.compositionTimer = setTimeout(() => this.reconcile(), 0);
    });
    listen(document, "selectionchange", () => {
      if (this.composing || this.composition) return;
      const selection = this.selection();
      if (selection && !equal(selection, this.model.selection))
        this.send(Message.Selected({ selection }), false);
    });
    listen(host, "keydown", (event: KeyboardEvent) => this.keydown(event));
    listen(host, "click", (event: MouseEvent) => this.click(event));
    listen(host, "paste", (event: ClipboardEvent) => {
      if (!this.model.editable) return;
      event.preventDefault();
      // Plain text is a deliberate safe fallback until rich HTML fragment fitting ships.
      this.input("text", event.clipboardData?.getData("text/plain") ?? "");
    });
    listen(host, "copy", (event: ClipboardEvent) => this.copy(event, false));
    listen(host, "cut", (event: ClipboardEvent) => this.copy(event, true));
    listen(host, "dragstart", (event: DragEvent) => {
      const handle = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-drag-block]",
      );
      if (!this.model.editable || !handle) {
        event.preventDefault();
        return;
      }
      this.dragged = handle.dataset.dragBlock;
      event.dataTransfer?.setData("text/x-foldworks-block", this.dragged ?? "");
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    listen(host, "dragover", (event: DragEvent) => {
      if (!this.dragged) return;
      event.preventDefault();
      this.clearDrop();
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-top-block]",
      );
      if (target && target.dataset.topBlock !== this.dragged)
        target.dataset.drop =
          event.clientY <
          target.getBoundingClientRect().top + target.offsetHeight / 2
            ? "before"
            : "after";
      const rect = host.getBoundingClientRect();
      if (event.clientY < rect.top + 50) host.scrollBy(0, -15);
      if (event.clientY > rect.bottom - 50) host.scrollBy(0, 15);
    });
    listen(host, "drop", (event: DragEvent) => {
      event.preventDefault();
      const target = host.querySelector<HTMLElement>("[data-drop]");
      if (this.dragged && target?.dataset.topBlock)
        this.send(
          Message.Drop({
            id: this.dragged,
            target: target.dataset.topBlock,
            before: target.dataset.drop === "before",
          }),
        );
      this.dragged = undefined;
      this.clearDrop();
    });
    listen(host, "dragend", () => {
      this.dragged = undefined;
      this.clearDrop();
    });
    this.observer = new MutationObserver(() => {
      if (this.composing || this.reconciliationScheduled) return;
      this.reconciliationScheduled = true;
      queueMicrotask(() => {
        this.reconciliationScheduled = false;
        if (!this.destroyed && !this.composing) this.reconcile();
      });
    });
    this.observe();
  }
  private observe() {
    this.observer.observe(this.host, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }
  private send(message: Message, focus = true) {
    if (this.destroyed) return;
    // Foldkit updates synchronously and renders on the next frame. Project the same
    // pure reducer immediately so a second native event reads current DOM/ranges.
    const next = reduce(this.model, message, this.registry);
    this.model = next;
    this.render(focus);
    this.host.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
  }
  dispatchControl(message: Message) {
    if (this.composing || this.composition) return;
    this.send(message);
  }
  sync(model: Model) {
    if (this.composing || this.composition) {
      // External edits are retained in Foldkit; the composition's revision check
      // will reject a conflicting native commit instead of overwriting them.
      this.model = model;
      return;
    }
    const changed =
      model.revision !== this.model.revision ||
      !equal(model.selection, this.model.selection) ||
      !equal(model.storedMarks, this.model.storedMarks) ||
      model.explicitMarks !== this.model.explicitMarks ||
      (this.model.linkOpen && !model.linkOpen) ||
      (this.model.sourceOpen && !model.sourceOpen);
    this.model = model;
    this.render(
      changed && model.editable && !model.sourceOpen && !model.linkOpen,
    );
  }
  private selection(): Selection | undefined {
    const selection = document.getSelection();
    if (!selection?.anchorNode || !selection.focusNode) return;
    const point = (node: Node, offset: number): Point | undefined => {
      const element = node instanceof Element ? node : node.parentElement;
      const textRoot = element?.closest<HTMLElement>("[data-text-id]");
      if (!textRoot || !this.host.contains(textRoot)) return;
      return {
        id: textRoot.dataset.textId!,
        offset: offsetIn(textRoot, node, offset),
      };
    };
    const anchor = point(selection.anchorNode, selection.anchorOffset);
    const focus = point(selection.focusNode, selection.focusOffset);
    return anchor && focus ? { anchor, focus } : undefined;
  }
  private restoreSelection() {
    const { anchor, focus } = this.model.selection;
    const a = this.nodes.get(anchor.id)?.body;
    const f = this.nodes.get(focus.id)?.body;
    if (!a?.dataset.textId || !f?.dataset.textId) return;
    const [an, ao] = domPoint(a, anchor.offset);
    const [fn, fo] = domPoint(f, focus.offset);
    this.host.focus({ preventScroll: true });
    document.getSelection()?.setBaseAndExtent(an, ao, fn, fo);
  }
  private input(
    kind: "text" | "split" | "break" | "backward" | "forward",
    value = "",
    selection = this.selection() ?? this.model.selection,
  ) {
    this.send(
      Message.Input({
        kind,
        value,
        selection,
        time: Date.now(),
        baseRevision: this.model.revision,
      }),
    );
  }
  private beforeInput(event: InputEvent) {
    if (
      !this.model.editable ||
      this.composing ||
      event.isComposing ||
      !event.cancelable
    )
      return;
    const kinds: Record<
      string,
      "text" | "split" | "break" | "backward" | "forward"
    > = {
      insertText: "text",
      insertReplacementText: "text",
      insertParagraph: "split",
      insertLineBreak: "break",
      deleteContentBackward: "backward",
      deleteContentForward: "forward",
    };
    if (
      event.inputType === "historyUndo" ||
      event.inputType === "historyRedo"
    ) {
      event.preventDefault();
      this.send(
        event.inputType === "historyUndo" ? Message.Undo() : Message.Redo(),
      );
      return;
    }
    const kind = kinds[event.inputType];
    if (!kind) return;
    event.preventDefault();
    const range = event.getTargetRanges?.()[0];
    let selection = this.selection() ?? this.model.selection;
    if (range && event.inputType === "insertReplacementText") {
      const root = (
        range.startContainer instanceof Element
          ? range.startContainer
          : range.startContainer.parentElement
      )?.closest<HTMLElement>("[data-text-id]");
      if (root && root.contains(range.endContainer))
        selection = {
          anchor: {
            id: root.dataset.textId!,
            offset: offsetIn(root, range.startContainer, range.startOffset),
          },
          focus: {
            id: root.dataset.textId!,
            offset: offsetIn(root, range.endContainer, range.endOffset),
          },
        };
    }
    this.input(kind, event.data ?? "", selection);
  }
  private keydown(event: KeyboardEvent) {
    if (
      this.composing ||
      event.isComposing ||
      !this.model.editable ||
      (event.target as HTMLElement).closest('[contenteditable="false"]')
    )
      return;
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === "a") {
        const nodes = leaves(this.model.document).filter(
          (node) => this.registry.get(node.type)?.kind === "text",
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (first && last) {
          event.preventDefault();
          this.send(
            Message.Selected({
              selection: {
                anchor: { id: first.id, offset: 0 },
                focus: { id: last.id, offset: plainText(last).length },
              },
            }),
          );
        }
        return;
      }
      const mark = ({ b: "bold", i: "italic", k: "link" } as const)[key as "b"];
      if (key === "z" || key === "y") {
        event.preventDefault();
        this.send(
          key === "y" || event.shiftKey ? Message.Redo() : Message.Undo(),
        );
        return;
      }
      if (mark) {
        event.preventDefault();
        this.send(Message.Format({ type: mark }));
        return;
      }
    }
    if (event.key === "Escape") {
      this.dragged = undefined;
      this.clearDrop();
      if (this.model.slashOpen) {
        event.preventDefault();
        this.send(Message.ToggleSlash());
      }
    }
    const activeLeaf = this.nodes.get(
      (this.selection() ?? this.model.selection).anchor.id,
    )?.body;
    if (event.key === "Tab" && activeLeaf?.closest("li")) {
      event.preventDefault();
      this.send(Message.Indent({ outdent: event.shiftKey }));
    }
    if (this.model.slashOpen && event.key === "ArrowDown") {
      event.preventDefault();
      this.host
        .closest(".fw-editor")
        ?.querySelector<HTMLElement>(".fw-editor__slash button")
        ?.focus();
    }
  }
  private click(event: MouseEvent) {
    const element = event.target as HTMLElement;
    if (element.closest("a") && this.model.editable) event.preventDefault();
    const control = element.closest<HTMLButtonElement>("[data-block-action]");
    if (control?.dataset.id && this.model.editable) {
      const id = control.dataset.id;
      const action = control.dataset.blockAction;
      if (action === "up" || action === "down")
        this.send(Message.Move({ id, direction: action }));
      else if (action === "duplicate") this.send(Message.Duplicate({ id }));
      else if (action === "delete") this.send(Message.DeleteBlock({ id }));
    }
    const task = element.closest<HTMLElement>("[data-task-id]");
    if (task && this.model.editable) {
      const node = find(this.model.document, task.dataset.taskId!);
      if (node)
        this.send(
          Message.Attributes({
            id: node.id,
            key: "checked",
            value: String(node.attrs.checked !== "true"),
          }),
        );
    }
  }
  private copy(event: ClipboardEvent, cut: boolean) {
    const selected = this.selection();
    if (!selected || !event.clipboardData) return;
    event.preventDefault();
    const [start, end] = orderedRange(this.model.document, selected);
    const nodes = leaves(this.model.document);
    const content = nodes
      .slice(
        nodes.findIndex((node) => node.id === start.id),
        nodes.findIndex((node) => node.id === end.id) + 1,
      )
      .map((node) =>
        plainText(node).slice(
          node.id === start.id ? start.offset : 0,
          node.id === end.id ? end.offset : undefined,
        ),
      )
      .join("\n\n");
    event.clipboardData.setData("text/plain", content);
    if (cut && this.model.editable) this.input("text", "", selected);
  }
  private reconcile() {
    if (this.destroyed || this.composing) return;
    this.nativeDirty = true;
    if (this.compositionTimer) clearTimeout(this.compositionTimer);
    const selection = this.selection() ?? this.model.selection;
    const session = this.composition;
    this.composition = undefined;
    const id = session?.id ?? selection.anchor.id;
    const node = find(this.model.document, id);
    const body = this.nodes.get(id)?.body;
    if (!node || !body?.dataset.textId) {
      this.render(false);
      return;
    }
    const content = readRuns(body);
    if (!equal(content, normalizeRuns(node.content)))
      this.send(
        Message.Reconciled({
          id,
          content,
          selection,
          baseRevision: session?.revision ?? this.model.revision,
          time: Date.now(),
        }),
      );
    else this.render(false);
  }
  private clearDrop() {
    this.host
      .querySelectorAll<HTMLElement>("[data-drop]")
      .forEach((node) => delete node.dataset.drop);
  }
  private render(focus: boolean) {
    if (this.composing || this.destroyed) return;
    this.observer?.disconnect();
    const editableChanged = this.renderedEditable !== this.model.editable;
    if (editableChanged) {
      this.host.contentEditable = String(this.model.editable);
      this.host.setAttribute("aria-readonly", String(!this.model.editable));
      this.renderedEditable = this.model.editable;
    }
    const seen = new Set(
      walk(this.model.document.blocks).map((node) => node.id),
    );
    const renderNodes = (
      parent: HTMLElement,
      blocks: ReadonlyArray<Block>,
      top = false,
    ) => {
      const desired = new Set(blocks.map((node) => node.id));
      for (const [index, node] of blocks.entries()) {
        let record = this.nodes.get(node.id);
        if (
          record?.node === node &&
          record.top === top &&
          !editableChanged &&
          !this.nativeDirty &&
          record.dom.parentElement === parent
        ) {
          if (parent.children[index] !== record.dom)
            parent.insertBefore(record.dom, parent.children[index] ?? null);
          continue;
        }
        if (record && (record.node.type !== node.type || record.top !== top)) {
          record.custom?.destroy();
          record.dom.remove();
          this.nodes.delete(node.id);
          record = undefined;
        }
        if (!record) {
          const definition = this.registry.get(node.type)!;
          const dom = document.createElement(
            node.type === "listItem" ? "li" : "div",
          );
          dom.className = `fw-editor__block fw-editor__block--${node.type}`;
          dom.dataset.blockId = node.id;
          if (top) {
            dom.dataset.topBlock = node.id;
            const controls = document.createElement("div");
            controls.className = "fw-editor__block-tools";
            controls.contentEditable = "false";
            const grip = document.createElement("button");
            grip.type = "button";
            grip.draggable = true;
            grip.dataset.dragBlock = node.id;
            const icon = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "svg",
            );
            icon.setAttribute("viewBox", "0 0 16 16");
            icon.setAttribute("width", "16");
            icon.setAttribute("height", "16");
            icon.setAttribute("aria-hidden", "true");
            for (const x of [5, 11])
              for (const y of [4, 8, 12]) {
                const dot = document.createElementNS(
                  "http://www.w3.org/2000/svg",
                  "circle",
                );
                dot.setAttribute("cx", String(x));
                dot.setAttribute("cy", String(y));
                dot.setAttribute("r", "1");
                dot.setAttribute("fill", "currentColor");
                icon.append(dot);
              }
            grip.append(icon);
            grip.setAttribute("aria-label", `Drag ${definition.label} block`);
            controls.append(grip);
            for (const [action, label] of [
              ["up", "↑"],
              ["down", "↓"],
              ["duplicate", "+"],
              ["delete", "×"],
            ]) {
              const button = document.createElement("button");
              button.type = "button";
              button.dataset.blockAction = action;
              button.dataset.id = node.id;
              button.textContent = label!;
              button.setAttribute("aria-label", `${action} block`);
              controls.append(button);
            }
            dom.append(controls);
          }
          if (definition.view) {
            const chrome = document.createElement("div");
            chrome.contentEditable = "false";
            chrome.className = "fw-editor__custom";
            dom.append(chrome);
            record = {
              dom,
              body: document.createElement("div"),
              node,
              top,
              custom: mountBlockView(chrome, node, definition, (message) =>
                this.send(message, false),
              ),
            };
          }
          const tag =
            node.type === "heading"
              ? `h${node.attrs.level}`
              : node.type === "codeBlock"
                ? "pre"
                : node.type === "blockquote"
                  ? "blockquote"
                  : ["bulletList", "taskList"].includes(node.type)
                    ? "ul"
                    : node.type === "orderedList"
                      ? "ol"
                      : definition.kind === "text"
                        ? "p"
                        : "div";
          const body = document.createElement(tag);
          body.className = "fw-editor__node-content";
          if (definition.kind === "text") body.dataset.textId = node.id;
          if (definition.kind === "atom") {
            body.contentEditable = "false";
            if (!definition.view)
              body.textContent =
                node.type === "rule"
                  ? ""
                  : (node.attrs.label ?? definition.label);
            if (node.type === "rule") body.append(document.createElement("hr"));
          }
          dom.append(body);
          record = { ...record, dom, body, node, top };
          this.nodes.set(node.id, record);
          this.patchText(record, node);
        } else {
          if (
            !equal(record.node.content, node.content) ||
            (record.body.dataset.textId &&
              !equal(readRuns(record.body), normalizeRuns(node.content)))
          )
            this.patchText(record, node);
          if (record.node !== node) record.custom?.sync(node);
          record.node = node;
        }
        record.dom.dataset.tone = node.attrs.tone ?? "";
        const custom = record.dom.querySelector<HTMLElement>(
          ":scope > .fw-editor__custom",
        );
        if (custom) custom.inert = !this.model.editable;
        if (
          node.type === "heading" &&
          record.body.tagName.toLowerCase() !== `h${node.attrs.level}`
        ) {
          const replacement = document.createElement(`h${node.attrs.level}`);
          replacement.dataset.textId = node.id;
          replacement.className = record.body.className;
          replacement.append(...Array.from(record.body.childNodes));
          record.body.replaceWith(replacement);
          record.body = replacement;
        }
        if (node.type === "orderedList")
          record.body.setAttribute("start", node.attrs.start ?? "1");
        if (node.type === "listItem") {
          const isTask = parent
            .closest("[data-block-id]")
            ?.classList.contains("fw-editor__block--taskList");
          let check = record.dom.querySelector<HTMLButtonElement>(
            ":scope > [data-task-id]",
          );
          if (!isTask && check) {
            check.remove();
            check = null;
          }
          if (isTask && !check) {
            check = document.createElement("button");
            check.type = "button";
            check.contentEditable = "false";
            check.dataset.taskId = node.id;
            check.setAttribute("role", "checkbox");
            check.setAttribute("aria-label", "Task completed");
            record.dom.prepend(check);
          }
          if (check) {
            check.textContent = node.attrs.checked === "true" ? "☑" : "☐";
            check.setAttribute(
              "aria-checked",
              String(node.attrs.checked === "true"),
            );
            check.disabled = !this.model.editable;
          }
        }
        record.dom
          .querySelectorAll<HTMLButtonElement>(
            ":scope > .fw-editor__block-tools button",
          )
          .forEach((button) => (button.disabled = !this.model.editable));
        if (parent.children[index] !== record.dom)
          parent.insertBefore(record.dom, parent.children[index] ?? null);
        if (node.children.length) renderNodes(record.body, node.children);
      }
      // Remove stale children before reconciling selection.
      for (const child of Array.from(parent.children))
        if (
          child instanceof HTMLElement &&
          child.dataset.blockId &&
          !desired.has(child.dataset.blockId)
        )
          child.remove();
    };
    renderNodes(this.host, this.model.document.blocks, true);
    for (const [id, record] of this.nodes)
      if (!seen.has(id)) {
        record.custom?.destroy();
        record.dom.remove();
        this.nodes.delete(id);
      }
    if (
      focus &&
      this.model.editable &&
      !this.model.sourceOpen &&
      !this.model.linkOpen
    )
      this.restoreSelection();
    this.renderSelectionMenu();
    this.nativeDirty = false;
    this.observer?.takeRecords();
    if (this.observer) this.observe();
  }
  private renderSelectionMenu() {
    if (!this.selectionMenu && this.host.parentElement) {
      const menu = document.createElement("div");
      menu.className = "fw-editor__selection-tools";
      menu.setAttribute("role", "toolbar");
      menu.setAttribute("aria-label", "Selection formatting");
      for (const type of [
        "bold",
        "italic",
        "strike",
        "code",
        "link",
      ] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = type[0]!.toUpperCase() + type.slice(1);
        button.setAttribute("aria-label", `${type} selection`);
        button.addEventListener(
          "mousedown",
          (event) => event.preventDefault(),
          { signal: this.abort.signal },
        );
        button.addEventListener(
          "click",
          () => this.send(Message.Format({ type })),
          { signal: this.abort.signal },
        );
        menu.append(button);
      }
      this.host.parentElement.append(menu);
      this.selectionMenu = menu;
    }
    const menu = this.selectionMenu;
    if (!menu) return;
    const selection = document.getSelection();
    const show =
      this.model.editable &&
      !this.model.sourceOpen &&
      !this.model.linkOpen &&
      !this.model.slashOpen &&
      !collapsed(this.model.selection) &&
      Boolean(this.selection()) &&
      (selection?.rangeCount ?? 0) > 0;
    menu.hidden = !show;
    if (show && selection) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const paper =
        this.host.closest(".fw-editor__paper")?.getBoundingClientRect() ??
        this.host.getBoundingClientRect();
      menu.style.top = `${Math.max(55, rect.top - paper.top - 44)}px`;
      menu.style.left = `${Math.max(8, Math.min(paper.width - 300, rect.left - paper.left))}px`;
    }
  }
  private patchText(record: Rendered, node: Block) {
    if (!record.body.dataset.textId) return;
    const fragment = document.createDocumentFragment();
    for (const run of node.content) {
      let leaf: Node = document.createTextNode(run.text);
      for (const mark of [...run.marks].reverse()) {
        const el = document.createElement(
          (
            {
              bold: "strong",
              italic: "em",
              strike: "s",
              code: "code",
              link: "a",
            } as const
          )[mark.type],
        );
        if (mark.type === "link") el.setAttribute("href", mark.value);
        el.append(leaf);
        leaf = el;
      }
      fragment.append(leaf);
    }
    if (!plainText(node)) {
      const br = document.createElement("br");
      br.dataset.placeholder = "true";
      fragment.append(br);
    }
    record.body.replaceChildren(fragment);
  }
  destroy() {
    this.destroyed = true;
    this.abort.abort();
    this.observer.disconnect();
    this.selectionMenu?.remove();
    clearTimeout(this.compositionTimer);
    for (const record of this.nodes.values()) record.custom?.destroy();
    this.nodes.clear();
  }
}

export const dispatchControl = (root: Element, message: Message): boolean => {
  const host = root.querySelector(".fw-editor__content");
  const surface = host ? surfaces.get(host) : undefined;
  if (!surface) return false;
  surface.dispatchControl(message);
  return true;
};

/** Foldkit owns the keyed host; its editor surface owns the host's child DOM. */
export const contentView = (
  model: Model,
  registry: Registry,
  h: HtmlBuilder<Message>,
  label = "Document content",
): Html => {
  const vnode = h.div(
    [
      h.Key(model.id),
      h.Class("fw-editor__content"),
      h.Role("textbox"),
      h.AriaLabel(label),
      h.Attribute("aria-multiline", "true"),
      h.Spellcheck(true),
      h.Tabindex(0),
      {
        _tag: "OnCustomEvent",
        name: EVENT,
        f: (event: CustomEvent<Message>) => event.detail,
      },
    ],
    [],
  );
  if (!vnode) return vnode;
  return {
    ...vnode,
    data: {
      ...vnode.data,
      hook: {
        insert: (node) => {
          if (node.elm instanceof HTMLElement)
            surfaces.set(node.elm, new Surface(node.elm, model, registry));
        },
        postpatch: (_old, node) => {
          if (node.elm instanceof HTMLElement)
            surfaces.get(node.elm)?.sync(model);
        },
        destroy: (node) => {
          if (node.elm instanceof HTMLElement) {
            surfaces.get(node.elm)?.destroy();
            surfaces.delete(node.elm);
          }
        },
      },
    },
  };
};
