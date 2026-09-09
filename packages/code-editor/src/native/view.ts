import { Mount } from "foldkit";
import { type Html, type HtmlBuilder } from "foldkit/html";
import type { Model } from "./model";
import { Message, type Action } from "./message";
import { ObserveInput } from "./mount";
import { completions, findMatches } from "./operations";
import { lineAt, type Line } from "./tokenize";

export const visibleLines = (model: Model): Readonly<{ from: number; to: number }> => model.options.lineWrapping
  ? { from: 0, to: model.lines.length }
  : { from: Math.min(model.lines.length - 1, Math.max(0, Math.floor((model.viewport.top - 12) / 22) - 8)), to: Math.min(model.lines.length, Math.ceil((model.viewport.top + model.viewport.height) / 22) + 8) };

export type ViewConfig<ParentMessage> = import("../contracts").ViewConfig<Model, Message, ParentMessage>;

const paintedLine = <ParentMessage>(line: Line, start: number, issues: readonly { from: number; to: number; severity: string }[], matches: readonly { from: number; to: number }[], h: HtmlBuilder<ParentMessage>): readonly Html[] => {
  const ends = new Set([0, line.text.length]);
  for (const token of line.tokens) { ends.add(token.from); ends.add(token.to); }
  for (const range of [...issues, ...matches]) {
    if (range.to >= start && range.from <= start + line.text.length) {
      ends.add(Math.max(0, range.from - start)); ends.add(Math.min(line.text.length, range.to - start));
    }
  }
  const positions = [...ends].sort((a, b) => a - b);
  const spans: Html[] = [];
  positions.forEach((from, index) => {
    if (issues.some((issue) => issue.from === issue.to && issue.from === start + from)) spans.push(h.span([h.Class("native-token--point-issue")], ["\u200b"]));
    if (index === positions.length - 1) return;
    const to = positions[index + 1]!;
    const token = line.tokens.find((token) => token.from <= from && token.to > from);
    const issue = issues.find((issue) => issue.from < start + to && issue.to > start + from);
    const match = matches.some((match) => match.from < start + to && match.to > start + from);
    const classes = [`native-token--${token?.kind ?? "plain"}`, ...(issue ? ["native-token--issue", `native-token--${issue.severity}`] : []), ...(match ? ["native-token--match"] : [])];
    spans.push(h.span([h.Class(classes.join(" "))], [line.text.slice(from, to)]));
  });
  if (!line.text.length) spans.push(h.span([], ["\u200b"]));
  return spans;
};

export const view = <ParentMessage>({ model, label, toParentMessage, showInspector = true }: ViewConfig<ParentMessage>, h: HtmlBuilder<ParentMessage>): Html => {
  const { from, to } = visibleLines(model);
  const activeLine = lineAt(model.starts, model.selection.head);
  const issues = model.diagnostics.flatMap((batch) => batch.diagnostics.map((issue) => ({ ...issue, source: batch.source })));
  const matches = model.search.open ? findMatches(model.document.text, model.search.query, model.search.caseSensitive) : [];
  const choices = model.completion.open ? completions(model.document.text, model.selection) : { from: 0, items: [] };
  const button = (label: string, message: Message, disabled = false): Html => h.button([
    h.Type("button"), h.Class("native-editor__button"), h.OnClick(toParentMessage(message)), ...(disabled ? [h.Disabled(true)] : []),
  ], [label]);
  const action = (label: string, action: Action, disabled = false) => button(label, Message.Run({ action }), disabled);
  return h.section([
    h.Key(model.id), h.Class("native-editor"), h.DataAttribute("native-editor", model.id), h.DataAttribute("mode", model.options.theme),
    h.Style({ "--native-tab-size": String(model.options.tabSize) }),
  ], [
    h.div([h.Class("native-editor__heading")], [h.strong([], [label]), h.span([], [`${model.document.languageId} · Foldkit native${model.options.readOnly ? " · Read only" : ""}`])]),
    h.div([h.Class("native-editor__tools"), h.Role("group"), h.AriaLabel(`${label} tools`)], [
      action("Undo", "undo", !model.past.length || model.options.readOnly), action("Redo", "redo", !model.future.length || model.options.readOnly),
      action("Indent", "indent", model.options.readOnly), action("Outdent", "outdent", model.options.readOnly),
      action("Toggle comment", "comment", model.options.readOnly || model.document.languageId === "json"),
      action("Duplicate", "duplicate", model.options.readOnly),
      button("Find / replace", Message.OpenSearch({ open: !model.search.open })),
      button("Suggest", Message.OpenCompletion({ open: !model.completion.open }), model.options.readOnly),
      ...(model.document.languageId === "json" ? [action("Format JSON", "format", model.options.readOnly)] : []),
    ]),
    ...(model.search.open ? [h.div([h.Key(`${model.id}-search`), h.Class("native-editor__search"), h.Role("group"), h.AriaLabel(`${label} search`)], [
      h.input([h.Id(`${model.id}-find`), h.Type("text"), h.AriaLabel(`${label} find`), h.Placeholder("Find text"), h.Value(model.search.query), h.OnInput((query) => toParentMessage(Message.SearchQuery({ query })))]),
      h.input([h.Type("text"), h.AriaLabel(`${label} replace with`), h.Placeholder("Replace with"), h.Value(model.search.replacement), h.OnInput((replacement) => toParentMessage(Message.SearchReplacement({ replacement })))]),
      button(model.search.caseSensitive ? "Match case: on" : "Match case: off", Message.ToggleCase()),
      action("Previous", "findPrevious"), action("Next", "findNext"),
      action("Replace", "replace", model.options.readOnly), action("Replace all", "replaceAll", model.options.readOnly),
      h.span([h.AriaLive("polite")], [`${matches.length}${matches.length === 1000 ? "+" : ""} matches`]),
      button("Close search", Message.OpenSearch({ open: false })),
    ])] : []),
    h.div([h.Key(`${model.id}-surface`), h.Class(`native-editor__surface${model.options.lineWrapping ? " native-editor__surface--wrap" : ""}`)], [
      h.div([h.Class("native-editor__gutter"), h.AriaHidden(true), ...(!model.options.lineNumbers ? [h.Style({ display: "none" })] : [])], [
        h.div([h.Class("native-editor__gutter-lines"), h.Style({ paddingTop: `${12 + from * 22}px` })], model.lines.slice(from, to).map((_, index) => {
          const row = from + index;
          const hasIssue = issues.some((issue) => lineAt(model.starts, issue.from) === row);
          return h.div([h.DataAttribute("native-number", String(row)), h.Class(`${row === activeLine ? "native-editor__active-number" : ""}${hasIssue ? " native-editor__issue-number" : ""}`)], [String(row + 1)]);
        })),
      ]),
      h.div([h.Class("native-editor__text")], [
        h.div([h.Class("native-editor__mirror"), h.AriaHidden(true)], [
          h.div([h.Style({ height: `${from * 22}px` })]),
          ...model.lines.slice(from, to).map((line, index) => {
            const row = from + index;
            return h.div([h.DataAttribute("native-line", String(row)), h.Class(`native-editor__line${row === activeLine ? " native-editor__line--active" : ""}`)], paintedLine(line, model.starts[row]!, issues, model.search.open ? matches : [], h));
          }),
        ]),
        h.textarea([
          h.Id(model.id), h.Class("native-editor__input"), h.AriaLabel(label),
          h.Attribute("aria-describedby", `${model.id}-help`), h.Attribute("spellcheck", "false"), h.Attribute("autocapitalize", "off"), h.Attribute("autocomplete", "off"),
          h.Wrap(model.options.lineWrapping ? "soft" : "off"),
          h.Readonly(model.options.readOnly),
          { _tag: "Prop", key: "foldkitNative", value: model },
          ...(model.completion.open && choices.items.length ? [h.Attribute("aria-controls", `${model.id}-completions`), h.Attribute("aria-activedescendant", `${model.id}-choice-${model.completion.index}`)] : []),
          h.OnMount(Mount.mapMessage(ObserveInput(), toParentMessage)),
        ], []),
      ]),
    ]),
    ...(model.completion.open ? [h.div([h.Key(`${model.id}-completion`), h.Class("native-editor__completion")], [
      h.span([], ["Suggestions · Ctrl+Space · arrows + Enter"]),
      h.ul([h.Id(`${model.id}-completions`), h.Role("listbox"), h.AriaLabel(`${label} suggestions`)], choices.items.map((choice, index) => h.li([
        h.Id(`${model.id}-choice-${index}`), h.Role("option"), h.Attribute("aria-selected", String(index === model.completion.index)),
      ], [button(choice, Message.ChooseCompletion({ index }))]))),
      ...(choices.items.length ? [] : [h.span([], ["No matching words."])]),
    ])] : []),
    h.div([h.Key(`${model.id}-status`), h.Class("native-editor__status")], [
      h.span([], [`Ln ${activeLine + 1}, Col ${model.selection.head - model.starts[activeLine]! + 1}`]),
      h.span([h.Id(`${model.id}-help`)], [model.options.readOnly ? "Read only" : "Tab moves focus · Ctrl/Cmd + ] indents"]),
      h.span([h.AriaLive("polite")], [model.composing ? "Composing…" : `${issues.length} problems`]),
      h.label([], ["Line ", h.input([h.Type("number"), h.Min("1"), h.Max(String(model.lines.length)), h.AriaLabel(`${label} go to line`), h.Value(model.goToLine), h.OnInput((value) => toParentMessage(Message.GoToLine({ value })))]), action("Go", "goToLine")]),
    ]),
    ...(issues.length ? [h.ul([h.Class("native-editor__problems"), h.AriaLabel(`${label} problems`)], issues.map((issue) => h.li([], [
      button(`${issue.severity} · ${lineAt(model.starts, issue.from) + 1}:${issue.from - model.starts[lineAt(model.starts, issue.from)]! + 1} · ${issue.message}`, Message.Reveal({ selection: { anchor: issue.from, head: issue.to } })),
    ])))] : []),
    ...(model.error ? [h.p([h.Class("native-editor__error"), h.Role("alert")], [model.error])] : []),
    ...(showInspector ? [h.details([h.Class("native-editor__inspector")], [
      h.summary([], ["Explore editor state"]),
      h.dl([], [
        h.dt([], ["Document"]), h.dd([], [`${model.document.text.length.toLocaleString()} UTF-16 units · revision ${model.document.revision}`]),
        h.dt([], ["Selection"]), h.dd([], [`anchor ${model.selection.anchor} → head ${model.selection.head}`]),
        h.dt([], ["Renderer"]), h.dd([], [`${to - from} of ${model.lines.length} lines · ${model.options.lineWrapping ? "wrapped layout" : "visible lines + overscan"}`]),
        h.dt([], ["Undo / redo"]), h.dd([], [`${model.past.length} / ${model.future.length} groups · reversible range edits`]),
        h.dt([], ["Highlighting"]), h.dd([], ["Incremental line lexer · cached until lexical state changes"]),
      ]),
    ])] : []),
  ]);
};
