import { Option } from "effect";
import { type Html, type HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { DragAndDrop, FileDrop } from "@foldkit/ui";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  GripVertical,
  Highlighter,
  PenLine,
  Stamp,
  Trash2,
  Type,
  Upload,
} from "@lucide/icons";
import { Button, Icon } from "@foldworks/ui";
import type { LucideIconData } from "@lucide/icons";

import {
  CANVAS_WIDTH,
  annotationIdFromItemId,
  annotationKindFromItemId,
  canvasHeight,
} from "./geometry";
import { Message } from "./message";
import type { Annotation, AnnotationKind, Model } from "./model";

const palette: ReadonlyArray<Readonly<{
  kind: AnnotationKind;
  label: string;
  description: string;
  icon: LucideIconData;
}>> = [
  { kind: "Text", label: "Text", description: "Short copy or initials", icon: Type },
  { kind: "Signature", label: "Signature", description: "Typed signature", icon: PenLine },
  { kind: "Date", label: "Date", description: "Current date", icon: CalendarDays },
  { kind: "Checkmark", label: "Checkmark", description: "Mark an approval", icon: Check },
  { kind: "Highlight", label: "Highlight", description: "Emphasize a passage", icon: Highlighter },
  { kind: "Stamp", label: "Stamp", description: "Approval status", icon: Stamp },
];

const toDragMessage = (message: DragAndDrop.Message): Message =>
  Message.GotDragMessage({ message });

const uploadControl = (
  model: Model,
  appearance: "empty" | "compact",
  h: HtmlBuilder<Message>,
): Html => h.submodel({
  slotId: `${model.id}-upload-${appearance}`,
  model: model.fileDrop,
  view: FileDrop.view,
  viewInputs: {
    accept: ["application/pdf", ".pdf"],
    toView: (attributes) => h.label(
      [
        ...attributes.root,
        h.Class(`fk-pdf-annotator__upload fk-pdf-annotator__upload--${appearance}`),
      ],
      [
        h.input([...attributes.input]),
        h.span([h.Class("fk-pdf-annotator__upload-icon")], [
          Icon.view({ icon: Upload, size: appearance === "empty" ? 20 : 14 }, h),
        ]),
        h.span([], [appearance === "empty" ? "Choose or drop a PDF" : "Replace PDF"]),
        appearance === "empty"
          ? h.span([h.Class("fk-pdf-annotator__upload-hint")], ["Up to 25 MB"])
          : h.empty,
      ],
    ),
  },
  toParentMessage: (message) => Message.GotFileDropMessage({ message }),
});

const emptyState = (model: Model, h: HtmlBuilder<Message>): Html => {
  const failed = model.document._tag === "Failed";
  const loading = model.document._tag === "Loading";
  return h.div([h.Class("fk-pdf-annotator__empty")], [
    h.div([h.Class("fk-pdf-annotator__empty-mark")], [
      Icon.view({ icon: FileText, size: 24 }, h),
    ]),
    h.h2([], [loading ? "Preparing your PDF" : failed ? "That PDF did not open" : "Annotate a PDF"]),
    h.p([], [
      loading
        ? `Rendering ${model.document.name}…`
        : failed
          ? model.document.reason
          : "Add text, signatures, dates, highlights, checks, and approval stamps.",
    ]),
    loading ? h.div([h.Class("fk-pdf-annotator__loader")]) : uploadControl(model, "empty", h),
    !loading && Option.isSome(model.sampleUrl)
      ? Button.view({
          label: failed ? "Open sample instead" : "Try the sample document",
          variant: "ghost",
          size: "sm",
          onClick: Message.ClickedLoadSample(),
        }, h)
      : h.empty,
  ]);
};

const paletteView = (model: Model, h: HtmlBuilder<Message>): Html => h.aside(
  [h.Class("fk-pdf-annotator__palette"), h.AriaLabel("PDF annotation tools")],
  [
    h.div([h.Class("fk-pdf-annotator__panel-heading")], [
      h.p([], ["Annotations"]),
      h.span([], ["Drag onto the page"]),
    ]),
    h.ul([h.Class("fk-pdf-annotator__palette-list")],
      palette.map((item, index) => h.keyed("li")(
        item.kind,
        [
          h.Class("fk-pdf-annotator__palette-item"),
          ...DragAndDrop.draggable({
            model: model.dragAndDrop,
            toParentMessage: toDragMessage,
            itemId: `palette:${item.kind}`,
            containerId: `${model.id}-palette`,
            index,
          }, h),
        ],
        [
          h.span([h.Class("fk-pdf-annotator__palette-icon")], [
            Icon.view({ icon: item.icon, size: 15 }, h),
          ]),
          h.span([h.Class("fk-pdf-annotator__palette-copy")], [
            h.strong([], [item.label]),
            h.small([], [item.description]),
          ]),
          h.span([h.Class("fk-pdf-annotator__grip"), h.AriaHidden(true)], [
            Icon.view({ icon: GripVertical, size: 14 }, h),
          ]),
        ],
      )),
    ),
  ],
);

const annotationContent = (
  annotation: Annotation,
  h: HtmlBuilder<Message>,
): Html => {
  switch (annotation.kind) {
    case "Checkmark": return Icon.view({ icon: Check, size: 18, strokeWidth: 3 }, h);
    case "Highlight": return h.span([h.Class("fk-pdf-annotator__sr-only")], ["Highlight"]);
    default: return h.span([], [annotation.value]);
  }
};

const keyToNudge = (
  annotationId: string,
  key: string,
  shiftKey: boolean,
) => {
  const direction = ({
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
  } as const)[key as "ArrowUp"];
  return direction === undefined
    ? Option.none()
    : Option.some(Message.NudgedAnnotation({
        annotationId,
        direction,
        large: shiftKey,
      }));
};

const annotationView = (
  model: Model,
  annotation: Annotation,
  index: number,
  h: HtmlBuilder<Message>,
): Html => {
  const selected = Option.contains(model.selectedAnnotationId, annotation.id);
  const dragging = Option.exists(
    DragAndDrop.maybeDraggedItemId(model.dragAndDrop),
    (itemId) => annotationIdFromItemId(itemId) === annotation.id,
  );
  return h.keyed("div")(
    annotation.id,
    [
      h.Class("fk-pdf-annotator__annotation-wrap"),
      h.Style({
        left: `${annotation.x * 100}%`,
        top: `${annotation.y * 100}%`,
        width: `${annotation.width * 100}%`,
        height: `${annotation.height * 100}%`,
      }),
      h.DataAttribute("selected", selected ? "true" : "false"),
      h.DataAttribute("kind", annotation.kind.toLowerCase()),
      h.DataAttribute("dragging", dragging ? "true" : "false"),
      h.OnClick(Message.SelectedAnnotation({ annotationId: annotation.id })),
    ],
    [
      h.div(
        [
          h.Class("fk-pdf-annotator__annotation"),
          h.Tabindex(0),
          h.Role("button"),
          h.AriaLabel(`${annotation.kind} annotation. Drag to move; arrow keys to nudge.`),
          ...DragAndDrop.draggable({
            model: model.dragAndDrop,
            toParentMessage: toDragMessage,
            itemId: `annotation:${annotation.id}`,
            containerId: `${model.id}-canvas`,
            index,
          }, h),
          h.OnKeyDownPreventDefault((key, modifiers) => {
            if (key === "Delete" || key === "Backspace") {
              return Option.some(Message.DeletedAnnotation({ annotationId: annotation.id }));
            }
            return model.dragAndDrop.dragState._tag === "Idle"
              ? keyToNudge(annotation.id, key, modifiers.shiftKey)
              : Option.none();
          }),
        ],
        [annotationContent(annotation, h)],
      ),
      selected
        ? h.span(
            [
              h.Class("fk-pdf-annotator__resize-handle"),
              h.Role("separator"),
              h.AriaLabel(`Resize ${annotation.kind} annotation`),
              h.OnPointerDown((_pointerType, button, screenX, screenY) =>
                button === 0
                  ? Option.some(Message.StartedResize({
                      annotationId: annotation.id,
                      screenX,
                      screenY,
                    }))
                  : Option.none()
              ),
            ],
            [],
          )
        : h.empty,
    ],
  );
};

const canvasView = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (model.document._tag !== "Ready") return emptyState(model, h);
  const document = model.document;
  const height = canvasHeight(document.pageWidth, document.pageHeight);
  const pageAnnotations = model.annotations.filter(
    (annotation) => annotation.page === document.currentPage,
  );
  return h.div([h.Class("fk-pdf-annotator__stage")], [
    h.div(
      [
        h.Class("fk-pdf-annotator__page"),
        h.Style({ width: `${CANVAS_WIDTH}px`, height: `${height}px` }),
        h.DataAttribute("pdf-canvas-id", model.id),
        ...DragAndDrop.droppable(`${model.id}-canvas`, `PDF page ${document.currentPage}`),
      ],
      [
        h.img([
          h.Class("fk-pdf-annotator__page-image"),
          h.Src(document.previewDataUrl),
          h.Alt(`Page ${document.currentPage} of ${document.name}`),
          h.Draggable(false),
        ]),
        ...pageAnnotations.map((annotation, index) =>
          annotationView(model, annotation, index, h)
        ),
        model.isRenderingPage
          ? h.div([h.Class("fk-pdf-annotator__page-loading")], ["Rendering page…"])
          : h.empty,
      ],
    ),
  ]);
};

const inspectorView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const selectedId = Option.getOrUndefined(model.selectedAnnotationId);
  const annotation = model.annotations.find((item) => item.id === selectedId);
  return h.aside(
    [h.Class("fk-pdf-annotator__inspector"), h.AriaLabel("Annotation properties")],
    annotation === undefined
      ? [
          h.div([h.Class("fk-pdf-annotator__panel-heading")], [
            h.p([], ["Properties"]),
            h.span([], ["Select an annotation"]),
          ]),
          h.div([h.Class("fk-pdf-annotator__inspector-empty")], [
            h.span([], ["Nothing selected"]),
            h.p([], ["Select an annotation to edit its value or remove it."]),
          ]),
        ]
      : [
          h.div([h.Class("fk-pdf-annotator__panel-heading")], [
            h.p([], [annotation.kind]),
            h.span([], [`Page ${annotation.page}`]),
          ]),
          annotation.kind === "Highlight" || annotation.kind === "Checkmark"
            ? h.empty
            : h.label([h.Class("fk-pdf-annotator__field")], [
                h.span([], [annotation.kind === "Stamp" ? "Label" : "Value"]),
                h.input([
                  h.Type("text"),
                  h.Value(annotation.value),
                  h.OnInput((value) => Message.ChangedAnnotationValue({
                    annotationId: annotation.id,
                    value,
                  })),
                ]),
              ]),
          h.div([h.Class("fk-pdf-annotator__geometry")], [
            h.div([], [h.span([], ["Width"]), h.strong([], [`${Math.round(annotation.width * 100)}%`])]),
            h.div([], [h.span([], ["Height"]), h.strong([], [`${Math.round(annotation.height * 100)}%`])]),
          ]),
          h.p([h.Class("fk-pdf-annotator__shortcut")], [
            "Arrow keys nudge 1 px. Hold Shift for 10 px.",
          ]),
          Button.view({
            label: "Delete annotation",
            icon: Trash2,
            variant: "danger",
            size: "sm",
            isFullWidth: true,
            onClick: Message.DeletedAnnotation({ annotationId: annotation.id }),
          }, h),
        ],
  );
};

const toolbarView = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (model.document._tag !== "Ready") return h.empty;
  const document = model.document;
  return h.div([h.Class("fk-pdf-annotator__toolbar")], [
    h.div([h.Class("fk-pdf-annotator__document")], [
      h.span([h.Class("fk-pdf-annotator__document-icon")], [
        Icon.view({ icon: FileText, size: 15 }, h),
      ]),
      h.div([], [
        h.strong([], [document.name]),
        h.span([], [`${model.annotations.length} annotation${model.annotations.length === 1 ? "" : "s"}`]),
      ]),
    ]),
    h.div([h.Class("fk-pdf-annotator__page-controls")], [
      Button.view({
        icon: ChevronLeft,
        ariaLabel: "Previous page",
        variant: "ghost",
        size: "icon",
        isDisabled: document.currentPage <= 1 || model.isRenderingPage,
        onClick: Message.RequestedPage({ page: document.currentPage - 1 }),
      }, h),
      h.span([], [`Page ${document.currentPage} of ${document.pageCount}`]),
      Button.view({
        icon: ChevronRight,
        ariaLabel: "Next page",
        variant: "ghost",
        size: "icon",
        isDisabled: document.currentPage >= document.pageCount || model.isRenderingPage,
        onClick: Message.RequestedPage({ page: document.currentPage + 1 }),
      }, h),
    ]),
    h.div([h.Class("fk-pdf-annotator__toolbar-actions")], [
      uploadControl(model, "compact", h),
      Button.view({
        label: "Clear",
        variant: "ghost",
        size: "sm",
        isDisabled: model.annotations.length === 0,
        onClick: Message.ClickedClearAnnotations(),
      }, h),
      Button.view({
        label: model.exportStatus === "Exporting" ? "Creating…" : "Download PDF",
        icon: Download,
        size: "sm",
        isDisabled: model.exportStatus === "Exporting",
        onClick: Message.ClickedDownload(),
      }, h),
    ]),
  ]);
};

const ghostView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const ghostStyle = Option.getOrUndefined(DragAndDrop.ghostStyle(model.dragAndDrop));
  const itemId = Option.getOrUndefined(DragAndDrop.maybeDraggedItemId(model.dragAndDrop));
  if (ghostStyle === undefined || itemId === undefined) return h.empty;
  const kind = annotationKindFromItemId(itemId) ?? model.annotations.find(
    (annotation) => annotation.id === annotationIdFromItemId(itemId),
  )?.kind;
  if (kind === undefined) return h.empty;
  const definition = palette.find((item) => item.kind === kind);
  return h.div(
    [h.Class("fk-pdf-annotator__ghost"), h.Style(ghostStyle), h.AriaHidden(true)],
    [
      definition === undefined ? h.empty : Icon.view({ icon: definition.icon, size: 14 }, h),
      definition?.label ?? kind,
    ],
  );
};

export const view = defineView<Model, Message>((model, h) => h.div(
  [
    h.Class("fk-pdf-annotator"),
    h.DataAttribute("document-state", model.document._tag.toLowerCase()),
    h.DataAttribute("dragging", DragAndDrop.isDragging(model.dragAndDrop) ? "true" : "false"),
  ],
  [
    toolbarView(model, h),
    model.document._tag === "Ready"
      ? h.div([h.Class("fk-pdf-annotator__workspace")], [
          paletteView(model, h),
          canvasView(model, h),
          inspectorView(model, h),
        ])
      : emptyState(model, h),
    ghostView(model, h),
    h.div([h.Class("fk-pdf-annotator__sr-only"), h.AriaLive("polite")], [
      model.announcement,
    ]),
  ],
));
