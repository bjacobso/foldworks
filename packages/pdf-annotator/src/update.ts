import { Effect, Option, Schema as S } from "effect";
import { Command, Update } from "foldkit";
import * as BrowserFile from "foldkit/file";

import { DragAndDrop, FileDrop } from "@foldkit/ui";
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
  AnnotationKind,
  DocumentState,
  MoveState,
  ResizeState,
  type Model,
} from "./model";
import {
  base64ToBytes,
  bytesToBase64,
  exportAnnotatedPdf,
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
    const rendered = await renderPdfPage(bytes, 1);
    return Message.CompletedLoadPdf({
      name,
      bytesBase64: bytesToBase64(bytes),
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
    kind: AnnotationKind,
    clientX: S.Number,
    clientY: S.Number,
  },
  messages: [Message.CompletedCanvasDrop],
  execute: ({ canvasId, kind, clientX, clientY }) => Effect.sync(() => {
    const canvas = document.querySelector<HTMLElement>(
      `[data-pdf-canvas-id="${CSS.escape(canvasId)}"]`,
    );
    if (canvas === null) {
      return Message.CompletedCanvasDrop({ kind, x: 0.5, y: 0.5 });
    }
    const rect = canvas.getBoundingClientRect();
    return Message.CompletedCanvasDrop({
      kind,
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
    });
  }),
});

const ExportPdf = Command.define("ExportAnnotatedPdf", {
  args: {
    bytesBase64: S.String,
    annotations: S.Array(Annotation),
    sourceName: S.String,
  },
  messages: [Message.CompletedExport],
  execute: ({ bytesBase64, annotations, sourceName }) => Effect.tryPromise({
    try: async () => {
      await exportAnnotatedPdf(base64ToBytes(bytesBase64), annotations, sourceName);
      return Message.CompletedExport({ succeeded: true, reason: "" });
    },
    catch: (error) => error,
  }).pipe(
    Effect.catch((error) => Effect.succeed(Message.CompletedExport({
      succeeded: false,
      reason: failureReason(error),
    }))),
  ),
});

const currentPage = (model: Model): number =>
  model.document._tag === "Ready" ? model.document.currentPage : 1;

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
        x: model.moveState._tag === "Moving" ? model.moveState.originX : annotation.x,
        y: model.moveState._tag === "Moving" ? model.moveState.originY : annotation.y,
      }))
    : model;

const addAnnotation = (
  model: Model,
  kind: AnnotationKind,
  x: number,
  y: number,
): Model => {
  if (model.document._tag !== "Ready") return model;
  const id = `annotation-${model.nextId}`;
  return {
    ...model,
    annotations: [
      ...model.annotations,
      defaultAnnotation(id, kind, model.document.currentPage, x, y),
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
    if (annotation !== undefined) {
      next = {
        ...next,
        selectedAnnotationId: Option.some(annotation.id),
        moveState: MoveState.Moving({
          annotationId: annotation.id,
          originX: annotation.x,
          originY: annotation.y,
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
      const height = canvasHeight(model.document.pageWidth, model.document.pageHeight);
      next = updateAnnotation(next, next.moveState.annotationId, (annotation) =>
        moveAnnotation(
          annotation,
          next.moveState._tag === "Moving" ? next.moveState.originX : annotation.x,
          next.moveState._tag === "Moving" ? next.moveState.originY : annotation.y,
          (childMessage.screenX - origin.screenX) / CANVAS_WIDTH,
          (childMessage.screenY - origin.screenY) / height,
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
    if (kind !== undefined && outMessage.toContainerId === `${model.id}-canvas`) {
      if (previousDrag._tag === "KeyboardDragging") {
        return { model: addAnnotation(next, kind, 0.5, 0.5) };
      }
      return {
        model: { ...next, moveState: MoveState.Idle() },
        commands: [ResolveCanvasDrop({
          canvasId: model.id,
          kind,
          clientX: model.lastPointerClientX,
          clientY: model.lastPointerClientY,
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
        document: DocumentState.Failed({
          name: file.name,
          reason: "Choose a PDF file.",
        }),
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
      annotations: [],
      selectedAnnotationId: Option.none(),
      announcement: `Loading ${file.name}.`,
    },
    commands: [LoadPdfFile({ file })],
  };
};

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
          annotations: [],
          selectedAnnotationId: Option.none(),
          announcement: "Loading the sample PDF.",
        },
        commands: [LoadPdfUrl({ url, name: "foldworks-sample.pdf" })],
      }),
    }),
    CompletedLoadPdf: (loaded) => ({
      model: {
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
        annotations: [],
        selectedAnnotationId: Option.none(),
        nextId: 1,
        isRenderingPage: false,
        exportStatus: "Idle",
        announcement: `${loaded.name} loaded with ${loaded.pageCount} pages.`,
      },
    }),
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
        commands: [RenderPage({
          bytesBase64: model.document.bytesBase64,
          page: target,
        })],
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
    CompletedCanvasDrop: ({ kind, x, y }) => ({
      model: addAnnotation(model, kind, x, y),
    }),
    SelectedAnnotation: ({ annotationId }) => ({
      model: {
        ...model,
        selectedAnnotationId: Option.some(annotationId),
        announcement: `${model.annotations.find((item) => item.id === annotationId)?.kind ?? "Annotation"} selected.`,
      },
    }),
    StartedResize: ({ annotationId, screenX, screenY }) => {
      const annotation = model.annotations.find((item) => item.id === annotationId);
      return annotation === undefined
        ? { model }
        : ({
            model: {
              ...model,
              selectedAnnotationId: Option.some(annotationId),
              resizeState: ResizeState.Resizing({
                annotationId,
                originScreenX: screenX,
                originScreenY: screenY,
                originWidth: annotation.width,
                originHeight: annotation.height,
              }),
            },
          });
    },
    MovedResize: ({ screenX, screenY }) => {
      if (model.resizeState._tag !== "Resizing" || model.document._tag !== "Ready") {
        return { model };
      }
      const height = canvasHeight(model.document.pageWidth, model.document.pageHeight);
      return {
        model: updateAnnotation(model, model.resizeState.annotationId, (annotation) =>
          resizeAnnotation(
            annotation,
            model.resizeState._tag === "Resizing"
              ? model.resizeState.originWidth + (screenX - model.resizeState.originScreenX) / CANVAS_WIDTH
              : annotation.width,
            model.resizeState._tag === "Resizing"
              ? model.resizeState.originHeight + (screenY - model.resizeState.originScreenY) / height
              : annotation.height,
          )
        ),
      };
    },
    FinishedResize: () => ({
      model: {
        ...model,
        resizeState: ResizeState.Idle(),
        announcement: "Annotation resized.",
      },
    }),
    ChangedAnnotationValue: ({ annotationId, value }) => ({
      model: updateAnnotation(model, annotationId, (annotation) => ({ ...annotation, value })),
    }),
    NudgedAnnotation: ({ annotationId, direction, large }) => {
      const step = large ? 10 : 1;
      const pageHeight = model.document._tag === "Ready"
        ? canvasHeight(model.document.pageWidth, model.document.pageHeight)
        : CANVAS_WIDTH;
      const delta = {
        Up: [0, -step / pageHeight],
        Down: [0, step / pageHeight],
        Left: [-step / CANVAS_WIDTH, 0],
        Right: [step / CANVAS_WIDTH, 0],
      }[direction] ?? [0, 0];
      return {
        model: updateAnnotation(model, annotationId, (annotation) =>
          moveAnnotation(annotation, annotation.x, annotation.y, delta[0] ?? 0, delta[1] ?? 0)
        ),
      };
    },
    DeletedAnnotation: ({ annotationId }) => ({
      model: {
        ...model,
        annotations: model.annotations.filter((annotation) => annotation.id !== annotationId),
        selectedAnnotationId: Option.none(),
        announcement: "Annotation deleted.",
      },
    }),
    ClickedClearAnnotations: () => ({
      model: {
        ...model,
        annotations: [],
        selectedAnnotationId: Option.none(),
        announcement: "All annotations cleared.",
      },
    }),
    ClickedDownload: () => model.document._tag !== "Ready"
      ? { model }
      : ({
          model: {
            ...model,
            exportStatus: "Exporting",
            announcement: "Creating the annotated PDF.",
          },
          commands: [ExportPdf({
            bytesBase64: model.document.bytesBase64,
            annotations: model.annotations,
            sourceName: model.document.name,
          })],
        }),
    CompletedExport: ({ succeeded, reason }) => ({
      model: {
        ...model,
        exportStatus: succeeded ? "Complete" : "Failed",
        announcement: succeeded
          ? "Annotated PDF downloaded."
          : `The PDF could not be created. ${reason}`,
      },
    }),
  });
