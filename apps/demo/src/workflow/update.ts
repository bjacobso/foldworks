import { Effect, Match as M, Option, Schema as S } from "effect";
import { Command, Update } from "foldkit";
import { UrlRequest, load, pushUrl } from "foldkit/navigation";
import { evo } from "foldkit/struct";
import { toString as urlToString } from "foldkit/url";

import { Dialog } from "@foldkit/ui";
import { DataGrid } from "@foldworks/data-grid";
import {
  FormBuilder,
  deleteField,
  deletePage,
  deleteSection,
  dragItemFromId,
  dropLocationFromId,
  findField,
  findPage,
  findSection,
  insertField,
  insertPage,
  insertSection,
  locateField,
  moveItem,
  updateField,
  updatePage,
  updateSection,
} from "@foldworks/form-builder";
import { Workflow } from "@foldworks/workflow";

import { createField, paletteKindFromId } from "../form-builder/operations";
import {
  exampleForms,
  type FormDocument,
  type FormPage,
} from "../form-builder/model";

import {
  canMoveNode,
  deleteNode,
  dropLocationFromTarget,
  findNode,
  insertNewNode,
  isNodeKind,
  isNodeSize,
  kindFromPaletteItem,
  moveNode,
  updateNode,
} from "./graph";
import { Message } from "./message";
import { initialDocument, initialModel, type Model } from "./model";
import {
  type AppRoute,
  formBuilderPath,
  formStateFromRoute,
  urlToAppRoute,
} from "./route";

type UpdateReturn = Update.Return<Model, Message>;

const NavigateInternal = Command.define("NavigateInternal", {
  args: { url: S.String },
  messages: [Message.CompletedNavigateInternal],
  execute: ({ url }) =>
    pushUrl(url).pipe(Effect.as(Message.CompletedNavigateInternal())),
});

const LoadExternal = Command.define("LoadExternal", {
  args: { href: S.String },
  messages: [Message.CompletedLoadExternal],
  execute: ({ href }) =>
    load(href).pipe(Effect.as(Message.CompletedLoadExternal())),
});

const foldInspectorOutMessage = M.type<Dialog.OutMessage>().pipe(
  M.withReturnType<Update.Step<Model, Message>>(),
  M.tagsExhaustive({
    Opened: () => (model) => ({ model }),
    Closed: () => (model) => ({
      model: evo(model, { selectedNodeId: () => Option.none() }),
    }),
  }),
);

const readInspector = (model: Model) => Option.some(model.inspector);
const writeInspector = (model: Model, inspector: Dialog.Model): Model =>
  evo(model, { inspector: () => inspector });
const toInspectorMessage = (message: Dialog.Message): Message =>
  Message.GotInspectorMessage({ message });

const foldInspector = Update.foldChild({
  update: Dialog.update,
  read: readInspector,
  write: writeInspector,
  toParentMessage: toInspectorMessage,
  foldOutMessage: foldInspectorOutMessage,
});

const foldInspectorOpen = Update.foldChildStep({
  update: Dialog.open,
  read: readInspector,
  write: writeInspector,
  toParentMessage: toInspectorMessage,
  foldOutMessage: foldInspectorOutMessage,
});

const foldInspectorClose = Update.foldChildStep({
  update: Dialog.close,
  read: readInspector,
  write: writeInspector,
  toParentMessage: toInspectorMessage,
  foldOutMessage: foldInspectorOutMessage,
});

const commitDrop = (
  previousModel: Model,
  outMessage: Workflow.OutMessage,
): Update.Step<Model, Message> =>
  (model) =>
    Workflow.OutMessage.match<UpdateReturn>(outMessage, {
      Cancelled: () => ({
        model: evo(model, {
          announcement: () => "Drag cancelled. The workflow was not changed.",
        }),
      }),
      Reordered: ({ itemId, toContainerId }) => {
        const location = dropLocationFromTarget(toContainerId);
        if (location === undefined) {
          return {
            model: evo(model, {
              announcement: () => "Choose a highlighted insertion point.",
            }),
          };
        }

        const paletteKind = kindFromPaletteItem(itemId);
        if (paletteKind !== undefined) {
          const inserted = insertNewNode(
            model.document,
            location,
            paletteKind,
            model.nextId,
          );
          if (inserted === undefined) return { model };
          return {
            model: evo(model, {
              document: () => inserted.document,
              nextId: (value) => value + 1,
              revision: (value) => value + 1,
              announcement: () => `${inserted.node.data.title} added to the workflow.`,
            }),
          };
        }

        const moved = moveNode(model.document, itemId, location);
        if (moved === undefined) {
          const node = findNode(previousModel.document, itemId);
          return {
            model: evo(model, {
              announcement: () =>
                node === undefined
                  ? "That node could not be moved."
                  : `${node.data.title} cannot be moved to that location.`,
            }),
          };
        }

        const movedNode = findNode(model.document, itemId);
        return {
          model: evo(model, {
            document: () => moved,
            revision: (value) => value + 1,
            announcement: () => `${movedNode?.data.title ?? "Node"} moved.`,
          }),
        };
      },
    });

const foldWorkflow = (previousModel: Model) =>
  Update.foldChild({
    update: Workflow.update,
    read: (model: Model) => Option.some(model.workflow),
    write: (model, workflow) => evo(model, { workflow: () => workflow }),
    toParentMessage: (message) => Message.GotWorkflowMessage({ message }),
    foldOutMessage: (outMessage) => commitDrop(previousModel, outMessage),
  });

const previewPages = (model: Model): ReadonlyArray<FormPage> =>
  model.formDocument.sections
    .filter((section) =>
      model.previewActorId === "__journey__" || section.actorId === model.previewActorId,
    )
    .flatMap((section) => section.pages);

const markPageContentViewed = (model: Model, pageId: string): Model => {
  const page = findPage(model.formDocument, pageId);
  const section = model.formDocument.sections.find((candidate) =>
    candidate.pages.some((candidatePage) => candidatePage.id === pageId),
  );
  if (page === undefined || section === undefined) return model;
  const viewedIds = new Set(model.contentViews.map((view) => view.fieldId));
  const additions = page.fields
    .filter((field) => field.type === "content" && !viewedIds.has(field.id))
    .map((field) => ({
      actorId: section.actorId,
      sectionId: section.id,
      pageId,
      fieldId: field.id,
      viewedAt: new Date().toISOString(),
    }));
  return additions.length === 0
    ? model
    : evo(model, { contentViews: (views) => [...views, ...additions] });
};

const loadFormExample = (model: Model, exampleId: Model["formExampleId"]): Model => {
  const document = exampleForms[exampleId];
  const firstPage = document.sections[0]?.pages[0];
  const firstActor = document.actors[0];
  return evo(model, {
    formExampleId: () => exampleId,
    formDocument: () => document,
    formBuilder: () => FormBuilder.init({
      id: "form-builder-drag-and-drop",
      activationThreshold: 5,
    }),
    selectedFormItem: () => Option.none(),
    activeFormPageId: () => firstPage?.id ?? "",
    previewActorId: () => firstActor?.id ?? "__journey__",
    formAnswers: () => [],
    contentViews: () => [],
    nextFormId: () => 1,
    revision: (value) => value + 1,
    announcement: () => `${document.title} example loaded.`,
  });
};

const setFormMode = (model: Model, mode: Model["formMode"]): Model => {
  const pages = previewPages(model);
  const activePageId = pages.some((page) => page.id === model.activeFormPageId)
    ? model.activeFormPageId
    : pages[0]?.id ?? "";
  const next = evo(model, {
    formMode: () => mode,
    activeFormPageId: () => activePageId,
    revision: (value) => value + 1,
  });
  return mode === "Preview" ? markPageContentViewed(next, activePageId) : next;
};

const applyRoute = (model: Model, route: AppRoute): Model => {
  let next = evo(model, { route: () => route });
  if (route._tag !== "FormBuilder") return next;

  const { exampleId, mode } = formStateFromRoute(route);
  if (next.formExampleId !== exampleId) next = loadFormExample(next, exampleId);
  if (next.formMode !== mode) next = setFormMode(next, mode);
  return next;
};

const commitFormDrop = (
  outMessage: FormBuilder.OutMessage,
): Update.Step<Model, Message> =>
  (model) =>
    FormBuilder.OutMessage.match<UpdateReturn>(outMessage, {
      Cancelled: () => ({ model }),
      Reordered: ({ itemId, toContainerId }) => {
        const location = dropLocationFromId(toContainerId);
        if (location === undefined) return { model };
        const paletteKind = paletteKindFromId(itemId);
        if (paletteKind !== undefined) {
          if (location.kind !== "Field") return { model };
          const field = createField(paletteKind, model.nextFormId);
          const document = insertField(model.formDocument, location, field);
          if (document === undefined) return { model };
          return {
            model: evo(model, {
              formDocument: () => document,
              selectedFormItem: () => Option.some({ kind: "Field", id: field.id }),
              activeFormPageId: () => location.pageId,
              nextFormId: (value) => value + 1,
              revision: (value) => value + 1,
              announcement: () => `${field.label} added.`,
            }),
          };
        }
        const item = dragItemFromId(itemId);
        if (item === undefined || item.kind !== location.kind) return { model };
        const document = moveItem(model.formDocument, item.kind, item.id, location);
        return document === undefined
          ? { model }
          : {
              model: evo(model, {
                formDocument: () => document,
                revision: (value) => value + 1,
                announcement: () => `${item.kind} moved.`,
              }),
            };
      },
    });

const foldFormBuilder = Update.foldChild({
    update: FormBuilder.update,
    read: (model: Model) => Option.some(model.formBuilder),
    write: (model, formBuilder) => evo(model, { formBuilder: () => formBuilder }),
    toParentMessage: (message) => Message.GotFormBuilderMessage({ message }),
    foldOutMessage: commitFormDrop,
  });

const updateSelectedNode = (
  model: Model,
  update: Parameters<typeof updateNode>[2],
  shouldRebalance = false,
): UpdateReturn =>
  Option.match(model.selectedNodeId, {
    onNone: () => ({ model }),
    onSome: (nodeId) => ({
      model: evo(model, {
        document: (document) => updateNode(document, nodeId, update),
        revision: (value) => (shouldRebalance ? value + 1 : value),
      }),
    }),
  });

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),

    ClickedLink: ({ request }) =>
      UrlRequest.match<UpdateReturn>(request, {
        Internal: ({ url }) => ({
          model,
          commands: [NavigateInternal({ url: urlToString(url) })],
        }),
        External: ({ href }) => ({
          model,
          commands: [LoadExternal({ href })],
        }),
      }),

    ChangedUrl: ({ url }) => ({
      model: applyRoute(model, urlToAppRoute(url)),
    }),

    GotDataGridMessage: ({ message: dataGridMessage }) => {
      const result = DataGrid.update(model.dataGrid, dataGridMessage);
      return {
        model: evo(model, { dataGrid: () => result.model }),
      };
    },

    GotFormBuilderMessage: ({ message: formBuilderMessage }) =>
      foldFormBuilder(model, formBuilderMessage),

    SelectedFormExample: ({ exampleId }) => ({
      model,
      commands: [NavigateInternal({
        url: formBuilderPath(exampleId, model.formMode),
      })],
    }),

    SelectedFormMode: ({ mode }) => ({
      model,
      commands: [NavigateInternal({
        url: formBuilderPath(model.formExampleId, mode),
      })],
    }),

    SelectedFormItem: ({ kind, id }) => ({
      model: evo(model, {
        formBuilder: () => FormBuilder.init({
          id: "form-builder-drag-and-drop",
          activationThreshold: 5,
        }),
        selectedFormItem: () => Option.some({ kind, id }),
        activeFormPageId: (current) =>
          kind === "Page"
            ? id
            : kind === "Field"
              ? locateField(model.formDocument, id)?.page.id ?? current
              : current,
      }),
    }),

    SelectedFormPage: ({ pageId }) => ({
      model: evo(model, { activeFormPageId: () => pageId }),
    }),

    SelectedPreviewActor: ({ actorId }) => {
      const pages = model.formDocument.sections
        .filter((section) => actorId === "__journey__" || section.actorId === actorId)
        .flatMap((section) => section.pages);
      const pageId = pages[0]?.id ?? "";
      return {
        model: markPageContentViewed(
          evo(model, {
            previewActorId: () => actorId,
            activeFormPageId: () => pageId,
          }),
          pageId,
        ),
      };
    },

    ClickedAddSection: () => {
      const actor = model.formDocument.actors[0];
      if (actor === undefined) return { model };
      const id = `form-section-${model.nextFormId}`;
      const document = insertSection(
        model.formDocument,
        { kind: "Section", index: model.formDocument.sections.length },
        { id, actorId: actor.id, title: "New section", description: "", pages: [] },
      );
      return document === undefined ? { model } : {
        model: evo(model, {
          formDocument: () => document,
          selectedFormItem: () => Option.some({ kind: "Section", id }),
          nextFormId: (value) => value + 1,
          revision: (value) => value + 1,
        }),
      };
    },

    ClickedAddPage: ({ sectionId }) => {
      const section = findSection(model.formDocument, sectionId);
      if (section === undefined) return { model };
      const id = `form-page-${model.nextFormId}`;
      const document = insertPage(model.formDocument, {
        kind: "Page",
        sectionId,
        index: section.pages.length,
      }, { id, title: "Untitled page", description: "", fields: [] });
      return document === undefined ? { model } : {
        model: evo(model, {
          formDocument: () => document,
          selectedFormItem: () => Option.some({ kind: "Page", id }),
          activeFormPageId: () => id,
          nextFormId: (value) => value + 1,
          revision: (value) => value + 1,
        }),
      };
    },

    ClickedAddField: ({ pageId, fieldType }) => {
      const page = findPage(model.formDocument, pageId);
      const kind = paletteKindFromId(`form-palette:${fieldType}`);
      if (page === undefined || kind === undefined) return { model };
      const field = createField(kind, model.nextFormId);
      const document = insertField(model.formDocument, {
        kind: "Field",
        pageId,
        index: page.fields.length,
      }, field);
      return document === undefined ? { model } : {
        model: evo(model, {
          formDocument: () => document,
          formBuilder: () => FormBuilder.init({
            id: "form-builder-drag-and-drop",
            activationThreshold: 5,
          }),
          selectedFormItem: () => Option.some({ kind: "Field", id: field.id }),
          activeFormPageId: () => pageId,
          nextFormId: (value) => value + 1,
          revision: (value) => value + 1,
        }),
      };
    },

    ChangedFormItemTitle: ({ value }) => Option.match(model.selectedFormItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: evo(model, {
          formDocument: (document) =>
            selection.kind === "Section"
              ? updateSection(document, selection.id, (section) => ({ ...section, title: value }))
              : selection.kind === "Page"
                ? updatePage(document, selection.id, (page) => ({ ...page, title: value }))
                : updateField(document, selection.id, (field) => ({ ...field, label: value })),
        }),
      }),
    }),

    ChangedFormItemDescription: ({ value }) => Option.match(model.selectedFormItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: evo(model, {
          formDocument: (document) =>
            selection.kind === "Section"
              ? updateSection(document, selection.id, (section) => ({ ...section, description: value }))
              : selection.kind === "Page"
                ? updatePage(document, selection.id, (page) => ({ ...page, description: value }))
                : updateField(document, selection.id, (field) => ({ ...field, description: value })),
        }),
      }),
    }),

    ChangedSectionActor: ({ actorId }) => Option.match(model.selectedFormItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: selection.kind !== "Section" ? model : evo(model, {
          formDocument: (document) => updateSection(document, selection.id, (section) => ({
            ...section,
            actorId,
          })),
        }),
      }),
    }),

    ChangedFieldRequired: ({ required }) => Option.match(model.selectedFormItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: selection.kind !== "Field" ? model : evo(model, {
          formDocument: (document) => updateField(document, selection.id, (field) => ({
            ...field,
            required,
          })),
        }),
      }),
    }),

    ChangedFieldContent: ({ value }) => Option.match(model.selectedFormItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: selection.kind !== "Field" ? model : evo(model, {
          formDocument: (document) => updateField(document, selection.id, (field) => ({
            ...field,
            content: value,
          })),
        }),
      }),
    }),

    ChangedFieldOptions: ({ value }) => Option.match(model.selectedFormItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: selection.kind !== "Field" ? model : evo(model, {
          formDocument: (document) => updateField(document, selection.id, (field) => ({
            ...field,
            options: value.split("\n").map((option) => option.trim()).filter(Boolean),
          })),
        }),
      }),
    }),

    ClickedDeleteFormItem: () => Option.match(model.selectedFormItem, {
      onNone: () => ({ model }),
      onSome: (selection) => {
        const document: FormDocument | undefined = selection.kind === "Section"
          ? deleteSection(model.formDocument, selection.id)
          : selection.kind === "Page"
            ? deletePage(model.formDocument, selection.id)
            : deleteField(model.formDocument, selection.id);
        if (document === undefined) return { model };
        return {
          model: evo(model, {
            formDocument: () => document,
            selectedFormItem: () => Option.none(),
            activeFormPageId: (current) =>
              findPage(document, current) === undefined
                ? document.sections[0]?.pages[0]?.id ?? ""
                : current,
            revision: (value) => value + 1,
          }),
        };
      },
    }),

    ChangedFormAnswer: ({ fieldId, value }) => ({
      model: evo(model, {
        formAnswers: (answers) => answers.some((answer) => answer.fieldId === fieldId)
          ? answers.map((answer) => answer.fieldId === fieldId ? { ...answer, value } : answer)
          : [...answers, { fieldId, value }],
      }),
    }),

    ToggledFormAnswer: ({ fieldId }) => {
      const current = model.formAnswers.find((answer) => answer.fieldId === fieldId)?.value;
      const value = current === "true" ? "false" : "true";
      return {
        model: evo(model, {
          formAnswers: (answers) => answers.some((answer) => answer.fieldId === fieldId)
            ? answers.map((answer) => answer.fieldId === fieldId ? { ...answer, value } : answer)
            : [...answers, { fieldId, value }],
        }),
      };
    },

    ClickedPreviewPrevious: () => {
      const pages = previewPages(model);
      const index = pages.findIndex((page) => page.id === model.activeFormPageId);
      const pageId = pages[Math.max(0, index - 1)]?.id ?? model.activeFormPageId;
      return { model: evo(model, { activeFormPageId: () => pageId }) };
    },

    ClickedPreviewNext: () => {
      const pages = previewPages(model);
      const index = pages.findIndex((page) => page.id === model.activeFormPageId);
      const pageId = pages[Math.min(pages.length - 1, index + 1)]?.id ?? model.activeFormPageId;
      return {
        model: markPageContentViewed(
          evo(model, { activeFormPageId: () => pageId }),
          pageId,
        ),
      };
    },

    GotWorkflowMessage: ({ message: workflowMessage }) =>
      foldWorkflow(model)(model, workflowMessage),

    GotInspectorMessage: ({ message: inspectorMessage }) =>
      foldInspector(model, inspectorMessage),

    ClickedNode: ({ nodeId }) => {
      const selected = evo(model, {
        selectedNodeId: () => Option.some(nodeId),
      });
      return foldInspectorOpen(selected);
    },

    ClickedQuickAdd: ({ locationId }) => {
      const location = dropLocationFromTarget(locationId);
      if (location === undefined) return { model };
      const inserted = insertNewNode(
        model.document,
        location,
        "action",
        model.nextId,
      );
      if (inserted === undefined) return { model };
      const next = evo(model, {
        document: () => inserted.document,
        selectedNodeId: () => Option.some(inserted.node.id),
        nextId: (value) => value + 1,
        revision: (value) => value + 1,
        announcement: () => `${inserted.node.data.title} added.`,
      });
      return foldInspectorOpen(next);
    },

    ChangedSelectedNodeTitle: ({ value }) =>
      updateSelectedNode(model, (node) => ({
        ...node,
        data: { ...node.data, title: value },
      })),

    ChangedSelectedNodeDescription: ({ value }) =>
      updateSelectedNode(model, (node) => ({
        ...node,
        data: { ...node.data, description: value },
      })),

    ChangedSelectedNodeType: ({ value }) =>
      isNodeKind(value)
        ? updateSelectedNode(
            model,
            (node) => ({ ...node, type: value }),
            true,
          )
        : { model },

    ChangedSelectedNodeSize: ({ value }) =>
      isNodeSize(value)
        ? updateSelectedNode(
            model,
            (node) => ({
              ...node,
              data: { ...node.data, size: value },
            }),
            true,
          )
        : { model },

    ClickedDeleteSelectedNode: () =>
      Option.match(model.selectedNodeId, {
        onNone: () => ({ model }),
        onSome: (nodeId) => {
          const selected = findNode(model.document, nodeId);
          const document = deleteNode(model.document, nodeId);
          if (document === undefined) {
            return {
              model: evo(model, {
                announcement: () => "This structural node cannot be deleted.",
              }),
            };
          }
          const next = evo(model, {
            document: () => document,
            revision: (value) => value + 1,
            announcement: () => `${selected?.data.title ?? "Node"} deleted.`,
          });
          return foldInspectorClose(next);
        },
      }),

    ClickedResetWorkflow: () => {
      const reset = evo(model, {
        document: () => initialDocument,
        nextId: () => initialModel.nextId,
        revision: (value) => value + 1,
        announcement: () => "Workflow reset to the example.",
      });
      return model.inspector.isOpen ? foldInspectorClose(reset) : { model: reset };
    },
  });
