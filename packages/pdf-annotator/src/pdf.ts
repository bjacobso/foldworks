/// <reference path="./vite-env.d.ts" />

import { Schema as S } from "effect";
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFHexString,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  StandardFonts,
  rgb,
  type PDFField,
  type PDFPage,
} from "pdf-lib";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { annotationValueText } from "./document";
import type { Annotation } from "./model";

export type RenderedPage = Readonly<{
  pageCount: number;
  page: number;
  pageWidth: number;
  pageHeight: number;
  previewDataUrl: string;
}>;

export type PdfWarning = Readonly<{
  code: string;
  message: string;
  annotationId?: string;
}>;

export type ExtractedPdfAnnotations = Readonly<{
  annotations: ReadonlyArray<Annotation>;
  warnings: ReadonlyArray<PdfWarning>;
}>;

export type SerializedPdf = Readonly<{
  bytes: Uint8Array;
  warnings: ReadonlyArray<PdfWarning>;
}>;

type RawPdfRect = Readonly<{ x: number; y: number; width: number; height: number }>;

const packageMetadataKey = PDFName.of("FoldworksAnnotation");

type FieldSemanticMetadata = Readonly<{
  id?: string;
  kind?: string;
  metadata?: S.JsonObject;
}>;

const readFieldSemanticMetadata = (field: PDFField): FieldSemanticMetadata => {
  try {
    const encoded = field.acroField.dict.get(packageMetadataKey);
    if (!(encoded instanceof PDFHexString)) return {};
    const value: unknown = JSON.parse(encoded.decodeText());
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    const record = value as Record<string, unknown>;
    return {
      ...(typeof record.id === "string" ? { id: record.id } : {}),
      ...(typeof record.kind === "string" ? { kind: record.kind } : {}),
      ...(typeof record.metadata === "object" && record.metadata !== null && !Array.isArray(record.metadata)
        ? { metadata: S.decodeUnknownSync(S.JsonObject)(record.metadata) }
        : {}),
    };
  } catch {
    return {};
  }
};

const writeFieldSemanticMetadata = (field: PDFField, annotation: Annotation): void => {
  const metadata = Object.fromEntries(
    Object.entries(annotation.metadata ?? {}).filter(([key]) => key !== "pdfWidgetIndex"),
  );
  field.acroField.dict.set(packageMetadataKey, PDFHexString.fromText(JSON.stringify({
    schemaVersion: 1,
    id: annotation.id,
    kind: annotation.kind,
    metadata,
  })));
};

const normalizedRotation = (page: PDFPage): 0 | 90 | 180 | 270 => {
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  return angle === 90 || angle === 180 || angle === 270 ? angle : 0;
};

/** Convert a raw bottom-left PDF rectangle to displayed top-left PDF points. */
const toCanonicalRect = (page: PDFPage, raw: RawPdfRect): RawPdfRect => {
  const crop = page.getCropBox();
  const x = raw.x - crop.x;
  const y = raw.y - crop.y;
  switch (normalizedRotation(page)) {
    case 90: return { x: y, y: x, width: raw.height, height: raw.width };
    case 180: return {
      x: crop.width - x - raw.width,
      y,
      width: raw.width,
      height: raw.height,
    };
    case 270: return {
      x: crop.height - y - raw.height,
      y: crop.width - x - raw.width,
      width: raw.height,
      height: raw.width,
    };
    default: return {
      x,
      y: crop.height - y - raw.height,
      width: raw.width,
      height: raw.height,
    };
  }
};

/** Convert displayed top-left PDF points back to a raw PDF rectangle. */
const toRawRect = (page: PDFPage, annotation: Annotation): RawPdfRect => {
  const crop = page.getCropBox();
  const rect = annotation.rect;
  switch (normalizedRotation(page)) {
    case 90: return {
      x: crop.x + rect.y,
      y: crop.y + rect.x,
      width: rect.height,
      height: rect.width,
    };
    case 180: return {
      x: crop.x + crop.width - rect.x - rect.width,
      y: crop.y + rect.y,
      width: rect.width,
      height: rect.height,
    };
    case 270: return {
      x: crop.x + crop.width - rect.y - rect.height,
      y: crop.y + crop.height - rect.x - rect.width,
      width: rect.height,
      height: rect.width,
    };
    default: return {
      x: crop.x + rect.x,
      y: crop.y + crop.height - rect.y - rect.height,
      width: rect.width,
      height: rect.height,
    };
  }
};

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

export const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const renderPdfPage = async (
  bytes: Uint8Array,
  requestedPage: number,
): Promise<RenderedPage> => {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  // PDF.js transfers the supplied buffer to its worker. Keep the component's
  // source bytes intact for page changes, extraction, and export.
  const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
  try {
    const document = await loadingTask.promise;
    const pageNumber = Math.min(document.numPages, Math.max(1, requestedPage));
    const page = await document.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const renderWidth = 1440;
    const viewport = page.getViewport({ scale: renderWidth / baseViewport.width });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (context === null) throw new Error("Canvas rendering is not available.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return {
      pageCount: document.numPages,
      page: pageNumber,
      pageWidth: baseViewport.width,
      pageHeight: baseViewport.height,
      previewDataUrl: canvas.toDataURL("image/png"),
    };
  } finally {
    await loadingTask.destroy();
  }
};

const uniqueId = (
  name: string,
  widgetIndex: number,
  used: Set<string>,
  semanticId?: string,
): string => {
  const candidate = semanticId === undefined
    ? `${name || "field"}-${widgetIndex + 1}`
    : widgetIndex === 0 ? semanticId : `${semanticId}-${widgetIndex + 1}`;
  const base = candidate
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || `field-${widgetIndex + 1}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
};

const fieldDescription = (field: PDFField): Readonly<{
  kind: string;
  fieldType?: "text" | "checkbox" | "radio" | "choice" | "signature";
  value?: string | boolean | ReadonlyArray<string>;
  metadata?: Record<string, S.Json>;
}> => {
  if (field instanceof PDFTextField) {
    return {
      kind: "text",
      fieldType: "text",
      value: field.getText() ?? "",
      metadata: { multiline: field.isMultiline() },
    };
  }
  if (field instanceof PDFCheckBox) {
    return { kind: "checkbox", fieldType: "checkbox", value: field.isChecked() };
  }
  if (field instanceof PDFRadioGroup) {
    return {
      kind: "radio",
      fieldType: "radio",
      value: field.getSelected() ?? "",
      metadata: { options: field.getOptions() },
    };
  }
  if (field instanceof PDFDropdown) {
    const selected = field.getSelected();
    return {
      kind: "select",
      fieldType: "choice",
      value: field.isMultiselect() ? selected : selected[0] ?? "",
      metadata: { options: field.getOptions(), multiSelect: field.isMultiselect() },
    };
  }
  if (field instanceof PDFOptionList) {
    return {
      kind: "select",
      fieldType: "choice",
      value: field.getSelected(),
      metadata: { options: field.getOptions(), multiSelect: true },
    };
  }
  if (field instanceof PDFSignature) {
    return { kind: "signature", fieldType: "signature", value: "" };
  }
  return { kind: "unknown", metadata: { pdfFieldClass: field.constructor.name } };
};

/** Extract existing AcroForm widgets into the portable annotation model. */
export const extractPdfAnnotations = async (
  bytes: Uint8Array,
): Promise<ExtractedPdfAnnotations> => {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = pdf.getPages();
  const pageByRef = new Map(pages.map((page, index) => [page.ref.toString(), index]));
  const annotations: Annotation[] = [];
  const warnings: PdfWarning[] = [];
  const usedIds = new Set<string>();
  const form = pdf.getForm();

  for (const field of form.getFields()) {
    const description = fieldDescription(field);
    const semantic = readFieldSemanticMetadata(field);
    const widgets = field.acroField.getWidgets();
    if (widgets.length === 0) {
      warnings.push({ code: "field-without-widget", message: `Field "${field.getName()}" has no widget.` });
      continue;
    }
    widgets.forEach((widget, widgetIndex) => {
      const pageIndex = pageByRef.get(widget.P()?.toString() ?? "") ?? 0;
      const page = pages[pageIndex];
      if (page === undefined) return;
      const rect = toCanonicalRect(page, widget.getRectangle());
      const metadata = {
        ...(description.metadata ?? {}),
        ...(semantic.metadata ?? {}),
        pdfWidgetIndex: widgetIndex,
      };
      annotations.push({
        id: uniqueId(field.getName(), widgetIndex, usedIds, semantic.id),
        kind: semantic.kind ?? description.kind,
        pageIndex,
        rect,
        name: field.getName(),
        required: field.isRequired(),
        readOnly: field.isReadOnly() || description.kind === "unknown",
        locked: false,
        ...(description.value === undefined ? {} : { value: description.value }),
        metadata,
        pdf: {
          ...(description.fieldType === undefined ? {} : { fieldType: description.fieldType }),
          logicalFieldId: field.ref.toString(),
          widgetId: `${field.ref.toString()}:${widgetIndex}`,
          source: "imported",
        },
      });
      if (description.kind === "unknown") {
        const annotationId = annotations.at(-1)?.id;
        warnings.push({
          code: "unsupported-field",
          message: `Field "${field.getName()}" is preserved as a read-only unknown annotation.`,
          ...(annotationId === undefined ? {} : { annotationId }),
        });
      }
    });
  }
  return { annotations, warnings };
};

const downloadBytes = (bytes: Uint8Array, filename: string, type: string): void => {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

const safeFieldName = (annotation: Annotation): string => {
  const candidate = annotation.name?.trim().replace(/\./g, "_") ?? "";
  return candidate || `annotation_${annotation.id.replace(/[^a-zA-Z0-9_-]+/g, "_")}`;
};

const stringOptions = (annotation: Annotation): string[] => {
  const options = annotation.metadata?.options;
  return Array.isArray(options)
    ? options.filter((option): option is string => typeof option === "string")
    : [];
};

const applyFieldFlags = (field: PDFField, annotation: Annotation): void => {
  if (annotation.required === true) field.enableRequired();
  else field.disableRequired();
  if (annotation.readOnly === true) field.enableReadOnly();
  else field.disableReadOnly();
};

const fieldRect = (annotation: Annotation, page: PDFPage) => ({
  ...toRawRect(page, annotation),
  // pdf-lib expands the widget rectangle by half the border width. Keep this
  // at zero so canonical PDF-point geometry survives serialize → extract.
  borderWidth: 0,
  borderColor: rgb(0.55, 0.58, 0.64),
  backgroundColor: rgb(1, 1, 1),
});

const updateImportedField = (
  field: PDFField,
  annotation: Annotation,
  page: PDFPage,
  warnings: PdfWarning[],
): void => {
  applyFieldFlags(field, annotation);
  writeFieldSemanticMetadata(field, annotation);
  if (field instanceof PDFTextField) field.setText(annotationValueText(annotation));
  else if (field instanceof PDFCheckBox) {
    if (annotation.value === true || annotation.value === "true" || annotation.value === "Checked") field.check();
    else field.uncheck();
  } else if (field instanceof PDFRadioGroup && typeof annotation.value === "string") {
    if (field.getOptions().includes(annotation.value)) field.select(annotation.value);
  } else if ((field instanceof PDFDropdown || field instanceof PDFOptionList)) {
    const selected = Array.isArray(annotation.value)
      ? annotation.value.filter((value): value is string => typeof value === "string")
      : typeof annotation.value === "string" ? [annotation.value] : [];
    if (selected.length > 0) field.select(selected);
  }

  const widgetIndex = typeof annotation.metadata?.pdfWidgetIndex === "number"
    ? annotation.metadata.pdfWidgetIndex
    : 0;
  const widget = field.acroField.getWidgets()[widgetIndex];
  if (widget !== undefined) {
    if (widget.P()?.toString() !== page.ref.toString()) {
      warnings.push({
        code: "cross-page-widget-move",
        message: `Field "${field.getName()}" cannot be moved to another page without rebuilding its widget.`,
        annotationId: annotation.id,
      });
    } else {
      const rect = fieldRect(annotation, page);
      widget.setRectangle(rect);
    }
  }
};

/** Serialize supported annotations as AcroForm widgets and return bytes without downloading. */
export const serializePdf = async (
  bytes: Uint8Array,
  annotations: ReadonlyArray<Annotation>,
  options: Readonly<{ deletedFieldNames?: ReadonlyArray<string> }> = {},
): Promise<SerializedPdf> => {
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();
  const warnings: PdfWarning[] = [];

  for (const name of new Set(options.deletedFieldNames ?? [])) {
    const field = form.getFieldMaybe(name);
    if (field !== undefined) form.removeField(field);
  }

  const existingNames = new Set(form.getFields().map((field) => field.getName()));
  for (const annotation of annotations) {
    const page = pages[annotation.pageIndex];
    if (page === undefined) {
      warnings.push({
        code: "missing-page",
        message: `Annotation "${annotation.id}" refers to a page that does not exist.`,
        annotationId: annotation.id,
      });
      continue;
    }
    if (annotation.pdf?.source === "imported" && annotation.name !== undefined) {
      const field = form.getFieldMaybe(annotation.name);
      if (field !== undefined) {
        updateImportedField(field, annotation, page, warnings);
        continue;
      }
    }

    let name = safeFieldName(annotation);
    if (existingNames.has(name)) {
      const base = name;
      let suffix = 2;
      while (existingNames.has(`${base}_${suffix}`)) suffix += 1;
      name = `${base}_${suffix}`;
      warnings.push({
        code: "renamed-field",
        message: `Field name "${base}" already existed and was saved as "${name}".`,
        annotationId: annotation.id,
      });
    }

    if (annotation.kind === "highlight") {
      const rect = fieldRect(annotation, page);
      page.drawRectangle({ ...rect, color: rgb(1, 0.84, 0.18), opacity: 0.34, borderWidth: 0 });
      continue;
    }
    if (annotation.kind === "stamp") {
      const rect = fieldRect(annotation, page);
      page.drawRectangle({ ...rect, borderColor: rgb(0.79, 0.18, 0.18), borderWidth: 1.5 });
      page.drawText(annotationValueText(annotation).toUpperCase(), {
        x: rect.x + 4,
        y: rect.y + Math.max(2, (rect.height - 12) / 2),
        size: Math.min(14, Math.max(7, rect.height * 0.4)),
        maxWidth: Math.max(1, rect.width - 8),
        font: bold,
        color: rgb(0.79, 0.18, 0.18),
      });
      continue;
    }
    if (annotation.kind === "checkbox") {
      const field = form.createCheckBox(name);
      applyFieldFlags(field, annotation);
      writeFieldSemanticMetadata(field, annotation);
      if (annotation.value === true || annotation.value === "true" || annotation.value === "Checked") field.check();
      field.addToPage(page, fieldRect(annotation, page));
      existingNames.add(name);
      continue;
    }
    if (annotation.kind === "radio") {
      const field = form.createRadioGroup(name);
      applyFieldFlags(field, annotation);
      writeFieldSemanticMetadata(field, annotation);
      const option = typeof annotation.pdf?.optionValue === "string"
        ? annotation.pdf.optionValue
        : annotationValueText(annotation) || "option";
      field.addOptionToPage(option, page, fieldRect(annotation, page));
      field.select(option);
      existingNames.add(name);
      continue;
    }
    if (annotation.kind === "select") {
      const field = form.createDropdown(name);
      applyFieldFlags(field, annotation);
      writeFieldSemanticMetadata(field, annotation);
      const options = stringOptions(annotation);
      if (options.length > 0) field.setOptions(options);
      const value = annotationValueText(annotation);
      if (value !== "" && options.includes(value)) field.select(value);
      field.addToPage(page, { ...fieldRect(annotation, page), font: regular });
      existingNames.add(name);
      continue;
    }
    if (["text", "date", "signature", "initials"].includes(annotation.kind)) {
      const field = form.createTextField(name);
      applyFieldFlags(field, annotation);
      writeFieldSemanticMetadata(field, annotation);
      field.setText(annotationValueText(annotation));
      if (annotation.metadata?.multiline === true) field.enableMultiline();
      field.addToPage(page, { ...fieldRect(annotation, page), font: regular });
      existingNames.add(name);
      if (annotation.kind === "signature" || annotation.kind === "initials") {
        warnings.push({
          code: "signature-text-fallback",
          message: `${annotation.kind} is saved as an interactive text field because pdf-lib cannot author unsigned /Sig fields.`,
          annotationId: annotation.id,
        });
      }
      continue;
    }

    warnings.push({
      code: "json-only-kind",
      message: `Custom kind "${annotation.kind}" remains in JSON but has no PDF serializer.`,
      annotationId: annotation.id,
    });
  }

  form.updateFieldAppearances(regular);
  return { bytes: await pdf.save(), warnings };
};

export const exportAnnotatedPdf = async (
  bytes: Uint8Array,
  annotations: ReadonlyArray<Annotation>,
  sourceName: string,
  options: Readonly<{ deletedFieldNames?: ReadonlyArray<string> }> = {},
): Promise<ReadonlyArray<PdfWarning>> => {
  const serialized = await serializePdf(bytes, annotations, options);
  const base = sourceName.replace(/\.pdf$/i, "") || "document";
  downloadBytes(serialized.bytes, `${base}-annotated.pdf`, "application/pdf");
  return serialized.warnings;
};
