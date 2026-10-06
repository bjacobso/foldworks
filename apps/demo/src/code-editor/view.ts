import { CodeEditor } from "@foldworks/code-editor";
import { Badge, Button, Select, Tree, Workspace } from "@foldworks/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import {
  analyze,
  describe,
  environmentLanguage,
  isSetting,
  occurrences,
  platform,
  resolve,
  type Analysis,
  type Description,
} from "./environment";
import { Message } from "./message";
import type { Model } from "./model";

type H = HtmlBuilder<Message>;

const hoverContent = (description: Description, h: H): Html =>
  h.div(
    [h.Class("code-demo-hover")],
    [
      h.p(
        [h.Class("code-demo-hover__heading")],
        [h.code([], [description.title]), h.span([], [description.kind])],
      ),
      ...(description.summary === undefined ? [] : [h.p([], [description.summary])]),
      ...(description.values === undefined
        ? []
        : [
            h.p(
              [h.Class("code-demo-hover__values")],
              ["One of ", ...description.values.map((value) => h.code([], [value]))],
            ),
          ]),
      ...(description.value === undefined
        ? []
        : [h.p([], ["Resolves to ", h.code([], [description.value])])]),
    ],
  );

/** Settings in the file and values from the platform; choosing one highlights where it is set and used. */
const settingsPanel = (model: Model, analysis: Analysis, h: H): Html => {
  const uses = (name: string) =>
    occurrences(analysis, name).filter((occurrence) => occurrence.kind === "reference").length;
  const entry = (name: string, value: string, known: boolean) => {
    const count = uses(name);
    const usage = count === 0 ? "" : count === 1 ? "1 use" : `${count} uses`;
    const shown = value === "" ? "Empty" : value;
    return h.li(
      [],
      [
        h.button(
          [
            h.Type("button"),
            h.Class("code-demo-settings__entry"),
            h.DataAttribute("known", String(known)),
            h.AriaLabel(`${name}, ${shown}${usage === "" ? "" : `, ${usage}`}`),
            h.AriaPressed(model.selectedSetting === name ? "true" : "false"),
            h.OnClick(Message.SelectSetting({ name })),
          ],
          [
            h.code([], [name]),
            h.span([h.Class("code-demo-settings__uses")], [usage]),
            h.span([h.Class("code-demo-settings__value")], [shown]),
          ],
        ),
      ],
    );
  };
  const names = [...new Set(analysis.entries.map((candidate) => candidate.name))].filter(
    (name) => name !== "",
  );
  return h.section(
    [h.Class("code-demo-settings"), h.AriaLabel("Environment settings")],
    [
      h.h2([], ["Settings"]),
      h.ul(
        [h.AriaLabel("Settings in this file")],
        names.map((name) => entry(name, resolve(analysis, name) ?? "", isSetting(name))),
      ),
      h.h2([], ["From the platform"]),
      h.ul(
        [h.AriaLabel("Platform values")],
        Object.entries(platform).map(([name, { value }]) => entry(name, value, true)),
      ),
    ],
  );
};

export const view = defineView<Model, Message, { isDark: boolean }>((model, { isDark }, h) => {
  const theme = isDark ? "dark" : "light";
  const environment =
    model.editor.document.languageId === environmentLanguage
      ? analyze(model.editor.document.text)
      : undefined;
  const dirty =
    model.savedText !== model.editor.document.text ||
    model.savedSession !== model.editor.document.session;
  return h.div(
    [h.Class("code-demo"), h.DataAttribute("code-editor-demo", "true")],
    [
      h.div(
        [h.Class("code-demo__intro")],
        [
          h.p([h.Class("code-demo__eyebrow")], ["Code editor"]),
          h.h1([], ["A little room to write code."]),
          h.p(
            [],
            [
              "A native Foldkit editor with highlighting, search, suggestions, and live JSON and YAML validation against an Effect Schema. An environment file shows a host's language service. Inspect the editor state below, or load a larger document to explore visible-line rendering.",
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("code-demo__toolbar")],
        [
          Select.control(
            {
              ariaLabel: "Example language",
              value: model.editor.document.languageId,
              options: [
                { value: "json", label: "JSON configuration" },
                { value: "yaml", label: "YAML configuration" },
                { value: environmentLanguage, label: "Environment file" },
                { value: "typescript", label: "TypeScript" },
                { value: "text", label: "Plain text" },
              ],
              onChange: (languageId) => Message.LoadSample({ languageId }),
            },
            h,
          ),
          Button.view(
            {
              label: "Load 2,000 lines",
              variant: "outline",
              onClick: Message.LoadSample({ languageId: "large" }),
            },
            h,
          ),
          Button.view(
            {
              label: model.editor.options.lineWrapping ? "Unwrap lines" : "Wrap lines",
              variant: "outline",
              onClick: Message.ToggleWrapping(),
            },
            h,
          ),
          Button.view(
            {
              label:
                model.workspace.orientation === "Horizontal" ? "Stack documents" : "Side by side",
              variant: "outline",
              onClick: Message.ArrangeDocuments(),
            },
            h,
          ),
          h.div(
            [h.Class("code-demo__save")],
            [
              Badge.view(
                {
                  label: dirty ? "Unsaved changes" : "Snapshot saved",
                  tone: dirty ? "warning" : "success",
                  dot: true,
                },
                h,
              ),
              Button.view(
                { label: "Save snapshot", onClick: Message.Save(), isDisabled: !dirty },
                h,
              ),
            ],
          ),
        ],
      ),
      ...(["json", "yaml"].includes(model.editor.document.languageId)
        ? [
            h.p(
              [],
              [
                "Configuration schema: a nonempty name, development or production environment, boolean feature flags, and 0–10 retry attempts. Try an invalid value or remove a required field to see its validation error.",
              ],
            ),
          ]
        : []),
      ...(environment === undefined
        ? []
        : [
            h.p(
              [],
              [
                "The deploy host knows which settings it reads and which values the platform provides. Hover a name to see what it means or what it resolves to, press Ctrl+Space for settings, values, and ${references}, and choose a setting under the files to see where it is set and used.",
              ],
            ),
          ]),
      h.div(
        [h.Class("code-demo__workspace")],
        [
          Workspace.view(
            {
              model: model.navigator,
              toParentMessage: (message) => Message.Navigator({ message }),
              primary: {
                label: "Files",
                children: [
                  Tree.view(
                    {
                      model: model.fileTree,
                      nodes: model.files,
                      label: "Workspace files",
                      toParentMessage: (message) => Message.FileTree({ message }),
                    },
                    h,
                  ),
                  ...(environment === undefined ? [] : [settingsPanel(model, environment, h)]),
                ],
              },
              secondary: {
                label: "Documents",
                showHeader: false,
                scroll: "Contained",
                children: [
                  Workspace.view(
                    {
                      model: model.workspace,
                      toParentMessage: (message) => Message.Workspace({ message }),
                      secondary: {
                        label: "Working document",
                        showHeader: false,
                        children: [
                          CodeEditor.view(
                            {
                              model: {
                                ...model.editor,
                                options: { ...model.editor.options, theme },
                              },
                              label: "Working document",
                              toParentMessage: (message) => Message.Editor({ message }),
                              ...(environment === undefined
                                ? {}
                                : {
                                    meta: "Environment · checked by the deploy host",
                                    highlights:
                                      model.selectedSetting === null
                                        ? []
                                        : occurrences(environment, model.selectedSetting),
                                    hover: ({ offset, document }) => {
                                      const description = describe(analyze(document.text), offset);
                                      return description === undefined
                                        ? null
                                        : {
                                            from: description.from,
                                            to: description.to,
                                            content: hoverContent(description, h),
                                          };
                                    },
                                  }),
                            },
                            h,
                          ),
                        ],
                      },
                      primary: {
                        label: "Reference",
                        children: [
                          h.div(
                            [h.Class("code-demo__reference-actions")],
                            [
                              Button.view(
                                {
                                  label: model.reference.options.readOnly
                                    ? "Enable reference editing"
                                    : "Make reference read only",
                                  variant: "outline",
                                  onClick: Message.ToggleReadOnly(),
                                },
                                h,
                              ),
                            ],
                          ),
                          CodeEditor.view(
                            {
                              model: {
                                ...model.reference,
                                options: { ...model.reference.options, theme },
                              },
                              label: "TypeScript reference",
                              toParentMessage: (message) => Message.Reference({ message }),
                            },
                            h,
                          ),
                        ],
                      },
                    },
                    h,
                  ),
                ],
              },
            },
            h,
          ),
        ],
      ),
      h.p(
        [],
        [
          "JSON and YAML share one Effect Schema, with syntax and field errors shown as squiggles. Highlighting uses a small lexer and suggestions use document words. The environment file's highlighting, problems, hover, and suggestions come from one host language service instead. Multi-cursor editing and full international text layout remain future work.",
        ],
      ),
      h.p([h.Class("code-demo__announcement"), h.AriaLive("polite")], [model.announcement]),
    ],
  );
});
