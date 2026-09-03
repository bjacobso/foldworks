import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { CheckCircle2, GripVertical, Plus } from "@lucide/icons";
import {
  FormBuilder,
  dragItemFromId,
  dragItemId,
  dropLocationId,
  findActor,
  findField,
  findPage,
  findSection,
  type DropLocation,
  type ItemKind,
} from "@foldworks/form-builder";
import {
  Button as UiButton,
  Field as UiField,
  Icon as UiIcon,
  SegmentedControl as UiSegmentedControl,
  Select as UiSelect,
} from "@foldworks/ui";

import { Message } from "../workflow/message";
import type { Model } from "../workflow/model";
import { fieldKinds, fieldTypes } from "./field-types";
import { paletteFieldId, paletteKindFromId, selectedFormItem } from "./operations";
import type { FormField, FormPage, FormSelection } from "./model";
import { className, formStyles } from "./styles";

const toFormMessage = (message: FormBuilder.Message): Message =>
  Message.GotFormBuilderMessage({ message });

const draggedItem = (model: Model): Readonly<{
  kind: ItemKind;
  id: string;
  label: string;
}> | undefined => {
  if (!FormBuilder.isDragging(model.formBuilder)) return undefined;
  const rawId = Option.getOrUndefined(FormBuilder.maybeDraggedItemId(model.formBuilder));
  if (rawId === undefined) return undefined;
  const paletteKind = paletteKindFromId(rawId);
  if (paletteKind !== undefined) {
    return { kind: "Field", id: rawId, label: fieldTypes[paletteKind].palette.label };
  }
  const item = dragItemFromId(rawId);
  if (item === undefined) return undefined;
  const label = item.kind === "Section"
    ? findSection(model.formDocument, item.id)?.title
    : item.kind === "Page"
      ? findPage(model.formDocument, item.id)?.title
      : findField(model.formDocument, item.id)?.label;
  return { ...item, label: label ?? item.kind };
};

const isDragged = (model: Model, kind: ItemKind, id: string) =>
  draggedItem(model)?.kind === kind && draggedItem(model)?.id === id;

const isSelected = (model: Model, kind: ItemKind, id: string) =>
  Option.exists(model.selectedFormItem, (selection) =>
    selection.kind === kind && selection.id === id,
  );

const dropTarget = (
  model: Model,
  location: DropLocation,
  label: string,
  h: HtmlBuilder<Message>,
  receiver = false,
): Html => {
  const dragged = draggedItem(model);
  const acceptsDraggedItem = dragged === undefined || dragged.kind === location.kind;
  const id = dropLocationId(
    model.formDocument.id,
    location,
    receiver ? "outline" : undefined,
  );
  const active = acceptsDraggedItem && Option.exists(
    FormBuilder.maybeDropTarget(model.formBuilder),
    (target) => target.containerId === id,
  );
  return h.div(
    [
      h.Class(className(
        receiver ? formStyles.pageReceiver : formStyles.dropLine,
        dragged !== undefined && acceptsDraggedItem && !active && !receiver &&
          location.kind === "Field" && formStyles.dropLineAvailable,
        dragged !== undefined && acceptsDraggedItem && !active && receiver &&
          formStyles.pageReceiverAvailable,
        active && (receiver ? formStyles.pageReceiverActive : formStyles.dropLineActive),
      )),
      h.DataAttribute("form-drop-kind", location.kind.toLowerCase()),
      h.DataAttribute("form-drop-active", active ? "true" : "false"),
      ...(acceptsDraggedItem
        ? FormBuilder.droppable(id, label)
        : [h.AriaHidden(true)]),
    ],
    [],
  );
};

const outlineView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const dragged = draggedItem(model);
  return h.aside([h.Class(className(formStyles.outline)), h.AriaLabel("Form structure")], [
    h.div([h.Class(className(formStyles.panelHeader))], [
      h.p([h.Class(className(formStyles.panelTitle))], ["Form structure"]),
      h.button(
        [
          h.Type("button"),
          h.Class(className(formStyles.addIconButton)),
          h.AriaLabel("Add section"),
          h.OnClick(Message.ClickedAddSection()),
        ],
        [UiIcon.view({ icon: Plus, size: 14, strokeWidth: 2.25 }, h)],
      ),
    ]),
    ...model.formDocument.sections.flatMap((section, sectionIndex) => {
      const actor = findActor(model.formDocument, section.actorId);
      return [
        dropTarget(
          model,
          { kind: "Section", index: sectionIndex },
          `Move section before ${section.title}`,
          h,
        ),
        h.keyed("section")(
          section.id,
          [
            h.Class(className(
              formStyles.sectionCard,
              isDragged(model, "Section", section.id) && formStyles.draggingSource,
            )),
            h.Style({ viewTransitionName: `form-section-${section.id}` }),
            h.DataAttribute("form-section-id", section.id),
          ],
          [
            h.div([h.Class(className(formStyles.sectionHeader))], [
              h.span(
                [
                  h.Class(className(formStyles.dragHandle)),
                  h.Tabindex(0),
                  ...FormBuilder.draggable({
                    model: model.formBuilder,
                    toParentMessage: toFormMessage,
                    itemId: dragItemId("Section", section.id),
                    containerId: "form-sections",
                    index: sectionIndex,
                  }, h),
                ],
                [UiIcon.view({ icon: GripVertical, size: 14 }, h)],
              ),
              h.button(
                [
                  h.Type("button"),
                  h.Class(className(formStyles.outlineButton)),
                  h.OnClick(Message.SelectedFormItem({ kind: "Section", id: section.id })),
                ],
                [
                  h.span([h.Class(className(formStyles.outlineTitle))], [section.title]),
                  h.span([h.Class(className(formStyles.actorBadge))], [actor?.title ?? "Unassigned"]),
                ],
              ),
            ]),
            h.div([h.Class(className(formStyles.pageList))], [
              ...section.pages.flatMap((page, pageIndex) => [
                dropTarget(
                  model,
                  { kind: "Page", sectionId: section.id, index: pageIndex },
                  `Move page before ${page.title}`,
                  h,
                ),
                h.keyed("div")(
                  page.id,
                  [
                    h.Class(className(
                      formStyles.pageRow,
                      model.activeFormPageId === page.id && formStyles.pageRowActive,
                      isDragged(model, "Page", page.id) && formStyles.draggingSource,
                    )),
                    h.DataAttribute("form-page-id", page.id),
                    h.Style({ viewTransitionName: `form-page-outline-${page.id}` }),
                  ],
                  [
                    h.span(
                      [
                        h.Class(className(formStyles.dragHandle)),
                        h.Tabindex(0),
                        ...FormBuilder.draggable({
                          model: model.formBuilder,
                          toParentMessage: toFormMessage,
                          itemId: dragItemId("Page", page.id),
                          containerId: `form-pages:${section.id}`,
                          index: pageIndex,
                        }, h),
                      ],
                      [UiIcon.view({ icon: GripVertical, size: 14 }, h)],
                    ),
                    h.button(
                      [
                        h.Type("button"),
                        h.Class(className(formStyles.outlineButton)),
                        h.OnClick(Message.SelectedFormItem({ kind: "Page", id: page.id })),
                      ],
                      [h.span([h.Class(className(formStyles.outlineTitle))], [
                        `${page.title} · ${page.fields.length}`,
                      ])],
                    ),
                    dragged?.kind === "Field"
                      ? dropTarget(
                          model,
                          { kind: "Field", pageId: page.id, index: page.fields.length },
                          `Move field to ${page.title}`,
                          h,
                          true,
                        )
                      : h.empty,
                  ],
                ),
              ]),
              dropTarget(
                model,
                { kind: "Page", sectionId: section.id, index: section.pages.length },
                `Move page to the end of ${section.title}`,
                h,
              ),
              h.button(
                [
                  h.Type("button"),
                  h.Class(className(formStyles.addPageButton)),
                  h.OnClick(Message.ClickedAddPage({ sectionId: section.id })),
                ],
                [
                  UiIcon.view({ icon: Plus, size: 14, strokeWidth: 2.25 }, h),
                  "Add page",
                ],
              ),
            ]),
          ],
        ),
      ];
    }),
    dropTarget(
      model,
      { kind: "Section", index: model.formDocument.sections.length },
      "Move section to the end",
      h,
    ),
  ]);
};

const fieldEditorView = (
  model: Model,
  field: FormField,
  index: number,
  page: FormPage,
  h: HtmlBuilder<Message>,
): Html => {
  const definition = fieldTypes[field.type];
  const dragging = isDragged(model, "Field", field.id);
  return h.keyed("div")(
    field.id,
    [
      h.Class(className(
        formStyles.fieldCard,
        isSelected(model, "Field", field.id) && formStyles.fieldCardSelected,
        dragging && formStyles.draggingSource,
      )),
      h.Role("button"),
      h.Tabindex(0),
      h.DataAttribute("form-field-id", field.id),
      h.Style({ viewTransitionName: `form-field-${field.id}` }),
      h.OnClick(Message.SelectedFormItem({ kind: "Field", id: field.id })),
      ...FormBuilder.draggable({
        model: model.formBuilder,
        toParentMessage: toFormMessage,
        itemId: dragItemId("Field", field.id),
        containerId: `form-fields:${page.id}`,
        index,
      }, h),
    ],
    [
      h.div([h.Class(className(dragging && formStyles.draggingContent))], [
        h.div([h.Class(className(formStyles.fieldChrome))], [
          h.span([h.Class(className(formStyles.fieldType))], [definition.palette.label]),
          h.span([h.Class(className(formStyles.fieldHandle)), h.AriaHidden(true)], [
            UiIcon.view({ icon: GripVertical, size: 14 }, h),
          ]),
        ]),
        field.type === "checkbox"
          ? h.empty
          : h.label([h.Class(className(formStyles.fieldLabel))], [
              field.label,
              field.required
                ? h.span([h.Class(className(formStyles.required)), h.AriaHidden(true)], ["*"])
                : h.empty,
            ]),
        field.description.length > 0
          ? h.p([h.Class(className(formStyles.fieldDescription))], [field.description])
          : h.empty,
        definition.render({
          field,
          mode: "Editor",
          value: "",
          onInput: () => Message.SelectedFormItem({ kind: "Field", id: field.id }),
        }, h),
      ]),
    ],
  );
};

const canvasView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const page = findPage(model.formDocument, model.activeFormPageId);
  const located = page === undefined ? undefined : model.formDocument.sections.find((section) =>
    section.pages.some((candidate) => candidate.id === page.id),
  );
  const actor = located === undefined ? undefined : findActor(model.formDocument, located.actorId);
  return h.div([h.Class(className(formStyles.canvasViewport))], [
    page === undefined
      ? h.div([h.Class(className(formStyles.emptyPage))], ["Add or select a page to begin building."])
      : h.div([h.Class(className(formStyles.canvas)), h.DataAttribute("form-editor-canvas", "true")], [
          h.p([h.Class(className(formStyles.canvasEyebrow))], [
            `${actor?.title ?? "Participant"} · ${located?.title ?? "Section"}`,
          ]),
          h.h2([h.Class(className(formStyles.canvasTitle))], [page.title]),
          h.p([h.Class(className(formStyles.canvasDescription))], [
            page.description || "This page has no description yet.",
          ]),
          ...page.fields.flatMap((field, index) => [
            dropTarget(
              model,
              { kind: "Field", pageId: page.id, index },
              `Move field before ${field.label}`,
              h,
            ),
            fieldEditorView(model, field, index, page, h),
          ]),
          dropTarget(
            model,
            { kind: "Field", pageId: page.id, index: page.fields.length },
            "Move field to the end of the page",
            h,
          ),
          page.fields.length === 0
            ? h.div([h.Class(className(formStyles.emptyPage))], [
                "Drag a field here from the palette or click one to add it.",
              ])
            : h.empty,
        ]),
  ]);
};

const commonSettings = (
  selection: FormSelection,
  title: string,
  description: string,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.div([h.Class(className(formStyles.field))], [
    UiField.input(
      {
        id: "form-settings-title",
        label: selection.kind === "Field" ? "Label" : "Title",
        value: title,
        onInput: (value) => Message.ChangedFormItemTitle({ value }),
      },
      h,
    ),
  ]),
  h.div([h.Class(className(formStyles.field))], [
    UiField.textarea(
      {
        id: "form-settings-description",
        label: "Description",
        value: description,
        onInput: (value) => Message.ChangedFormItemDescription({ value }),
      },
      h,
    ),
  ]),
];

const settingsView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.aside([h.Class(className(formStyles.settings, formStyles.settingsHidden)), h.AriaLabel("Item settings")], [
    h.div([h.Class(className(formStyles.panelHeader))], [
      h.p([h.Class(className(formStyles.panelTitle))], ["Settings"]),
    ]),
    Option.match(model.selectedFormItem, {
      onNone: () => h.p([h.Class(className(formStyles.settingsEmpty))], [
        "Select a section, page, or field to edit its settings.",
      ]),
      onSome: (selection) => {
        const item = selectedFormItem(model.formDocument, selection);
        if (item === undefined) return h.empty;
        const title = "label" in item ? item.label : item.title;
        return h.div([], [
          ...commonSettings(selection, title, item.description, h),
          selection.kind === "Section"
            ? h.div([h.Class(className(formStyles.field))], [
                UiField.select(
                  {
                    id: "form-settings-actor",
                    label: "Assigned actor",
                    ...("actorId" in item ? { value: item.actorId } : {}),
                    onChange: (actorId) => Message.ChangedSectionActor({ actorId }),
                    options: model.formDocument.actors.map((actor) => ({
                      value: actor.id,
                      label: actor.title,
                    })),
                  },
                  h,
                ),
              ])
            : h.empty,
          selection.kind === "Field" && "required" in item && item.type !== "content"
            ? h.label([h.Class(className(formStyles.checkboxRow, formStyles.field))], [
                h.input([
                  h.Type("checkbox"),
                  h.Checked(item.required),
                  h.OnClick(Message.ChangedFieldRequired({ required: !item.required })),
                ]),
                "Required field",
              ])
            : h.empty,
          selection.kind === "Field" && "type" in item && item.type === "singleSelect"
            ? h.div([h.Class(className(formStyles.field))], [
                UiField.textarea(
                  {
                    id: "form-settings-options",
                    label: "Options · one per line",
                    value: item.options.join("\n"),
                    onInput: (value) => Message.ChangedFieldOptions({ value }),
                  },
                  h,
                ),
              ])
            : h.empty,
          selection.kind === "Field" && "type" in item && item.type === "content"
            ? h.div([h.Class(className(formStyles.field))], [
                UiField.textarea(
                  {
                    id: "form-settings-content",
                    label: "Markdown content",
                    value: item.content,
                    onInput: (value) => Message.ChangedFieldContent({ value }),
                  },
                  h,
                ),
              ])
            : h.empty,
          UiButton.view(
            {
              label: `Delete ${selection.kind.toLowerCase()}`,
              onClick: Message.ClickedDeleteFormItem(),
              variant: "danger",
              isFullWidth: true,
            },
            h,
          ),
        ]);
      },
    }),
  ]);

const editorView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div([h.Class(className(formStyles.workspace))], [
    outlineView(model, h),
    canvasView(model, h),
    settingsView(model, h),
  ]);

const answerValue = (model: Model, fieldId: string) =>
  model.formAnswers.find((answer) => answer.fieldId === fieldId)?.value ?? "";

const runnerFieldView = (
  model: Model,
  field: FormField,
  h: HtmlBuilder<Message>,
): Html => {
  const viewed = model.contentViews.some((view) => view.fieldId === field.id);
  return h.keyed("div")(
    field.id,
    [h.Class(className(formStyles.runnerField)), h.DataAttribute("runner-field-id", field.id)],
    [
      field.type === "checkbox"
        ? h.empty
        : h.label([h.Class(className(formStyles.fieldLabel))], [
            field.label,
            field.required
              ? h.span([h.Class(className(formStyles.required)), h.AriaHidden(true)], ["*"])
              : h.empty,
          ]),
      field.description.length > 0
        ? h.p([h.Class(className(formStyles.fieldDescription))], [field.description])
        : h.empty,
      fieldTypes[field.type].render({
        field,
        mode: "Runner",
        value: answerValue(model, field.id),
        onInput: (value) => Message.ChangedFormAnswer({ fieldId: field.id, value }),
      }, h),
      field.type === "content" && viewed
        ? h.p([h.Class(className(formStyles.viewedBadge))], [
            UiIcon.view({ icon: CheckCircle2, size: 12, strokeWidth: 2.25 }, h),
            "View recorded for this participant",
          ])
        : h.empty,
    ],
  );
};

const runnerView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const sections = model.formDocument.sections.filter((section) =>
    model.previewActorId === "__journey__" || section.actorId === model.previewActorId,
  );
  const pages = sections.flatMap((section) => section.pages);
  const pageIndex = Math.max(0, pages.findIndex((page) => page.id === model.activeFormPageId));
  const page = pages[pageIndex];
  const section = page === undefined ? undefined : sections.find((candidate) =>
    candidate.pages.some((candidatePage) => candidatePage.id === page.id),
  );
  const actor = section === undefined ? undefined : findActor(model.formDocument, section.actorId);
  const progress = pages.length === 0 ? 0 : ((pageIndex + 1) / pages.length) * 100;
  return h.div([h.Class(className(formStyles.runnerViewport))], [
    h.div([h.Class(className(formStyles.runner)), h.DataAttribute("form-runner", "true")], [
      h.div([h.Class(className(formStyles.runnerTop))], [
        h.div([], [
          h.p([h.Class(className(formStyles.canvasEyebrow))], [actor?.title ?? "Full journey"]),
          h.span([h.Class(className(formStyles.progressText))], [
            pages.length === 0 ? "No pages" : `Step ${pageIndex + 1} of ${pages.length}`,
          ]),
        ]),
        UiSelect.control(
          {
            value: model.previewActorId,
            ariaLabel: "Preview actor",
            onChange: (actorId) => Message.SelectedPreviewActor({ actorId }),
            options: [
              { value: "__journey__", label: "Full journey" },
              ...model.formDocument.actors.map((candidate) => ({
                value: candidate.id,
                label: candidate.title,
              })),
            ],
          },
          h,
        ),
      ]),
      h.div([h.Class(className(formStyles.progressTrack)), h.AriaHidden(true)], [
        h.div([h.Class(className(formStyles.progressFill)), h.Style({ width: `${progress}%` })]),
      ]),
      page === undefined
        ? h.div([h.Class(className(formStyles.emptyPage))], ["This actor has no assigned pages."])
        : h.form([h.Class(className(formStyles.runnerCard)), h.OnSubmit(Message.ClickedPreviewNext())], [
            h.p([h.Class(className(formStyles.canvasEyebrow))], [section?.title ?? "Section"]),
            h.h2([h.Class(className(formStyles.canvasTitle))], [page.title]),
            h.p([h.Class(className(formStyles.canvasDescription))], [page.description]),
            ...page.fields.map((field) => runnerFieldView(model, field, h)),
          ]),
      h.div([h.Class(className(formStyles.runnerNav))], [
        UiButton.view(
          {
            label: "Back",
            variant: "outline",
            isDisabled: pageIndex === 0,
            onClick: Message.ClickedPreviewPrevious(),
          },
          h,
        ),
        UiButton.view(
          {
            label: pageIndex >= pages.length - 1 ? "Complete" : "Continue",
            isDisabled: pageIndex >= pages.length - 1,
            onClick: Message.ClickedPreviewNext(),
          },
          h,
        ),
      ]),
    ]),
  ]);
};

export const formBuilderView = (model: Model, h: HtmlBuilder<Message>): Html =>
  model.formMode === "Editor" ? editorView(model, h) : runnerView(model, h);

export const formBuilderToolbarActions = (
  model: Model,
  h: HtmlBuilder<Message>,
): Html =>
  h.div([h.Class(className(formStyles.modeBar))], [
    UiSelect.control(
      {
        value: model.formExampleId,
        ariaLabel: "Example form",
        onChange: (exampleId) => Message.SelectedFormExample({
          exampleId: exampleId as "Simple" | "Handoff" | "Complex",
        }),
        options: [
          { value: "Simple", label: "Simple form" },
          { value: "Handoff", label: "Actor handoff" },
          { value: "Complex", label: "Complex journey" },
        ],
      },
      h,
    ),
    UiSegmentedControl.view(
      {
        value: model.formMode,
        ariaLabel: "Form mode",
        options: [
          { value: "Editor", label: "Editor" },
          { value: "Preview", label: "Preview" },
        ],
        onChange: (mode) => Message.SelectedFormMode({ mode }),
      },
      h,
    ),
  ]);

export const formPaletteView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div([], [
    h.p([h.Class(className(formStyles.panelTitle))], ["Add a field"]),
    ...fieldKinds.map((kind, index) => {
      const definition = fieldTypes[kind];
      const itemId = paletteFieldId(kind);
      return h.keyed("div")(
        itemId,
        [h.Class(className(formStyles.paletteRow))],
        [
          h.div(
            [
              h.Class(className(formStyles.paletteButton)),
              h.Tabindex(0),
              h.DataAttribute("form-palette-drag", kind),
              ...FormBuilder.draggable({
                model: model.formBuilder,
                toParentMessage: toFormMessage,
                itemId,
                containerId: "form-field-palette",
                index,
              }, h),
            ],
            [
              UiIcon.view({ icon: definition.icon, size: 15, strokeWidth: 2.1 }, h),
              definition.palette.label,
            ],
          ),
          h.button(
            [
              h.Type("button"),
              h.Class(className(formStyles.paletteAdd)),
              h.DataAttribute("form-palette-field", kind),
              h.AriaLabel(`Add ${definition.palette.label}`),
              h.OnClick(Message.ClickedAddField({ pageId: model.activeFormPageId, fieldType: kind })),
            ],
            [UiIcon.view({ icon: Plus, size: 14, strokeWidth: 2.25 }, h)],
          ),
        ],
      );
    }),
  ]);

export const formGhostView = (model: Model, h: HtmlBuilder<Message>): Html =>
  Option.match(FormBuilder.ghostStyle(model.formBuilder), {
    onNone: () => h.empty,
    onSome: (style) => {
      const dragged = draggedItem(model);
      return dragged === undefined
        ? h.empty
        : h.div(
            [h.Class(className(formStyles.ghost)), h.Style(style), h.AriaHidden(true)],
            [
              UiIcon.view({ icon: GripVertical, size: 14 }, h),
              dragged.label,
            ],
          );
    },
  });
