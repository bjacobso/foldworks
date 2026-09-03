import { Effect, Option, Schema as S } from "effect";
import { Command, File, Update } from "foldkit";
import { evo } from "foldkit/struct";

import {
  FormBuilder,
  applyReorder,
  deleteField,
  deletePage,
  deleteSection,
  findField,
  findPage,
  findSection,
  insertField,
  insertPage,
  insertSection,
  locateField,
  moveItem,
  paletteItemId,
  paletteTypeFromId,
  updateField,
  updatePage,
  updateSection,
} from "@foldworks/form-builder";
import { History } from "@foldworks/history";

import {
  downloadJson,
  nextFormId,
  parseFormExport,
  serializeFormExport,
} from "../document-storage";
import { createField } from "./operations";
import { isFieldKind } from "./field-types";
import { exampleForms, type FormDocument, type FormPage } from "./model";
import { Message, OutMessage } from "./message";
import type { Model } from "./editor-model";

type UpdateReturn = Update.Return<Model, Message>;
type ChildUpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>;
type ImportResult = Extract<Message, {
  readonly _tag:
    | "CompletedImportDocument"
    | "CancelledImportDocument"
    | "FailedImportDocument";
}>;

const ExportDocument = Command.define("ExportFormDocument", {
  args: { filename: S.String, json: S.String },
  messages: [Message.CompletedExportDocument],
  execute: ({ filename, json }) => Effect.sync(() => {
    downloadJson(filename, json);
    return Message.CompletedExportDocument();
  }),
});

const ImportDocument = Command.define("ImportFormDocument", {
  args: {},
  messages: [
    Message.CompletedImportDocument,
    Message.CancelledImportDocument,
    Message.FailedImportDocument,
  ],
  execute: () => File.select(["application/json", ".json"]).pipe(
    Effect.flatMap((selected): Effect.Effect<ImportResult> => {
      if (Option.isNone(selected)) return Effect.succeed(Message.CancelledImportDocument());
      return File.readAsText(selected.value).pipe(
        Effect.map((json): ImportResult => Message.CompletedImportDocument({ json })),
        Effect.catch(() => Effect.succeed<ImportResult>(Message.FailedImportDocument({
          reason: "The selected file could not be read.",
        }))),
      );
    }),
  ),
});

const previewPages = (model: Model): ReadonlyArray<FormPage> =>
  model.document.sections
    .filter((section) =>
      model.previewActorId === "__journey__" || section.actorId === model.previewActorId,
    )
    .flatMap((section) => section.pages);

const markPageContentViewed = (model: Model, pageId: string): Model => {
  const page = findPage(model.document, pageId);
  const section = model.document.sections.find((candidate) =>
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

export const loadExample = (model: Model, exampleId: Model["exampleId"]): Model => {
  const document = model.documents[exampleId];
  return evo(model, {
    exampleId: () => exampleId,
    document: () => document,
    interaction: () => FormBuilder.init(),
    history: () => History.init<FormDocument>(),
    selectedItem: () => Option.none(),
    activePageId: () => document.sections[0]?.pages[0]?.id ?? "",
    previewActorId: () => document.actors[0]?.id ?? "__journey__",
    answers: () => [],
    contentViews: () => [],
    nextId: () => nextFormId(document),
    revision: (value) => value + 1,
    announcement: () => `${document.title} example loaded.`,
  });
};

export const setMode = (model: Model, mode: Model["mode"]): Model => {
  const pages = previewPages(model);
  const activePageId = pages.some((page) => page.id === model.activePageId)
    ? model.activePageId
    : pages[0]?.id ?? "";
  const next = evo(model, {
    mode: () => mode,
    history: (history) => History.breakCoalescing(history),
    activePageId: () => activePageId,
    revision: (value) => value + 1,
  });
  return mode === "Preview" ? markPageContentViewed(next, activePageId) : next;
};

const commitDrop = (outMessage: FormBuilder.OutMessage): Update.Step<Model, Message> =>
  (model) => FormBuilder.OutMessage.match<UpdateReturn>(outMessage, {
    Cancelled: () => ({ model }),
    Reordered: (reordered) => {
      const result = applyReorder({
        document: model.document,
        reordered: FormBuilder.OutMessage.Reordered(reordered),
        operations: { insertField, moveItem },
        createFromPalette: (type) =>
          isFieldKind(type) ? createField(type, model.nextId) : undefined,
      });
      if (result === undefined) return { model };
      if (result._tag === "Inserted") {
        return {
          model: evo(model, {
            document: () => result.document,
            selectedItem: () => Option.some({ kind: "Field", id: result.field.id }),
            activePageId: () => result.location.pageId,
            nextId: (value) => value + 1,
            revision: (value) => value + 1,
            announcement: () => `${result.field.label} added.`,
          }),
        };
      }
      return {
        model: evo(model, {
          document: () => result.document,
          revision: (value) => value + 1,
          announcement: () => `${result.item.kind} moved.`,
        }),
      };
    },
  });

const foldInteraction = Update.foldChild({
  update: FormBuilder.update,
  read: (model: Model) => Option.some(model.interaction),
  write: (model, interaction) => evo(model, { interaction: () => interaction }),
  toParentMessage: (message) => Message.GotInteractionMessage({ message }),
  foldOutMessage: commitDrop,
});

const restoreFromHistory = (model: Model, direction: "Undo" | "Redo"): UpdateReturn => {
  const step = direction === "Undo"
    ? History.undo(model.history, model.document)
    : History.redo(model.history, model.document);
  if (step === undefined) return { model };
  const selection = Option.getOrUndefined(model.selectedItem);
  const keepsSelection = selection !== undefined && (
    selection.kind === "Section"
      ? findSection(step.value, selection.id) !== undefined
      : selection.kind === "Page"
        ? findPage(step.value, selection.id) !== undefined
        : findField(step.value, selection.id) !== undefined
  );
  return {
    model: evo(model, {
      document: () => step.value,
      history: () => step.history,
      interaction: () => FormBuilder.init(),
      selectedItem: () => keepsSelection ? model.selectedItem : Option.none(),
      activePageId: () => findPage(step.value, model.activePageId) === undefined
        ? step.value.sections[0]?.pages[0]?.id ?? ""
        : model.activePageId,
      nextId: () => nextFormId(step.value),
      revision: (value) => value + 1,
      announcement: () => `${direction} completed for the form.`,
    }),
  };
};

const coalescingKey = (model: Model, message: Message): string | undefined => {
  const selection = Option.getOrUndefined(model.selectedItem);
  if (selection === undefined) return undefined;
  const prefix = `form:${selection.kind}:${selection.id}`;
  switch (message._tag) {
    case "ChangedItemTitle": return `${prefix}:title`;
    case "ChangedItemDescription": return `${prefix}:description`;
    case "ChangedFieldContent": return `${prefix}:content`;
    case "ChangedFieldOptions": return `${prefix}:options`;
    default: return undefined;
  }
};

const updateCore = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    CompletedExportDocument: () => ({
      model: evo(model, { announcement: () => "Form JSON exported." }),
    }),
    CancelledImportDocument: () => ({ model }),
    FailedImportDocument: ({ reason }) => ({
      model: evo(model, { announcement: () => reason }),
    }),
    ClickedUndo: () => restoreFromHistory(model, "Undo"),
    ClickedRedo: () => restoreFromHistory(model, "Redo"),
    ClickedExportDocument: () => ({
      model,
      commands: [ExportDocument({
        filename: `${model.document.id}.form.json`,
        json: serializeFormExport(model.document),
      })],
    }),
    ClickedImportDocument: () => ({ model, commands: [ImportDocument({})] }),
    CompletedImportDocument: ({ json }) => {
      const document = parseFormExport(json);
      return document === undefined
        ? {
            model: evo(model, {
              announcement: () => "That file is not a valid form export.",
            }),
          }
        : {
            model: evo(model, {
              document: () => document,
              interaction: () => FormBuilder.init(),
              selectedItem: () => Option.none(),
              activePageId: () => document.sections[0]?.pages[0]?.id ?? "",
              nextId: () => nextFormId(document),
              revision: (value) => value + 1,
              announcement: () => "Form imported.",
            }),
          };
    },
    GotInteractionMessage: ({ message: interactionMessage }) =>
      foldInteraction(model, interactionMessage),
    SelectedExample: () => ({ model }),
    SelectedMode: () => ({ model }),
    SelectedItem: ({ kind, id }) => ({
      model: evo(model, {
        interaction: () => FormBuilder.init(),
        selectedItem: () => Option.some({ kind, id }),
        history: (history) => History.breakCoalescing(history),
        activePageId: (current) => kind === "Page"
          ? id
          : kind === "Field"
            ? locateField(model.document, id)?.page.id ?? current
            : current,
      }),
    }),
    SelectedPreviewActor: ({ actorId }) => {
      const pages = model.document.sections
        .filter((section) => actorId === "__journey__" || section.actorId === actorId)
        .flatMap((section) => section.pages);
      const pageId = pages[0]?.id ?? "";
      return {
        model: markPageContentViewed(evo(model, {
          previewActorId: () => actorId,
          activePageId: () => pageId,
        }), pageId),
      };
    },
    ClickedAddSection: () => {
      const actor = model.document.actors[0];
      if (actor === undefined) return { model };
      const id = `form-section-${model.nextId}`;
      const document = insertSection(
        model.document,
        { kind: "Section", index: model.document.sections.length },
        { id, actorId: actor.id, title: "New section", description: "", pages: [] },
      );
      return document === undefined ? { model } : {
        model: evo(model, {
          document: () => document,
          selectedItem: () => Option.some({ kind: "Section", id }),
          nextId: (value) => value + 1,
          revision: (value) => value + 1,
        }),
      };
    },
    ClickedAddPage: ({ sectionId }) => {
      const section = findSection(model.document, sectionId);
      if (section === undefined) return { model };
      const id = `form-page-${model.nextId}`;
      const document = insertPage(model.document, {
        kind: "Page",
        sectionId,
        index: section.pages.length,
      }, { id, title: "Untitled page", description: "", fields: [] });
      return document === undefined ? { model } : {
        model: evo(model, {
          document: () => document,
          selectedItem: () => Option.some({ kind: "Page", id }),
          activePageId: () => id,
          nextId: (value) => value + 1,
          revision: (value) => value + 1,
        }),
      };
    },
    ClickedAddField: ({ pageId, fieldType }) => {
      const page = findPage(model.document, pageId);
      const paletteType = paletteTypeFromId(paletteItemId(fieldType));
      const kind = paletteType !== undefined && isFieldKind(paletteType)
        ? paletteType
        : undefined;
      if (page === undefined || kind === undefined) return { model };
      const field = createField(kind, model.nextId);
      const document = insertField(model.document, {
        kind: "Field",
        pageId,
        index: page.fields.length,
      }, field);
      return document === undefined ? { model } : {
        model: evo(model, {
          document: () => document,
          interaction: () => FormBuilder.init(),
          selectedItem: () => Option.some({ kind: "Field", id: field.id }),
          activePageId: () => pageId,
          nextId: (value) => value + 1,
          revision: (value) => value + 1,
        }),
      };
    },
    ChangedItemTitle: ({ value }) => Option.match(model.selectedItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: evo(model, {
          document: (document) => selection.kind === "Section"
            ? updateSection(document, selection.id, (section) => ({ ...section, title: value }))
            : selection.kind === "Page"
              ? updatePage(document, selection.id, (page) => ({ ...page, title: value }))
              : updateField(document, selection.id, (field) => ({ ...field, label: value })),
        }),
      }),
    }),
    ChangedItemDescription: ({ value }) => Option.match(model.selectedItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: evo(model, {
          document: (document) => selection.kind === "Section"
            ? updateSection(document, selection.id, (section) => ({ ...section, description: value }))
            : selection.kind === "Page"
              ? updatePage(document, selection.id, (page) => ({ ...page, description: value }))
              : updateField(document, selection.id, (field) => ({ ...field, description: value })),
        }),
      }),
    }),
    ChangedSectionActor: ({ actorId }) => Option.match(model.selectedItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: selection.kind !== "Section" ? model : evo(model, {
          document: (document) => updateSection(document, selection.id, (section) => ({
            ...section,
            actorId,
          })),
        }),
      }),
    }),
    ChangedFieldRequired: ({ required }) => Option.match(model.selectedItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: selection.kind !== "Field" ? model : evo(model, {
          document: (document) => updateField(document, selection.id, (field) => ({
            ...field,
            required,
          })),
        }),
      }),
    }),
    ChangedFieldContent: ({ value }) => Option.match(model.selectedItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: selection.kind !== "Field" ? model : evo(model, {
          document: (document) => updateField(document, selection.id, (field) => ({
            ...field,
            content: value,
          })),
        }),
      }),
    }),
    ChangedFieldOptions: ({ value }) => Option.match(model.selectedItem, {
      onNone: () => ({ model }),
      onSome: (selection) => ({
        model: selection.kind !== "Field" ? model : evo(model, {
          document: (document) => updateField(document, selection.id, (field) => ({
            ...field,
            options: value.split("\n").map((option) => option.trim()).filter(Boolean),
          })),
        }),
      }),
    }),
    ClickedDeleteItem: () => Option.match(model.selectedItem, {
      onNone: () => ({ model }),
      onSome: (selection) => {
        const document: FormDocument | undefined = selection.kind === "Section"
          ? deleteSection(model.document, selection.id)
          : selection.kind === "Page"
            ? deletePage(model.document, selection.id)
            : deleteField(model.document, selection.id);
        if (document === undefined) return { model };
        return {
          model: evo(model, {
            document: () => document,
            selectedItem: () => Option.none(),
            activePageId: (current) => findPage(document, current) === undefined
              ? document.sections[0]?.pages[0]?.id ?? ""
              : current,
            revision: (value) => value + 1,
          }),
        };
      },
    }),
    ClickedReset: () => {
      const document = exampleForms[model.exampleId];
      return {
        model: evo(model, {
          document: () => document,
          interaction: () => FormBuilder.init(),
          selectedItem: () => Option.none(),
          activePageId: () => document.sections[0]?.pages[0]?.id ?? "",
          nextId: () => nextFormId(document),
          revision: (value) => value + 1,
          announcement: () => "Form reset to the example.",
        }),
      };
    },
    ChangedAnswer: ({ fieldId, value }) => ({
      model: evo(model, {
        answers: (answers) => answers.some((answer) => answer.fieldId === fieldId)
          ? answers.map((answer) => answer.fieldId === fieldId ? { ...answer, value } : answer)
          : [...answers, { fieldId, value }],
      }),
    }),
    ClickedPreviewPrevious: () => {
      const pages = previewPages(model);
      const index = pages.findIndex((page) => page.id === model.activePageId);
      const pageId = pages[Math.max(0, index - 1)]?.id ?? model.activePageId;
      return { model: evo(model, { activePageId: () => pageId }) };
    },
    ClickedPreviewNext: () => {
      const pages = previewPages(model);
      const index = pages.findIndex((page) => page.id === model.activePageId);
      const pageId = pages[Math.min(pages.length - 1, index + 1)]?.id ?? model.activePageId;
      return {
        model: markPageContentViewed(evo(model, { activePageId: () => pageId }), pageId),
      };
    },
  });

export const update = (model: Model, message: Message): ChildUpdateReturn => {
  if (message._tag === "SelectedExample") {
    return {
      model,
      outMessage: OutMessage.RequestedRoute({
        exampleId: message.exampleId,
        mode: model.mode,
      }),
    };
  }
  if (message._tag === "SelectedMode") {
    return {
      model,
      outMessage: OutMessage.RequestedRoute({
        exampleId: model.exampleId,
        mode: message.mode,
      }),
    };
  }

  const result = updateCore(model, message);
  if (result.model.document === model.document) return result;
  const traversedHistory = message._tag === "ClickedUndo" || message._tag === "ClickedRedo";
  const key = coalescingKey(model, message);
  const next = evo(result.model, {
    history: () => traversedHistory
      ? result.model.history
      : History.record(
          model.history,
          model.document,
          key === undefined ? {} : { coalescingKey: key },
        ),
    documents: (documents) => ({
      ...documents,
      [result.model.exampleId]: result.model.document,
    }),
  });
  return { ...result, model: next, outMessage: OutMessage.Changed() };
};
