import { Option } from "effect";
import { type Html, type HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { DragAndDrop, FileDrop } from "@foldkit/ui";
import {
  Braces,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Copy,
  Download,
  FileText,
  GripVertical,
  Highlighter,
  PenLine,
  Plus,
  Stamp,
  Trash2,
  Type,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "@lucide/icons";
import { Button, Icon } from "@foldworks/ui";
import type { LucideIconData } from "@lucide/icons";

import { annotationValueText } from "./document";
import {
  CANVAS_WIDTH,
  annotationIdFromItemId,
  annotationKindFromItemId,
  canvasHeight,
} from "./geometry";
import { Message } from "./message";
import type {
  Annotation,
  BuiltInAnnotationKind,
  Model,
  ResizeHandle,
} from "./model";

const palette: ReadonlyArray<Readonly<{
  kind: BuiltInAnnotationKind;
  label: string;
  description: string;
  icon: LucideIconData;
}>> = [
  { kind: "text", label: "Text", description: "Interactive text field", icon: Type },
  { kind: "signature", label: "Signature", description: "Signature region", icon: PenLine },
  { kind: "date", label: "Date", description: "Formatted date field", icon: CalendarDays },
  { kind: "checkbox", label: "Checkbox", description: "Boolean choice", icon: Check },
  { kind: "initials", label: "Initials", description: "Initials region", icon: PenLine },
  { kind: "radio", label: "Radio option", description: "One grouped option", icon: CircleDot },
  { kind: "select", label: "Select", description: "Choice field", icon: ChevronDown },
  { kind: "highlight", label: "Highlight", description: "Flattened markup", icon: Highlighter },
  { kind: "stamp", label: "Stamp", description: "Flattened status", icon: Stamp },
];

const resizeHandles: ReadonlyArray<ResizeHandle> = [
  "north-west",
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
];

const labelForKind = (kind: string): string =>
  palette.find((item) => item.kind === kind)?.label ?? kind.replace(/(^|-)([a-z])/g, (_, __, letter: string) => ` ${letter.toUpperCase()}`).trim();

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
    h.div([h.Class("fk-pdf-annotator__empty-mark")], [Icon.view({ icon: FileText, size: 24 }, h)]),
    h.h2([], [loading ? "Preparing your PDF" : failed ? "That PDF did not open" : "Annotate a PDF"]),
    h.p([], [
      loading
        ? `Rendering and inspecting ${model.document.name}…`
        : failed
          ? model.document.reason
          : "Create and edit interactive fields, inspect their JSON, and preserve custom metadata.",
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
      h.span([], ["Drag a tool onto the page"]),
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
          h.span([h.Class("fk-pdf-annotator__palette-icon")], [Icon.view({ icon: item.icon, size: 15 }, h)]),
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

const annotationContent = (annotation: Annotation, h: HtmlBuilder<Message>): Html => {
  switch (annotation.kind) {
    case "checkbox": return annotation.value === true
      ? Icon.view({ icon: Check, size: 18, strokeWidth: 3 }, h)
      : h.empty;
    case "radio": return h.span([h.Class("fk-pdf-annotator__radio-dot")], []);
    case "highlight": return h.span([h.Class("fk-pdf-annotator__sr-only")], ["Highlight"]);
    default: return h.span([], [annotationValueText(annotation) || annotation.name || labelForKind(annotation.kind)]);
  }
};

const keyToNudge = (annotationId: string, key: string, shiftKey: boolean) => {
  const direction = ({
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
  } as const)[key as "ArrowUp"];
  return direction === undefined
    ? Option.none()
    : Option.some(Message.NudgedAnnotation({ annotationId, direction, large: shiftKey }));
};

const annotationView = (
  model: Model,
  annotation: Annotation,
  index: number,
  h: HtmlBuilder<Message>,
): Html => {
  if (model.document._tag !== "Ready") return h.empty;
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
        left: `${annotation.rect.x / model.document.pageWidth * 100}%`,
        top: `${annotation.rect.y / model.document.pageHeight * 100}%`,
        width: `${annotation.rect.width / model.document.pageWidth * 100}%`,
        height: `${annotation.rect.height / model.document.pageHeight * 100}%`,
      }),
      h.DataAttribute("annotation-id", annotation.id),
      h.DataAttribute("annotation-name", annotation.name ?? ""),
      h.DataAttribute("selected", selected ? "true" : "false"),
      h.DataAttribute("kind", annotation.kind.toLowerCase()),
      h.DataAttribute("dragging", dragging ? "true" : "false"),
      h.DataAttribute("locked", annotation.locked === true ? "true" : "false"),
      h.OnClick(Message.SelectedAnnotation({ annotationId: annotation.id })),
    ],
    [
      h.div(
        [
          h.Class("fk-pdf-annotator__annotation"),
          h.Tabindex(0),
          h.Role("button"),
          h.AriaLabel(`${labelForKind(annotation.kind)} annotation${annotation.locked === true ? ", locked" : ""}. Drag to move; arrow keys to nudge.`),
          ...(annotation.locked === true ? [] : DragAndDrop.draggable({
            model: model.dragAndDrop,
            toParentMessage: toDragMessage,
            itemId: `annotation:${annotation.id}`,
            containerId: `${model.id}-canvas`,
            index,
          }, h)),
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
      selected && annotation.locked !== true
        ? h.div([h.Class("fk-pdf-annotator__resize-handles")], resizeHandles.map((handle) => h.span(
            [
              h.Class("fk-pdf-annotator__resize-handle"),
              h.DataAttribute("resize-handle", handle),
              h.Role("separator"),
              h.AriaLabel(`Resize ${labelForKind(annotation.kind)} annotation from ${handle}`),
              h.OnPointerDown((_pointerType, button, screenX, screenY) => button === 0
                ? Option.some(Message.StartedResize({
                    annotationId: annotation.id,
                    handle,
                    screenX,
                    screenY,
                  }))
                : Option.none()),
            ],
            [],
          )))
        : h.empty,
    ],
  );
};

const canvasView = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (model.document._tag !== "Ready") return emptyState(model, h);
  const document = model.document;
  const height = canvasHeight(document.pageWidth, document.pageHeight) * model.zoom;
  const width = CANVAS_WIDTH * model.zoom;
  const pageAnnotations = model.annotations.filter(
    (annotation) => annotation.pageIndex === document.currentPage - 1,
  );
  return h.div([h.Class("fk-pdf-annotator__stage")], [
    h.div(
      [
        h.Class("fk-pdf-annotator__page"),
        h.Style({ width: `${width}px`, height: `${height}px` }),
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
        ...pageAnnotations.map((annotation, index) => annotationView(model, annotation, index, h)),
        model.isRenderingPage
          ? h.div([h.Class("fk-pdf-annotator__page-loading")], ["Rendering page…"])
          : h.empty,
      ],
    ),
  ]);
};

const metadataText = (value: unknown): string => typeof value === "string"
  ? value
  : JSON.stringify(value);

const textField = (
  label: string,
  value: string,
  onInput: (value: string) => Message,
  h: HtmlBuilder<Message>,
): Html => h.label([h.Class("fk-pdf-annotator__field")], [
  h.span([], [label]),
  h.input([h.Type("text"), h.Value(value), h.OnInput(onInput)]),
]);

const numberField = (
  label: string,
  value: number,
  onInput: (value: number) => Message,
  h: HtmlBuilder<Message>,
): Html => h.label([h.Class("fk-pdf-annotator__number-field")], [
  h.span([], [label]),
  h.input([
    h.Type("number"),
    h.Value(String(Math.round(value * 100) / 100)),
    h.OnChange((next) => onInput(Number(next))),
  ]),
]);

const jsonInspector = (model: Model, h: HtmlBuilder<Message>): Html => h.aside(
  [h.Class("fk-pdf-annotator__inspector fk-pdf-annotator__json-inspector"), h.AriaLabel("Annotation JSON inspector")],
  [
    h.div([h.Class("fk-pdf-annotator__panel-heading fk-pdf-annotator__panel-heading--row")], [
      h.div([], [h.p([], ["Annotation JSON"]), h.span([], ["Schema version 1 · PDF points"])]),
      Button.view({ icon: X, ariaLabel: "Close JSON inspector", variant: "ghost", size: "icon", onClick: Message.ToggledJsonInspector() }, h),
    ]),
    h.textarea([
      h.Class("fk-pdf-annotator__json-editor"),
      h.AriaLabel("Annotation document JSON"),
      h.Spellcheck(false),
      h.OnInput((value) => Message.ChangedJsonDraft({ value })),
    ], [model.jsonDraft]),
    model.jsonError === ""
      ? h.p([h.Class("fk-pdf-annotator__json-help")], ["Edit the complete versioned document, including custom kinds and metadata."])
      : h.p([h.Class("fk-pdf-annotator__json-error"), h.Role("alert")], [model.jsonError]),
    h.div([h.Class("fk-pdf-annotator__json-actions")], [
      Button.view({ label: "Apply JSON", size: "sm", onClick: Message.AppliedJsonDraft() }, h),
      Button.view({ label: "Reset", variant: "ghost", size: "sm", onClick: Message.ResetJsonDraft() }, h),
      Button.view({ label: "Download", icon: Download, variant: "ghost", size: "sm", onClick: Message.ClickedDownloadJson() }, h),
    ]),
  ],
);

const inspectorView = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (model.isJsonInspectorOpen) return jsonInspector(model, h);
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
            h.p([], ["Select an annotation to inspect its fields, geometry, and custom data."]),
          ]),
        ]
      : [
          h.div([h.Class("fk-pdf-annotator__panel-heading")], [
            h.p([], [labelForKind(annotation.kind)]),
            h.span([], [`${annotation.id} · Page ${annotation.pageIndex + 1}`]),
          ]),
          textField("Field name", annotation.name ?? "", (name) =>
            Message.ChangedAnnotationName({ annotationId: annotation.id, name }), h),
          annotation.kind === "highlight"
            ? h.empty
            : textField("Value", annotationValueText(annotation), (value) =>
                Message.ChangedAnnotationValue({ annotationId: annotation.id, value }), h),
          h.div([h.Class("fk-pdf-annotator__checks")], [
            ...(["required", "readOnly", "locked"] as const).map((property) => h.label([], [
              h.input([
                h.Type("checkbox"),
                h.Checked(annotation[property] === true),
                h.OnClick(Message.ChangedAnnotationFlag({
                  annotationId: annotation.id,
                  property,
                  value: annotation[property] !== true,
                })),
              ]),
              property === "readOnly" ? "Read only" : property[0]!.toUpperCase() + property.slice(1),
            ])),
          ]),
          h.div([h.Class("fk-pdf-annotator__section-heading")], [h.strong([], ["Position and size"]), h.span([], ["PDF points"])]),
          h.div([h.Class("fk-pdf-annotator__geometry-fields")], [
            numberField("X", annotation.rect.x, (value) => Message.ChangedAnnotationGeometry({ annotationId: annotation.id, property: "x", value }), h),
            numberField("Y", annotation.rect.y, (value) => Message.ChangedAnnotationGeometry({ annotationId: annotation.id, property: "y", value }), h),
            numberField("Width", annotation.rect.width, (value) => Message.ChangedAnnotationGeometry({ annotationId: annotation.id, property: "width", value }), h),
            numberField("Height", annotation.rect.height, (value) => Message.ChangedAnnotationGeometry({ annotationId: annotation.id, property: "height", value }), h),
            numberField("Page", annotation.pageIndex + 1, (value) => Message.ChangedAnnotationPage({ annotationId: annotation.id, pageIndex: value - 1 }), h),
          ]),
          h.div([h.Class("fk-pdf-annotator__section-heading fk-pdf-annotator__section-heading--metadata")], [
            h.strong([], ["Custom data"]),
            Button.view({ icon: Plus, ariaLabel: "Add custom attribute", variant: "ghost", size: "icon", onClick: Message.AddedAnnotationMetadata({ annotationId: annotation.id }) }, h),
          ]),
          h.div([h.Class("fk-pdf-annotator__metadata")], [
            ...Object.entries(annotation.metadata ?? {}).map(([key, value]) => h.div([h.Class("fk-pdf-annotator__metadata-row")], [
              h.input([
                h.AriaLabel("Attribute name"),
                h.Value(key),
                h.OnChange((nextKey) => Message.RenamedAnnotationMetadata({ annotationId: annotation.id, key, nextKey })),
              ]),
              h.input([
                h.AriaLabel(`${key} value`),
                h.Value(metadataText(value)),
                h.OnChange((nextValue) => Message.ChangedAnnotationMetadata({ annotationId: annotation.id, key, value: nextValue })),
              ]),
              Button.view({ icon: X, ariaLabel: `Delete ${key} attribute`, variant: "ghost", size: "icon", onClick: Message.DeletedAnnotationMetadata({ annotationId: annotation.id, key }) }, h),
            ])),
            Object.keys(annotation.metadata ?? {}).length === 0
              ? h.p([h.Class("fk-pdf-annotator__metadata-empty")], ["No custom attributes."])
              : h.empty,
          ]),
          h.p([h.Class("fk-pdf-annotator__shortcut")], ["Arrow keys nudge by 1 pt. Hold Shift for 10 pt."]),
          h.div([h.Class("fk-pdf-annotator__inspector-actions")], [
            Button.view({
              label: "Duplicate",
              icon: Copy,
              variant: "ghost",
              size: "sm",
              onClick: Message.DuplicatedAnnotation({ annotationId: annotation.id }),
            }, h),
            Button.view({
              label: "Delete",
              icon: Trash2,
              variant: "danger",
              size: "sm",
              onClick: Message.DeletedAnnotation({ annotationId: annotation.id }),
            }, h),
          ]),
        ],
  );
};

const toolbarView = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (model.document._tag !== "Ready") return h.empty;
  const document = model.document;
  return h.div([h.Class("fk-pdf-annotator__toolbar")], [
    h.div([h.Class("fk-pdf-annotator__document")], [
      h.span([h.Class("fk-pdf-annotator__document-icon")], [Icon.view({ icon: FileText, size: 15 }, h)]),
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
      h.span([h.Class("fk-pdf-annotator__page-label")], [`Page ${document.currentPage} of ${document.pageCount}`]),
      Button.view({
        icon: ChevronRight,
        ariaLabel: "Next page",
        variant: "ghost",
        size: "icon",
        isDisabled: document.currentPage >= document.pageCount || model.isRenderingPage,
        onClick: Message.RequestedPage({ page: document.currentPage + 1 }),
      }, h),
      h.span([h.Class("fk-pdf-annotator__control-divider"), h.AriaHidden(true)], []),
      Button.view({
        icon: ZoomOut,
        ariaLabel: "Zoom out",
        variant: "ghost",
        size: "icon",
        isDisabled: model.zoom <= 0.25,
        onClick: Message.ChangedZoom({ zoom: model.zoom - 0.25 }),
      }, h),
      Button.view({
        label: `${Math.round(model.zoom * 100)}%`,
        ariaLabel: "Reset zoom to 100 percent",
        variant: "ghost",
        size: "sm",
        onClick: Message.ChangedZoom({ zoom: 1 }),
      }, h),
      Button.view({
        icon: ZoomIn,
        ariaLabel: "Zoom in",
        variant: "ghost",
        size: "icon",
        isDisabled: model.zoom >= 4,
        onClick: Message.ChangedZoom({ zoom: model.zoom + 0.25 }),
      }, h),
    ]),
    h.div([h.Class("fk-pdf-annotator__toolbar-actions")], [
      uploadControl(model, "compact", h),
      Button.view({
        label: "JSON",
        icon: Braces,
        variant: model.isJsonInspectorOpen ? "secondary" : "ghost",
        size: "sm",
        onClick: Message.ToggledJsonInspector(),
      }, h),
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
    h.div([h.Class("fk-pdf-annotator__sr-only"), h.AriaLive("polite")], [model.announcement]),
  ],
));
