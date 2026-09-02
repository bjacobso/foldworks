import * as Markdown from "@foldkit/markdown";
import { parseMarkdown } from "@foldkit/markdown/vite";

import {
  defineFieldTypes,
  type FieldTypeDefinition,
} from "@foldworks/form-builder";

import { Message } from "../workflow/message";
import type { FieldKind, FormField } from "./model";
import { className, formStyles } from "./styles";

type MarkdownPreview =
  | Readonly<{ _tag: "Ready"; document: Markdown.MarkdownDocument }>
  | Readonly<{ _tag: "Invalid"; message: string }>;

const markdownPreviewCache = new Map<string, MarkdownPreview>();
const markdownPreviewCacheLimit = 64;

const markdownPreview = (source: string): MarkdownPreview => {
  const cached = markdownPreviewCache.get(source);
  if (cached !== undefined) return cached;

  let preview: MarkdownPreview;
  try {
    preview = { _tag: "Ready", document: parseMarkdown(source) };
  } catch (error) {
    preview = {
      _tag: "Invalid",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (markdownPreviewCache.size >= markdownPreviewCacheLimit) {
    const oldestSource = markdownPreviewCache.keys().next().value;
    if (oldestSource !== undefined) markdownPreviewCache.delete(oldestSource);
  }
  markdownPreviewCache.set(source, preview);
  return preview;
};

const makeField = (
  id: string,
  type: FieldKind,
  label: string,
): FormField => ({
  id,
  type,
  label,
  description: "",
  required: false,
  options: type === "singleSelect" ? ["Option one", "Option two"] : [],
  content: type === "content"
    ? "# Important information\n\nAdd helpful content for this participant to review."
    : "",
});

const inputAttributes = (mode: "Editor" | "Runner") =>
  mode === "Editor" ? { disabled: true } : { disabled: false };

const definitions = {
  shortText: {
    palette: { label: "Short text", description: "A single-line answer", symbol: "T" },
    create: (id) => makeField(id, "shortText", "Short answer"),
    render: ({ field, mode, value, onInput }, h) =>
      h.input([
        h.Class(className(formStyles.previewInput)),
        h.Type("text"),
        h.Value(value),
        h.Placeholder("Enter an answer"),
        h.Disabled(inputAttributes(mode).disabled),
        h.OnInput(onInput),
      ]),
  },
  longText: {
    palette: { label: "Long text", description: "A multi-line answer", symbol: "¶" },
    create: (id) => makeField(id, "longText", "Long answer"),
    render: ({ mode, value, onInput }, h) =>
      h.textarea(
        [
          h.Class(className(formStyles.previewInput, formStyles.previewTextarea)),
          h.Disabled(inputAttributes(mode).disabled),
          h.OnInput(onInput),
          h.Placeholder("Enter a detailed answer"),
        ],
        [value],
      ),
  },
  singleSelect: {
    palette: { label: "Single select", description: "Choose one option", symbol: "◉" },
    create: (id) => makeField(id, "singleSelect", "Choose an option"),
    render: ({ field, mode, value, onInput }, h) =>
      h.select(
        [
          h.Class(className(formStyles.previewInput)),
          h.Disabled(inputAttributes(mode).disabled),
          h.OnChange(onInput),
        ],
        [
          h.option([h.Value(""), h.Selected(value === "")], ["Select an option"]),
          ...field.options.map((option) =>
            h.option([h.Value(option), h.Selected(value === option)], [option]),
          ),
        ],
      ),
  },
  checkbox: {
    palette: { label: "Checkbox", description: "An acknowledgment", symbol: "✓" },
    create: (id) => makeField(id, "checkbox", "I agree"),
    render: ({ field, mode, value, onInput }, h) =>
      h.label([h.Class(className(formStyles.checkboxRow))], [
        h.input([
          h.Type("checkbox"),
          h.Checked(value === "true"),
          h.Disabled(inputAttributes(mode).disabled),
          h.OnClick(onInput(value === "true" ? "false" : "true")),
        ]),
        h.span([], [field.label]),
      ]),
  },
  date: {
    palette: { label: "Date", description: "A calendar date", symbol: "□" },
    create: (id) => makeField(id, "date", "Date"),
    render: ({ mode, value, onInput }, h) =>
      h.input([
        h.Class(className(formStyles.previewInput)),
        h.Type("date"),
        h.Value(value),
        h.Disabled(inputAttributes(mode).disabled),
        h.OnInput(onInput),
      ]),
  },
  content: {
    palette: { label: "Content", description: "Tracked Markdown content", symbol: "≡" },
    create: (id) => makeField(id, "content", "Information"),
    render: ({ field }, h) => {
      const preview = markdownPreview(field.content);
      if (preview._tag === "Invalid") {
        return h.div([h.Class(className(formStyles.contentBlock))], [
          h.p([h.Class(className(formStyles.markdownError))], [
            `Markdown preview unavailable: ${preview.message}`,
          ]),
          h.pre([h.Class(className(formStyles.markdownSource))], [field.content]),
        ]);
      }

      return h.div([h.Class(className(formStyles.contentBlock))], [
        Markdown.view(preview.document, {
          views: {
            Heading: ({ level }, content) => {
              const attributes = [h.Class(className(formStyles.contentHeading))];
              switch (level) {
                case 1: return h.h1(attributes, content);
                case 2: return h.h2(attributes, content);
                case 3: return h.h3(attributes, content);
                case 4: return h.h4(attributes, content);
                case 5: return h.h5(attributes, content);
                case 6: return h.h6(attributes, content);
              }
            },
            Paragraph: (_paragraph, content) =>
              h.p([h.Class(className(formStyles.contentParagraph))], content),
            InlineCode: ({ value }) =>
              h.code([h.Class(className(formStyles.markdownInlineCode))], [value]),
            CodeBlock: ({ value }) =>
              h.pre([h.Class(className(formStyles.markdownCodeBlock))], [
                h.code([], [value]),
              ]),
          },
        }),
      ]);
    },
  },
} satisfies Record<FieldKind, FieldTypeDefinition<FormField, Message>>;

export const fieldTypes = defineFieldTypes(definitions);

export const fieldKinds = Object.keys(fieldTypes) as ReadonlyArray<FieldKind>;

export const isFieldKind = (value: string): value is FieldKind => value in fieldTypes;
