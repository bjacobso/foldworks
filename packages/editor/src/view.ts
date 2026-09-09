import { defineView } from "foldkit/submodel";
import type { Html, HtmlBuilder } from "foldkit/html";
import { contentView, dispatchControl } from "./browser";
import { find, plainText, type Registry } from "./document";
import { Message, activeMarks, type Model } from "./model";

const button = (
  label: string,
  message: Message,
  h: HtmlBuilder<Message>,
  disabled = false,
  active = false,
): Html =>
  h.button(
    [
      h.Key(label),
      h.Type("button"),
      h.Class("fw-editor__button"),
      h.Disabled(disabled),
      h.AriaPressed(String(active)),
      h.DataAttribute("editor-action", JSON.stringify(message)),
      h.OnClick(message),
    ],
    [label],
  );
export const toolbarView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const marks = activeMarks(model);
  return h.div(
    [
      h.Class("fw-editor__toolbar"),
      h.Role("toolbar"),
      h.AriaLabel("Text formatting"),
    ],
    [
      button("Undo", Message.Undo(), h, !model.editable || !model.past.length),
      button(
        "Redo",
        Message.Redo(),
        h,
        !model.editable || !model.future.length,
      ),
      h.span([h.Class("fw-editor__separator"), h.AriaHidden(true)]),
      ...(["bold", "italic", "strike", "code", "link"] as const).map((type) =>
        button(
          type[0]!.toUpperCase() + type.slice(1),
          Message.Format({ type }),
          h,
          !model.editable,
          marks.some((mark) => mark.type === type),
        ),
      ),
      h.span([h.Class("fw-editor__separator"), h.AriaHidden(true)]),
      h.select(
        [
          h.AriaLabel("Block type"),
          h.Disabled(!model.editable),
          h.Value(
            find(model.document, model.selection.anchor.id)?.type ??
              "paragraph",
          ),
          h.OnChange((type) => Message.Convert({ type })),
        ],
        [
          ...[
            ["paragraph", "Text"],
            ["heading", "Heading"],
            ["blockquote", "Quote"],
            ["codeBlock", "Code block"],
            ["bulletList", "Bullet list"],
            ["orderedList", "Numbered list"],
            ["taskList", "Task list"],
          ].map(([value, label]) => h.option([h.Value(value!)], [label!])),
        ],
      ),
      button(
        "+ Block",
        Message.ToggleSlash(),
        h,
        !model.editable,
        model.slashOpen,
      ),
      button("Indent", Message.Indent({ outdent: false }), h, !model.editable),
      button("Outdent", Message.Indent({ outdent: true }), h, !model.editable),
    ],
  );
};
const controlListeners = new WeakMap<Element, (event: Event) => void>();
export const viewWith = (registry: Registry) =>
  defineView<Model, Message>((model, h) => {
    const selected = find(model.document, model.selection.anchor.id);
    const query =
      model.slashOpen && selected && plainText(selected).startsWith("/")
        ? plainText(selected).slice(1).toLowerCase()
        : "";
    const options = [...registry.values()].filter(
      (def) =>
        def.name !== "listItem" && def.label.toLowerCase().includes(query),
    );
    const vnode = h.section(
      [h.Class("fw-editor"), h.DataAttribute("editor-id", model.id)],
      [
        h.header(
          [h.Class("fw-editor__header")],
          [
            h.div(
              [],
              [
                h.span([h.Class("fw-editor__eyebrow")], ["FOLDWORKS EDITOR"]),
                h.h1([], ["A place for your ideas"]),
                h.p([], ["Write naturally. Shape your document with blocks."]),
              ],
            ),
            h.div(
              [h.Class("fw-editor__document-actions")],
              [
                button(
                  model.editable ? "Read only" : "Edit document",
                  Message.ToggleEditable(),
                  h,
                ),
                button(
                  "Markdown source",
                  Message.ToggleSource(),
                  h,
                  !model.editable,
                  model.sourceOpen,
                ),
                h.label(
                  [h.Class("fw-editor__button fw-editor__file")],
                  [
                    "Import .md",
                    h.input([
                      h.Type("file"),
                      h.Accept(".md,.markdown,text/markdown,text/plain"),
                      h.AriaLabel("Import Markdown file"),
                      h.Disabled(!model.editable),
                      h.OnFileChange((files) => Message.Files({ files })),
                    ]),
                  ],
                ),
                button(
                  "Export Markdown",
                  Message.Export({ portable: false }),
                  h,
                ),
                button(
                  "Portable export",
                  Message.Export({ portable: true }),
                  h,
                ),
              ],
            ),
          ],
        ),
        h.div(
          [h.Class("fw-editor__paper")],
          [
            toolbarView(model, h),
            ...(model.linkOpen
              ? [
                  h.div(
                    [h.Key("link"), h.Class("fw-editor__link")],
                    [
                      h.input([
                        h.AriaLabel("Link URL"),
                        h.Placeholder("https://example.com"),
                        h.Value(model.linkValue),
                        h.OnInput((value) => Message.ChangedLink({ value })),
                      ]),
                      button("Apply link", Message.ApplyLink(), h),
                      button("Cancel", Message.CancelLink(), h),
                    ],
                  ),
                ]
              : []),
            ...(model.sourceOpen
              ? [
                  h.div(
                    [h.Key("source"), h.Class("fw-editor__source")],
                    [
                      h.label(
                        [h.For(`${model.id}-source`)],
                        ["Markdown source"],
                      ),
                      h.textarea([
                        h.Id(`${model.id}-source`),
                        h.AriaLabel("Markdown source"),
                        h.Spellcheck(false),
                        h.Value(model.source),
                        h.OnInput((value) => Message.ChangedSource({ value })),
                      ]),
                      h.div(
                        [],
                        [
                          button("Apply source", Message.ApplySource(), h),
                          button("Cancel source", Message.CancelSource(), h),
                        ],
                      ),
                    ],
                  ),
                ]
              : []),
            // Keep the keyed surface mounted while source is open; its composition and
            // lifecycle are independent of the surrounding toolbar and panels.
            h.div(
              [h.Key("surface"), h.Hidden(model.sourceOpen)],
              [contentView(model, registry, h)],
            ),
            ...(model.slashOpen
              ? [
                  h.div(
                    [
                      h.Key("slash"),
                      h.Class("fw-editor__slash"),
                      h.Role("group"),
                      h.AriaLabel("Insert a block"),
                    ],
                    [
                      h.strong([], ["Insert a block"]),
                      ...options.map((def) =>
                        button(
                          def.label,
                          Message.Insert({ type: def.name }),
                          h,
                        ),
                      ),
                      ...(options.length
                        ? []
                        : [h.p([], ["No matching blocks"])]),
                      button("Close block menu", Message.ToggleSlash(), h),
                    ],
                  ),
                ]
              : []),
            h.footer(
              [h.Class("fw-editor__footer")],
              [
                h.span(
                  [],
                  [
                    `${model.document.blocks.length} blocks · ${model.editable ? "Editing" : "Read only"}`,
                  ],
                ),
                h.span([], ["Type / for blocks · ⌘/Ctrl B for bold"]),
              ],
            ),
          ],
        ),
        ...(model.diagnostics.length
          ? [
              h.div(
                [h.Class("fw-editor__diagnostics"), h.Role("alert")],
                model.diagnostics.map((reason) => h.p([], [reason])),
              ),
            ]
          : []),
        ...(model.exportText
          ? [
              h.section(
                [h.Class("fw-editor__export")],
                [
                  h.h2([], ["Markdown export"]),
                  h.a(
                    [
                      h.Href(
                        `data:text/markdown;charset=utf-8,${encodeURIComponent(model.exportText)}`,
                      ),
                      h.Download("document.md"),
                      h.Class("fw-editor__button"),
                    ],
                    ["Download document.md"],
                  ),
                  h.textarea([
                    h.AriaLabel("Exported Markdown"),
                    h.Readonly(true),
                    h.Value(model.exportText),
                  ]),
                ],
              ),
            ]
          : []),
        h.div(
          [
            h.Class("fw-editor__sr-only"),
            h.Role("status"),
            h.AriaLive("polite"),
          ],
          [model.announcement],
        ),
      ],
    );
    if (!vnode) return vnode;
    return {
      ...vnode,
      data: {
        ...vnode.data,
        hook: {
          insert: (node) => {
            if (!(node.elm instanceof HTMLElement)) return;
            const root = node.elm;
            const listener = (event: Event) => {
              const button = (
                event.target as Element
              ).closest<HTMLButtonElement>("button[data-editor-action]");
              if (!button || button.disabled) return;
              const message = JSON.parse(
                button.dataset.editorAction!,
              ) as Message;
              if (
                ![
                  "Insert",
                  "Format",
                  "Undo",
                  "Redo",
                  "ToggleSlash",
                  "Indent",
                ].includes(message._tag)
              )
                return;
              if (dispatchControl(root, message)) {
                event.preventDefault();
                event.stopPropagation();
              }
            };
            root.addEventListener("click", listener, true);
            controlListeners.set(root, listener);
          },
          destroy: (node) => {
            if (node.elm instanceof Element) {
              const listener = controlListeners.get(node.elm);
              if (listener)
                node.elm.removeEventListener("click", listener, true);
              controlListeners.delete(node.elm);
            }
          },
        },
      },
    };
  });
