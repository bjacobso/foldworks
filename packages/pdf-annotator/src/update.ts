import { Effect, Option, Schema as S } from "effect";
import { Command, Update } from "foldkit";
import * as BrowserFile from "foldkit/file";

import { DragAndDrop, FileDrop } from "@foldkit/ui";
import {
  annotationValueText,
  makeAnnotationDocument,
  nextAnnotationId,
  parseAnnotationDocument,
  serializeAnnotationDocument,
  validateAnnotationDocument,
} from "./document";
import {
  CANVAS_WIDTH,
  annotationIdFromItemId,
  annotationKindFromItemId,
  canvasHeight,
  clamp,
  defaultAnnotation,
  moveAnnotation,
  resizeAnnotation,
} from "./geometry";
import { Message } from "./message";
import {
  Annotation,
  BuiltInAnnotationKind,
  DocumentState,
  MoveState,
  ResizeState,
  type Model,
} from "./model";
import {
  base64ToBytes,
  bytesToBase64,
  exportAnnotatedPdf,
  extractPdfAnnotations,
  renderPdfPage,
} from "./pdf";

type UpdateReturn = Update.Return<Model, Message>;

const failureReason = (error: unknown): string =>
  error instanceof Error ? error.message : "The PDF could not be processed.";

const loadBytes = (
  name: string,
  bytes: Uint8Array,
) => Effect.tryPromise({
  try: async () => {
    const [rendered, extracted] = await Promise.all([
      renderPdfPage(bytes, 1),
      extractPdfAnnotations(bytes),
    ]);
    return Message.CompletedLoadPdf({
      name,
      bytesBase64: bytesToBase64(bytes),
      annotations: [...extracted.annotations],
      ...rendered,
    });
  },
  catch: (error) => error,
}).pipe(
  Effect.catch((error) => Effect.succeed(Message.FailedLoadPdf({
    name,
    reason: failureReason(error),
  }))),
);

const LoadPdfFile = Command.define("LoadPdfFile", {
  args: { file: BrowserFile.File },
  messages: [Message.CompletedLoadPdf, Message.FailedLoadPdf],
  execute: ({ file }) => BrowserFile.readAsArrayBuffer(file).pipe(
    Effect.flatMap((buffer) => loadBytes(BrowserFile.name(file), new Uint8Array(buffer))),
    Effect.catch((error) => Effect.succeed(Message.FailedLoadPdf({
      name: BrowserFile.name(file),
      reason: failureReason(error),
    }))),
  ),
});

const LoadPdfUrl = Command.define("LoadPdfUrl", {
  args: { url: S.String, name: S.String },
  messages: [Message.CompletedLoadPdf, Message.FailedLoadPdf],
  execute: ({ url, name }) => Effect.tryPromise({
    try: async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`The sample returned ${response.status}.`);
      return new Uint8Array(await response.arrayBuffer());
    },
    catch: (error) => error,
  }).pipe(
    Effect.flatMap((bytes) => loadBytes(name, bytes)),
    Effect.catch((error) => Effect.succeed(Message.FailedLoadPdf({
      name,
      reason: failureReason(error),
    }))),
  ),
});

const RenderPage = Command.define("RenderPdfPage", {
  args: { bytesBase64: S.String, page: S.Number },
  messages: [Message.CompletedRenderPage, Message.FailedRenderPage],
  execute: ({ bytesBase64, page }) => Effect.tryPromise({
    try: async () => renderPdfPage(base64ToBytes(bytesBase64), page),
    catch: (error) => error,
  }).pipe(
    Effect.map((rendered) => Message.CompletedRenderPage(rendered)),
    Effect.catch((error) => Effect.succeed(Message.FailedRenderPage({
      reason: failureReason(error),
    }))),
  ),
});

const ResolveCanvasDrop = Command.define("ResolvePdfCanvasDrop", {
  args: {
    canvasId: S.String,
    kind: BuiltInAnnotationKind,
    clientX: S.Number,
    clientY: S.Number,
    pageWidth: S.Number,
    pageHeight: S.Number,
  },
  messages: [Message.CompletedCanvasDrop],
  execute: ({ canvasId, kind, clientX, clientY, pageWidth, pageHeight }) => Effect.sync(() => {
    const canvas = document.querySelector<HTMLElement>(
      `[data-pdf-canvas-id="${CSS.escape(canvasId)}"]`,
    );
    if (canvas === null) {
      return Message.CompletedCanvasDrop({ kind, x: pageWidth / 2, y: pageHeight / 2 });
    }
    const rect = canvas.getBoundingClientRect();
    return Message.CompletedCanvasDrop({
      kind,
      x: clamp((clientX - rect.left) / rect.width, 0, 1) * pageWidth,
      y: clamp((clientY - rect.top) / rect.height, 0, 1) * pageHeight,
    });
  }),
});

const ExportPdf = Command.define("ExportAnnotatedPdf", {
  args: {
    bytesBase64: S.String,
    annotations: S.Array(Annotation),
    deletedFieldNames: S.Array(S.String),
    sourceName: S.String,
  },
  messages: [Message.CompletedExport],
  execute: ({ bytesBase64, annotations, deletedFieldNames, sourceName }) => Effect.tryPromise({
    try: async () => {
      const warnings = await exportAnnotatedPdf(
        base64ToBytes(bytesBase64),
        annotations,
        sourceName,
        { deletedFieldNames },
      );
      return Message.CompletedExport({
        succeeded: true,
        reason: warnings.length === 0 ? "" : `${warnings.length} PDF warning${warnings.length === 1 ? "" : "s"}.`,
      });
    },
    catch: (error) => error,
  }).pipe(
    Effect.catch((error) => Effect.succeed(Message.CompletedExport({
      succeeded: false,
      reason: failureReason(error),
    }))),
  ),
});

const DownloadJson = Command.define("DownloadPdfAnnotationsJson", {
  args: { sourceName: S.String, json: S.String },
  messages: [Message.CompletedJsonDownload],
  execute: ({ sourceName, json }) => Effect.sync(() => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sourceName.replace(/\.pdf$/i, "") || "document"}-annotations.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return Message.CompletedJsonDownload();
  }),
});

const updateAnnotation = (
  model: Model,
  annotationId: string,
  transform: (annotation: Annotation) => Annotation,
): Model => ({
  ...model,
  annotations: model.annotations.map((annotation) =>
    annotation.id === annotationId ? transform(annotation) : annotation
  ),
});

const restoreMovingAnnotation = (model: Model): Model =>
  model.moveState._tag === "Moving"
    ? updateAnnotation(model, model.moveState.annotationId, (annotation) => ({
        ...annotation,
        rect: {
          ...annotation.rect,
          x: model.moveState._tag === "Moving" ? model.moveState.originX : annotation.rect.x,
          y: model.moveState._tag === "Moving" ? model.moveState.originY : annotation.rect.y,
        },
      }))
    : model;

const addAnnotation = (
  model: Model,
  kind: BuiltInAnnotationKind,
  x: number,
  y: number,
): Model => {
  if (model.document._tag !== "Ready") return model;
  const id = nextAnnotationId(model.annotations);
  return {
    ...model,
    annotations: [
      ...model.annotations,
      defaultAnnotation(
        id,
        kind,
        model.document.currentPage - 1,
        model.document.pageWidth,
        model.document.pageHeight,
        x,
        y,
      ),
    ],
    selectedAnnotationId: Option.some(id),
    nextId: model.nextId + 1,
    announcement: `${kind} annotation added to page ${model.document.currentPage}.`,
  };
};

const updateDrag = (model: Model, childMessage: DragAndDrop.Message): UpdateReturn => {
  const previousDrag = model.dragAndDrop.dragState;
  const result = DragAndDrop.update(model.dragAndDrop, childMessage);
  let next: Model = { ...model, dragAndDrop: result.model };

  if (childMessage._tag === "PressedDraggable") {
    const annotationId = annotationIdFromItemId(childMessage.itemId);
    const annotation = annotationId === undefined
      ? undefined
      : model.annotations.find((item) => item.id === annotationId);
    if (annotation !== undefined && annotation.locked !== true) {
      next = {
        ...next,
        selectedAnnotationId: Option.some(annotation.id),
        moveState: MoveState.Moving({
          annotationId: annotation.id,
          originX: annotation.rect.x,
          originY: annotation.rect.y,
        }),
      };
    }
  }

  if (childMessage._tag === "MovedPointer") {
    next = {
      ...next,
      lastPointerScreenX: childMessage.screenX,
      lastPointerScreenY: childMessage.screenY,
      lastPointerClientX: childMessage.clientX,
      lastPointerClientY: childMessage.clientY,
    };
    if (
      next.moveState._tag === "Moving" &&
      (previousDrag._tag === "Pending" || previousDrag._tag === "Dragging") &&
      model.document._tag === "Ready"
    ) {
      const origin = previousDrag.origin;
      const readyDocument = model.document;
      const displayWidth = CANVAS_WIDTH * model.zoom;
      const displayHeight = canvasHeight(readyDocument.pageWidth, readyDocument.pageHeight) * model.zoom;
      next = updateAnnotation(next, next.moveState.annotationId, (annotation) =>
        moveAnnotation(
          annotation,
          next.moveState._tag === "Moving" ? next.moveState.originX : annotation.rect.x,
          next.moveState._tag === "Moving" ? next.moveState.originY : annotation.rect.y,
          (childMessage.screenX - origin.screenX) * readyDocument.pageWidth / displayWidth,
          (childMessage.screenY - origin.screenY) * readyDocument.pageHeight / displayHeight,
          readyDocument.pageWidth,
          readyDocument.pageHeight,
        )
      );
    }
  }

  const outMessage = result.outMessage;
  if (outMessage?._tag === "Cancelled") {
    next = {
      ...restoreMovingAnnotation(next),
      moveState: MoveState.Idle(),
      announcement: "Annotation movement cancelled.",
    };
  }
  if (outMessage?._tag === "Reordered") {
    const kind = annotationKindFromItemId(outMessage.itemId);
    if (kind !== undefined && outMessage.toContainerId === `${model.id}-canvas` && model.document._tag === "Ready") {
      if (previousDrag._tag === "KeyboardDragging") {
        return {
          model: addAnnotation(
            next,
            kind,
            model.document.pageWidth / 2,
            model.document.pageHeight / 2,
          ),
        };
      }
      return {
        model: { ...next, moveState: MoveState.Idle() },
        commands: [ResolveCanvasDrop({
          canvasId: model.id,
          kind,
          clientX: model.lastPointerClientX,
          clientY: model.lastPointerClientY,
          pageWidth: model.document.pageWidth,
          pageHeight: model.document.pageHeight,
        })],
      };
    }
    next = {
      ...next,
      moveState: MoveState.Idle(),
      announcement: "Annotation moved.",
    };
  }
  return result.commands === undefined
    ? { model: next }
    : {
        model: next,
        commands: result.commands.map((command) =>
          Command.mapMessage(command, (message) => Message.GotDragMessage({ message }))
        ),
      };
};

const updateFileDrop = (model: Model, childMessage: FileDrop.Message): UpdateReturn => {
  const result = FileDrop.update(model.fileDrop, childMessage);
  const next = { ...model, fileDrop: result.model };
  if (result.outMessage?._tag !== "ReceivedFiles") return { model: next };
  const file = result.outMessage.files[0];
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return {
      model: {
        ...next,
        document: DocumentState.Failed({ name: file.name, reason: "Choose a PDF file." }),
        announcement: "The selected file is not a PDF.",
      },
    };
  }
  if (file.size > 25 * 1024 * 1024) {
    return {
      model: {
        ...next,
        document: DocumentState.Failed({
          name: file.name,
          reason: "PDF files must be smaller than 25 MB.",
        }),
        announcement: "The selected PDF is too large.",
      },
    };
  }
  return {
    model: {
      ...next,
      document: DocumentState.Loading({ name: file.name }),
      annotations: model.useInitialAnnotationsOnLoad ? model.annotations : [],
      deletedPdfFieldNames: [],
      selectedAnnotationId: Option.none(),
      announcement: `Loading ${file.name}.`,
    },
    commands: [LoadPdfFile({ file })],
  };
};

const importedFieldNames = (annotations: ReadonlyArray<Annotation>): ReadonlyArray<string> =>
  annotations.flatMap((annotation) =>
    annotation.pdf?.source === "imported" && annotation.name !== undefined ? [annotation.name] : []
  );

const metadataValue = (value: string): S.Json => {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  try {
    return S.decodeUnknownSync(S.Json)(JSON.parse(trimmed));
  } catch {
    return value;
  }
};

const documentJson = (model: Model): string => serializeAnnotationDocument(
  makeAnnotationDocument(model.annotations, model.documentMetadata),
);

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    GotDragMessage: ({ message: childMessage }) => updateDrag(model, childMessage),
    GotFileDropMessage: ({ message: childMessage }) => updateFileDrop(model, childMessage),
    ClickedLoadSample: () => Option.match(model.sampleUrl, {
      onNone: () => ({ model }),
      onSome: (url) => ({
        model: {
          ...model,
          document: DocumentState.Loading({ name: "foldworks-sample.pdf" }),
          annotations: model.useInitialAnnotationsOnLoad ? model.annotations : [],
          deletedPdfFieldNames: [],
          selectedAnnotationId: Option.none(),
          announcement: "Loading the sample PDF.",
        },
        commands: [LoadPdfUrl({ url, name: "foldworks-sample.pdf" })],
      }),
    }),
    CompletedLoadPdf: (loaded) => {
      const annotations = model.useInitialAnnotationsOnLoad ? model.annotations : loaded.annotations;
      return { model: {
        ...model,
        document: DocumentState.Ready({
          name: loaded.name,
          bytesBase64: loaded.bytesBase64,
          pageCount: loaded.pageCount,
          currentPage: loaded.page,
          pageWidth: loaded.pageWidth,
          pageHeight: loaded.pageHeight,
          previewDataUrl: loaded.previewDataUrl,
        }),
        annotations,
        useInitialAnnotationsOnLoad: false,
        deletedPdfFieldNames: [],
        selectedAnnotationId: Option.none(),
        nextId: annotations.length + 1,
        isRenderingPage: false,
        exportStatus: "Idle",
        jsonDraft: "",
        jsonError: "",
        announcement: `${loaded.name} loaded with ${loaded.pageCount} pages and ${annotations.length} annotation${annotations.length === 1 ? "" : "s"}.`,
      },
    };
    },
    FailedLoadPdf: ({ name, reason }) => ({
      model: {
        ...model,
        document: DocumentState.Failed({ name, reason }),
        isRenderingPage: false,
        announcement: `Could not load ${name}. ${reason}`,
      },
    }),
    RequestedPage: ({ page }) => {
      if (model.document._tag !== "Ready") return { model };
      const target = clamp(Math.round(page), 1, model.document.pageCount);
      if (target === model.document.currentPage) return { model };
      return {
        model: {
          ...model,
          isRenderingPage: true,
          selectedAnnotationId: Option.none(),
          announcement: `Loading page ${target}.`,
        },
        commands: [RenderPage({ bytesBase64: model.document.bytesBase64, page: target })],
      };
    },
    CompletedRenderPage: ({ page, pageWidth, pageHeight, previewDataUrl }) =>
      model.document._tag !== "Ready"
        ? { model }
        : ({
            model: {
              ...model,
              document: DocumentState.Ready({
                ...model.document,
                currentPage: page,
                pageWidth,
                pageHeight,
                previewDataUrl,
              }),
              isRenderingPage: false,
              announcement: `Page ${page} ready.`,
            },
          }),
    FailedRenderPage: ({ reason }) => ({
      model: {
        ...model,
        isRenderingPage: false,
        announcement: `Could not render that page. ${reason}`,
      },
    }),
    ChangedZoom: ({ zoom }) => ({
      model: {
        ...model,
        zoom: clamp(zoom, 0.25, 4),
        announcement: `Zoom ${Math.round(clamp(zoom, 0.25, 4) * 100)} percent.`,
      },
    }),
    CompletedCanvasDrop: ({ kind, x, y }) => ({ model: addAnnotation(model, kind, x, y) }),
    SelectedAnnotation: ({ annotationId }) => ({
      model: {
        ...model,
        selectedAnnotationId: Option.some(annotationId),
        announcement: `${model.annotations.find((item) => item.id === annotationId)?.kind ?? "Annotation"} selected.`,
      },
    }),
    StartedResize: ({ annotationId, handle, screenX, screenY }) => {
      const annotation = model.annotations.find((item) => item.id === annotationId);
      return annotation === undefined || annotation.locked === true
        ? { model }
        : ({
            model: {
              ...model,
              selectedAnnotationId: Option.some(annotationId),
              resizeState: ResizeState.Resizing({
                annotationId,
                handle,
                originScreenX: screenX,
                originScreenY: screenY,
                originX: annotation.rect.x,
                originY: annotation.rect.y,
                originWidth: annotation.rect.width,
                originHeight: annotation.rect.height,
              }),
            },
          });
    },
    MovedResize: ({ screenX, screenY }) => {
      if (model.resizeState._tag !== "Resizing" || model.document._tag !== "Ready") return { model };
      const state = model.resizeState;
      const readyDocument = model.document;
      const displayWidth = CANVAS_WIDTH * model.zoom;
      const displayHeight = canvasHeight(readyDocument.pageWidth, readyDocument.pageHeight) * model.zoom;
      return {
        model: updateAnnotation(model, state.annotationId, (annotation) =>
          resizeAnnotation(
            annotation,
            state.handle,
            {
              x: state.originX,
              y: state.originY,
              width: state.originWidth,
              height: state.originHeight,
            },
            (screenX - state.originScreenX) * readyDocument.pageWidth / displayWidth,
            (screenY - state.originScreenY) * readyDocument.pageHeight / displayHeight,
            readyDocument.pageWidth,
            readyDocument.pageHeight,
          )
        ),
      };
    },
    FinishedResize: () => ({
      model: { ...model, resizeState: ResizeState.Idle(), announcement: "Annotation resized." },
    }),
    ChangedAnnotationValue: ({ annotationId, value }) => ({
      model: updateAnnotation(model, annotationId, (annotation) => ({
        ...annotation,
        value: annotation.kind === "checkbox" ? value === "true" : value,
      })),
    }),
    ChangedAnnotationName: ({ annotationId, name }) => ({
      model: updateAnnotation(model, annotationId, (annotation) => ({ ...annotation, name })),
    }),
    ChangedAnnotationFlag: ({ annotationId, property, value }) => ({
      model: updateAnnotation(model, annotationId, (annotation) => ({
        ...annotation,
        [property]: value,
      })),
    }),
    ChangedAnnotationGeometry: ({ annotationId, property, value }) => {
      const numeric = Number.isFinite(value) ? value : 0;
      return {
        model: updateAnnotation(model, annotationId, (annotation) => {
          const rect = { ...annotation.rect, [property]: numeric };
          if (rect.width <= 0 || rect.height <= 0) return annotation;
          if (model.document._tag === "Ready" && annotation.pageIndex === model.document.currentPage - 1) {
            rect.width = Math.min(rect.width, model.document.pageWidth);
            rect.height = Math.min(rect.height, model.document.pageHeight);
            rect.x = clamp(rect.x, 0, model.document.pageWidth - rect.width);
            rect.y = clamp(rect.y, 0, model.document.pageHeight - rect.height);
          }
          return { ...annotation, rect };
        }),
      };
    },
    ChangedAnnotationPage: ({ annotationId, pageIndex }) => ({
      model: updateAnnotation(model, annotationId, (annotation) => ({
        ...annotation,
        pageIndex: model.document._tag === "Ready"
          ? clamp(Math.round(pageIndex), 0, model.document.pageCount - 1)
          : Math.max(0, Math.round(pageIndex)),
      })),
    }),
    AddedAnnotationMetadata: ({ annotationId }) => ({
      model: updateAnnotation(model, annotationId, (annotation) => {
        const metadata = { ...(annotation.metadata ?? {}) };
        let index = 1;
        while (`attribute${index}` in metadata) index += 1;
        metadata[`attribute${index}`] = "";
        return { ...annotation, metadata };
      }),
    }),
    RenamedAnnotationMetadata: ({ annotationId, key, nextKey }) => ({
      model: updateAnnotation(model, annotationId, (annotation) => {
        if (nextKey.trim() === "" || (nextKey !== key && nextKey in (annotation.metadata ?? {}))) {
          return annotation;
        }
        const metadata: Record<string, S.Json> = {};
        for (const [metadataKey, metadataValue] of Object.entries(annotation.metadata ?? {})) {
          metadata[metadataKey === key ? nextKey : metadataKey] = metadataValue;
        }
        return { ...annotation, metadata };
      }),
    }),
    ChangedAnnotationMetadata: ({ annotationId, key, value }) => ({
      model: updateAnnotation(model, annotationId, (annotation) => ({
        ...annotation,
        metadata: { ...(annotation.metadata ?? {}), [key]: metadataValue(value) },
      })),
    }),
    DeletedAnnotationMetadata: ({ annotationId, key }) => ({
      model: updateAnnotation(model, annotationId, (annotation) => {
        const metadata = { ...(annotation.metadata ?? {}) };
        delete metadata[key];
        return { ...annotation, metadata };
      }),
    }),
    NudgedAnnotation: ({ annotationId, direction, large }) => {
      if (model.document._tag !== "Ready") return { model };
      const step = large ? 10 : 1;
      const [deltaX, deltaY] = ({
        Up: [0, -step],
        Down: [0, step],
        Left: [-step, 0],
        Right: [step, 0],
      } as const)[direction];
      return {
        model: updateAnnotation(model, annotationId, (annotation) => annotation.locked === true
          ? annotation
          : moveAnnotation(
              annotation,
              annotation.rect.x,
              annotation.rect.y,
              deltaX,
              deltaY,
              model.document._tag === "Ready" ? model.document.pageWidth : annotation.rect.x + annotation.rect.width,
              model.document._tag === "Ready" ? model.document.pageHeight : annotation.rect.y + annotation.rect.height,
            )),
      };
    },
    DuplicatedAnnotation: ({ annotationId }) => {
      const source = model.annotations.find(({ id }) => id === annotationId);
      if (source === undefined) return { model };
      const id = nextAnnotationId(model.annotations);
      const pageWidth = model.document._tag === "Ready" ? model.document.pageWidth : source.rect.x + source.rect.width + 10;
      const pageHeight = model.document._tag === "Ready" ? model.document.pageHeight : source.rect.y + source.rect.height + 10;
      const duplicateSource: Annotation = {
        ...source,
        id,
        ...(source.name === undefined ? {} : { name: `${source.name}_copy` }),
        pdf: { source: "authored" },
      };
      const duplicate = moveAnnotation(
        duplicateSource,
        source.rect.x,
        source.rect.y,
        10,
        10,
        pageWidth,
        pageHeight,
      );
      return {
        model: {
          ...model,
          annotations: [...model.annotations, duplicate],
          selectedAnnotationId: Option.some(id),
          announcement: "Annotation duplicated.",
        },
      };
    },
    DeletedAnnotation: ({ annotationId }) => {
      const removed = model.annotations.find(({ id }) => id === annotationId);
      const deletedName = removed?.pdf?.source === "imported" ? removed.name : undefined;
      return {
        model: {
          ...model,
          annotations: model.annotations.filter((annotation) => annotation.id !== annotationId),
          deletedPdfFieldNames: deletedName === undefined || model.deletedPdfFieldNames.includes(deletedName)
            ? model.deletedPdfFieldNames
            : [...model.deletedPdfFieldNames, deletedName],
          selectedAnnotationId: Option.none(),
          announcement: "Annotation deleted.",
        },
      };
    },
    ClickedClearAnnotations: () => ({
      model: {
        ...model,
        annotations: [],
        deletedPdfFieldNames: [...new Set([
          ...model.deletedPdfFieldNames,
          ...importedFieldNames(model.annotations),
        ])],
        selectedAnnotationId: Option.none(),
        announcement: "All annotations cleared.",
      },
    }),
    ToggledJsonInspector: () => ({
      model: {
        ...model,
        isJsonInspectorOpen: !model.isJsonInspectorOpen,
        jsonDraft: model.isJsonInspectorOpen ? model.jsonDraft : documentJson(model),
        jsonError: "",
        announcement: model.isJsonInspectorOpen ? "JSON inspector closed." : "Annotation JSON ready to edit.",
      },
    }),
    ChangedJsonDraft: ({ value }) => ({ model: { ...model, jsonDraft: value, jsonError: "" } }),
    AppliedJsonDraft: () => {
      try {
        const document = parseAnnotationDocument(model.jsonDraft);
        const issues = validateAnnotationDocument(document).filter(({ severity }) => severity === "error");
        const pageCount = model.document._tag === "Ready" ? model.document.pageCount : undefined;
        const missingPages = pageCount !== undefined
          ? document.annotations.filter(({ pageIndex }) => pageIndex >= pageCount)
          : [];
        if (issues.length > 0) throw new Error(issues[0]?.message ?? "The annotation JSON is invalid.");
        if (missingPages.length > 0) throw new Error(`Page ${missingPages[0]!.pageIndex + 1} does not exist.`);
        const nextNames = new Set(importedFieldNames(document.annotations));
        const removedNames = importedFieldNames(model.annotations).filter((name) => !nextNames.has(name));
        return {
          model: {
            ...model,
            annotations: document.annotations,
            documentMetadata: document.metadata ?? {},
            deletedPdfFieldNames: [...new Set([...model.deletedPdfFieldNames, ...removedNames])],
            selectedAnnotationId: Option.none(),
            nextId: document.annotations.length + 1,
            jsonDraft: serializeAnnotationDocument(document),
            jsonError: "",
            announcement: "Annotation JSON applied.",
          },
        };
      } catch (error) {
        const reason = failureReason(error);
        return { model: { ...model, jsonError: reason, announcement: `JSON not applied. ${reason}` } };
      }
    },
    ResetJsonDraft: () => ({
      model: { ...model, jsonDraft: documentJson(model), jsonError: "", announcement: "JSON reset." },
    }),
    ClickedDownloadJson: () => ({
      model: { ...model, announcement: "Annotation JSON downloaded." },
      commands: [DownloadJson({
        sourceName: model.document._tag === "Ready" ? model.document.name : "document",
        json: documentJson(model),
      })],
    }),
    CompletedJsonDownload: () => ({ model }),
    ClickedDownload: () => model.document._tag !== "Ready"
      ? { model }
      : ({
          model: { ...model, exportStatus: "Exporting", announcement: "Creating the annotated PDF." },
          commands: [ExportPdf({
            bytesBase64: model.document.bytesBase64,
            annotations: model.annotations,
            deletedFieldNames: model.deletedPdfFieldNames,
            sourceName: model.document.name,
          })],
        }),
    CompletedExport: ({ succeeded, reason }) => ({
      model: {
        ...model,
        exportStatus: succeeded ? "Complete" : "Failed",
        announcement: succeeded
          ? `Annotated PDF downloaded.${reason === "" ? "" : ` ${reason}`}`
          : `The PDF could not be created. ${reason}`,
      },
    }),
  });
