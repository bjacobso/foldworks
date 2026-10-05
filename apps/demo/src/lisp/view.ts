import { CodeEditor } from "@foldworks/code-editor";
import { Button, Switch } from "@foldworks/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import { Message } from "./message";
import type { Entry, Model } from "./model";

const shortcuts: readonly (readonly [string, string])[] = [
  ["Cmd/Ctrl + Enter", "Evaluate the form at the cursor"],
  ["Shift + Cmd/Ctrl + Enter", "Load the whole file"],
  ["Alt + ↑ / ↓", "Expand or shrink the selection by form"],
  ["Alt + ← / →", "Move by whole forms"],
  ["Ctrl + Alt + → / ←", "Slurp or barf the next form"],
  ["Alt + R · Alt + S", "Raise or splice the form"],
  ["Alt + (", "Wrap the form in a new list"],
  [") ] }", "Leave the enclosing form"],
];

const entryView = (entry: Entry, h: HtmlBuilder<Message>): Html => {
  const { outcome } = entry;
  const action = (label: string, message: Message) =>
    h.button([h.Type("button"), h.Class("lisp-entry__action"), h.OnClick(message)], [label]);
  return h.article(
    [h.Key(`entry-${entry.id}`), h.Class(`lisp-entry lisp-entry--${outcome.status}`)],
    [
      h.div(
        [h.Class("lisp-entry__header")],
        [
          h.span(
            [h.Class("lisp-entry__origin")],
            [entry.origin === "file" ? "ledger.clj" : "repl"],
          ),
          h.code([h.Class("lisp-entry__source")], [outcome.source]),
          h.span(
            [h.Class("lisp-entry__actions")],
            [
              ...(entry.origin === "file"
                ? [action("Show", Message.Reveal({ id: entry.id }))]
                : [action("Add to file", Message.Promote({ id: entry.id }))]),
              action("Edit", Message.Recall({ id: entry.id })),
            ],
          ),
        ],
      ),
      ...(outcome.output.length
        ? [h.pre([h.Class("lisp-entry__output")], [outcome.output.join("\n")])]
        : []),
      outcome.table
        ? h.div(
            [h.Class("lisp-entry__table")],
            [
              h.table(
                [],
                [
                  h.thead(
                    [],
                    [
                      h.tr(
                        [],
                        outcome.table.columns.map((column) => h.th([], [column])),
                      ),
                    ],
                  ),
                  h.tbody(
                    [],
                    outcome.table.rows.map((row) =>
                      h.tr(
                        [],
                        row.map((cell) => h.td([], [cell])),
                      ),
                    ),
                  ),
                ],
              ),
              h.span(
                [h.Class("lisp-entry__count")],
                [
                  outcome.table.total > outcome.table.rows.length
                    ? `Showing ${outcome.table.rows.length} of ${outcome.table.total} rows`
                    : `${outcome.table.total} row${outcome.table.total === 1 ? "" : "s"}`,
                ],
              ),
            ],
          )
        : h.pre(
            [h.Class("lisp-entry__value")],
            [outcome.status === "error" ? `× ${outcome.pretty}` : outcome.pretty],
          ),
    ],
  );
};

export const view = defineView<Model, Message, { isDark: boolean }>((model, { isDark }, h) => {
  const theme = isDark ? "dark" : "light";
  const results = model.editor.annotations.filter((item) => !item.stale).length;
  const stale = model.editor.annotations.length - results;
  return h.div(
    [h.Class("lisp-demo"), h.DataAttribute("lisp-demo", "true")],
    [
      h.div(
        [h.Class("lisp-demo__intro")],
        [
          h.p([h.Class("lisp-demo__eyebrow")], ["Live Lisp"]),
          h.h1([], ["Edit forms, not characters."]),
          h.p(
            [],
            [
              "A Clojure-flavored editor built on the native code editor. Delimiters stay balanced, commands work on whole forms, and each form shows its result inline. When you edit a form, its result dims as stale. The REPL is a transcript of forms you can bring back into the file.",
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("lisp-demo__toolbar")],
        [
          Switch.view(
            {
              id: "lisp-live",
              label: "Live evaluation",
              description: "Reload the file on every edit",
              isChecked: model.live,
              onToggle: () => Message.ToggleLive(),
            },
            h,
          ),
          Button.view({ label: "Load file", variant: "outline", onClick: Message.LoadFile() }, h),
          Button.view(
            { label: "Reset image", variant: "outline", onClick: Message.ResetImage() },
            h,
          ),
          h.span(
            [h.Class("lisp-demo__status")],
            [`${results} result${results === 1 ? "" : "s"}${stale ? ` · ${stale} stale` : ""}`],
          ),
        ],
      ),
      h.div(
        [h.Class("lisp-demo__workspace")],
        [
          h.div(
            [h.Class("lisp-demo__file")],
            [
              CodeEditor.view(
                {
                  model: { ...model.editor, options: { ...model.editor.options, theme } },
                  label: "ledger.clj",
                  toParentMessage: (message) => Message.Editor({ message }),
                  showInspector: false,
                },
                h,
              ),
            ],
          ),
          h.section(
            [h.Class("lisp-demo__repl"), h.AriaLabel("REPL")],
            [
              h.div(
                [h.Class("lisp-demo__repl-heading")],
                [
                  h.strong([], ["REPL"]),
                  h.span([], [`image ${model.generation + 1}`]),
                  ...(model.transcript.length
                    ? [
                        h.button(
                          [
                            h.Type("button"),
                            h.Class("lisp-entry__action"),
                            h.OnClick(Message.ClearTranscript()),
                          ],
                          ["Clear"],
                        ),
                      ]
                    : []),
                ],
              ),
              h.div(
                [h.Class("lisp-demo__transcript"), h.Role("log"), h.AriaLabel("REPL transcript")],
                model.transcript.length
                  ? [...model.transcript].reverse().map((entry) => entryView(entry, h))
                  : [
                      h.p(
                        [h.Class("lisp-demo__empty")],
                        [
                          "Put the cursor in a form in ledger.clj and press Cmd/Ctrl + Enter, or type below. Try the forms in the comment block at the end of the file.",
                        ],
                      ),
                    ],
              ),
              h.div(
                [h.Class("lisp-demo__input")],
                [
                  CodeEditor.view(
                    {
                      model: { ...model.repl, options: { ...model.repl.options, theme } },
                      label: "REPL input",
                      meta: "Cmd/Ctrl + Enter to evaluate",
                      toParentMessage: (message) => Message.Repl({ message }),
                      showToolbar: false,
                      showInspector: false,
                    },
                    h,
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      h.dl(
        [h.Class("lisp-demo__keys"), h.AriaLabel("Keyboard shortcuts")],
        shortcuts.flatMap(([keys, description]) => [h.dt([], [keys]), h.dd([], [description])]),
      ),
      h.p([h.Class("lisp-demo__announcement"), h.AriaLive("polite")], [model.announcement]),
    ],
  );
});
