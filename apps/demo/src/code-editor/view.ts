import { CodeEditor } from "@foldworks/code-editor";
import { Badge, Button, Select } from "@foldworks/ui";
import { defineView } from "foldkit/submodel";
import { Message } from "./message";
import type { Model } from "./model";

export const view = defineView<Model, Message, { isDark: boolean }>((model, { isDark }, h) => {
  const theme = isDark ? "dark" : "light";
  const dirty = model.savedText !== model.editor.document.text || model.savedSession !== model.editor.document.session;
  return h.div([h.Class("code-demo"), h.DataAttribute("code-editor-demo", "true")], [
    h.div([h.Class("code-demo__intro")], [
      h.p([h.Class("code-demo__eyebrow")], ["Code editor"]),
      h.h1([], ["A little room to write code."]),
      h.p([], ["A native Foldkit editor with highlighting, search, suggestions, and live JSON and YAML validation against an Effect Schema. Inspect the editor state below, or load a larger document to explore visible-line rendering."]),
    ]),
    h.div([h.Class("code-demo__toolbar")], [
      Select.control({ ariaLabel: "Example language", value: model.editor.document.languageId,
        options: [{ value: "json", label: "JSON configuration" }, { value: "yaml", label: "YAML configuration" }, { value: "typescript", label: "TypeScript" }, { value: "text", label: "Plain text" }],
        onChange: (languageId) => Message.LoadSample({ languageId }),
      }, h),
      Button.view({ label: "Load 2,000 lines", variant: "outline", onClick: Message.LoadSample({ languageId: "large" }) }, h),
      Button.view({ label: model.editor.options.lineWrapping ? "Unwrap lines" : "Wrap lines", variant: "outline", onClick: Message.ToggleWrapping() }, h),
      h.div([h.Class("code-demo__save")], [
        Badge.view({ label: dirty ? "Unsaved changes" : "Snapshot saved", tone: dirty ? "warning" : "success", dot: true }, h),
        Button.view({ label: "Save snapshot", onClick: Message.Save(), isDisabled: !dirty }, h),
      ]),
    ]),
    ...(["json", "yaml"].includes(model.editor.document.languageId) ? [
      h.p([], ["Configuration schema: a nonempty name, development or production environment, boolean feature flags, and 0–10 retry attempts. Try an invalid value or remove a required field to see its validation error."]),
    ] : []),
    CodeEditor.view({ model: { ...model.editor, options: { ...model.editor.options, theme } }, label: "Working document", toParentMessage: (message) => Message.Editor({ message }) }, h),
    h.div([h.Class("code-demo__reference-heading")], [
      h.div([], [h.h2([], ["Another independent document"]), h.p([], [model.reference.options.readOnly ? "This reference is read only. Enable editing to try the second editor." : "Editing enabled, with its own document, selection, and undo history."])]),
      Button.view({ label: model.reference.options.readOnly ? "Enable reference editing" : "Make reference read only", variant: "outline", onClick: Message.ToggleReadOnly() }, h),
    ]),
    CodeEditor.view({ model: { ...model.reference, options: { ...model.reference.options, theme } }, label: "TypeScript reference", toParentMessage: (message) => Message.Reference({ message }) }, h),
    h.p([], ["JSON and YAML share one Effect Schema, with syntax and field errors shown as squiggles. Highlighting uses a small lexer and suggestions use document words. Multi-cursor editing, semantic language services, and full international text layout remain future work."]),
    h.p([h.Class("code-demo__announcement"), h.AriaLive("polite")], [model.announcement]),
  ]);
});
