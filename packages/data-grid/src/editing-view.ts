import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { CellEditor } from "./core";
import type { ActiveEdit } from "./editing-model";
import { commitMessage, editIssues, parseInput, saveMessage } from "./editing";
import { Message } from "./message";
import type { ViewConfig } from "./view";

export const editorView = <Row, ParentMessage>(
  editor: CellEditor<Row>, active: ActiveEdit, row: Row, id: string, label: string,
  toParent: (message: Message) => ParentMessage, h: HtmlBuilder<ParentMessage>,
): Html => {
  const attrs = [h.Id(id), h.Class("fk-data-grid__editor"), h.AriaLabel(label), h.AriaInvalid(active.error !== ""), h.AriaDescribedBy(`${id}:help`)];
  const change = (input: string) => toParent(Message.ChangedEdit(parseInput(editor, input, row)));
  if (editor.kind === "Select") return h.select([
    ...attrs, h.Value(active.input), h.OnChange(change),
  ], [
    ...(!editor.options?.some((option) => option.value === active.input)
      ? [h.option([h.Value(active.input), h.Disabled(true)], ["Choose an option"])] : []),
    ...(editor.options ?? []).map((option) => h.option([h.Value(option.value)], [option.label])),
  ]);
  if (editor.kind === "Checkbox") return h.input([
    ...attrs, h.Type("checkbox"), h.Checked(active.value === true),
    h.OnChange(() => change(active.value === true ? "false" : "true")),
  ]);
  return h.input([...attrs, h.Type(editor.kind === "Number" ? "number" : "text"), h.Value(active.input), h.OnInput(change)]);
};

export const editingToolbar = <Row, ParentMessage>(config: ViewConfig<Row, ParentMessage>, h: HtmlBuilder<ParentMessage>): Html => {
  const { model, toParentMessage: toParent } = config;
  const active = Option.getOrUndefined(model.activeEdit);
  const pending = Option.isSome(model.pendingSubmission);
  const issues = editIssues(config);
  const rows = new Set(model.drafts.map((draft) => draft.rowId)).size;
  const count = model.drafts.length;
  const button = (label: string, message: Message, disabled: boolean) => h.button([
    h.Type("button"), h.Class("fk-data-grid__edit-button"), h.Disabled(disabled), h.OnClick(toParent(message)),
  ], [label]);
  const error = active?.error || model.saveError || issues[0]?.error || "";
  return h.div([h.Class("fk-data-grid__editing")], [
    h.div([h.Class("fk-data-grid__edit-toolbar"), h.Role("group"), h.AriaLabel("Edit changes")], [
      h.span([h.Role("status"), h.AriaLive("polite")], [pending ? "Saving changes…" : `${count} ${count === 1 ? "change" : "changes"} across ${rows} ${rows === 1 ? "row" : "rows"}`]),
      ...(active === undefined ? [] : [
        button(model.editingMode === "Batch" ? "Stage edit" : "Submit edit", commitMessage(config), pending),
        button("Cancel edit", Message.CancelledEdit(), pending),
      ]),
      button("Discard changes", Message.DiscardedEdits(), pending || (count === 0 && active === undefined)),
      button(model.editingMode === "Batch" ? "Save changes" : "Retry edit", saveMessage(config), pending || active !== undefined || count === 0 || issues.length > 0),
    ]),
    ...(error ? [h.p([h.Class("fk-data-grid__edit-error"), h.Role("alert")], [error])] : []),
  ]);
};
