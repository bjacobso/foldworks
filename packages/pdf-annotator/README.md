# @foldworks/pdf-annotator

A Foldkit-native PDF annotation authoring tool with controlled state, portable
JSON, AcroForm inspection and writing, custom annotation metadata, and
zoom-independent PDF geometry.

## UI integration

```ts
const model = PdfAnnotator.init({
  id: "agreement",
  sampleUrl: "/agreement.pdf",
});
```

Embed `model` as a submodel, wrap `PdfAnnotator.Message`, fold
`PdfAnnotator.update`, and lift `PdfAnnotator.subscriptions`. Render with
`PdfAnnotator.view` and import `@foldworks/pdf-annotator/styles.css` once.

The default UI can:

- inspect existing AcroForm text, checkbox, radio, choice, and signature
  widgets;
- create Text, Signature, Date, Checkbox, Initials, Radio, Select, Highlight,
  and Stamp annotations by dragging a palette tool onto a page;
- select, move, resize from eight handles, nudge, duplicate, lock, and delete;
- edit field names, values, required/read-only state, page and rectangle data;
- add, rename, edit, and delete custom metadata attributes;
- zoom from 25% to 400% without changing stored annotation geometry;
- inspect, replace, validate, reset, and download the complete annotation JSON;
- save field-like annotations as interactive AcroForm widgets and markup kinds
  as flattened page content.

## Portable JSON

JSON always uses a versioned document envelope. Unversioned arrays and legacy
normalized-coordinate formats are rejected.

```json
{
  "schemaVersion": 1,
  "annotations": [
    {
      "id": "employee-name",
      "kind": "text",
      "pageIndex": 0,
      "rect": { "x": 72, "y": 120, "width": 200, "height": 24 },
      "name": "employee_name",
      "required": true,
      "value": "Alex Morgan",
      "metadata": {
        "owner": "employee",
        "source": "hris"
      }
    }
  ],
  "metadata": {
    "template": "employee-agreement"
  }
}
```

`kind` is an open string. Unknown and host-defined kinds remain fully
round-trippable in JSON even when they do not have a PDF serializer.
`metadata` accepts any JSON-compatible values.

Rectangles are stored in page-local PDF points after display rotation, with a
top-left origin, x increasing right, and y increasing down. `pageIndex` is
zero-based. Canvas zoom and device-pixel ratio never modify the stored values.

```ts
import {
  makeAnnotationDocument,
  parseAnnotationDocument,
  queryAnnotations,
  serializeAnnotationDocument,
  updateDocumentAnnotation,
  validateAnnotationDocument,
} from "@foldworks/pdf-annotator";

const document = parseAnnotationDocument(json);
const signatures = queryAnnotations(document, { kind: "signature" });
const next = updateDocumentAnnotation(document, "employee-name", (annotation) => ({
  ...annotation,
  metadata: { ...annotation.metadata, reviewed: true },
}));
const issues = validateAnnotationDocument(next, [{ width: 612, height: 792 }]);
const output = serializeAnnotationDocument(next);
```

## Headless PDF APIs

The PDF APIs do not require the default UI:

```ts
import { extractPdfAnnotations, serializePdf } from "@foldworks/pdf-annotator";

const { annotations, warnings: importWarnings } =
  await extractPdfAnnotations(sourceBytes);

const { bytes, warnings: saveWarnings } = await serializePdf(
  sourceBytes,
  annotations,
  { deletedFieldNames: ["obsolete_field"] },
);
```

Imported widgets retain logical-field and widget IDs in `annotation.pdf`.
Edits to supported imported fields update them in place. Removing an imported
logical field from the UI records its field name for removal during save.

Highlights and stamps are flattened intentionally. Custom kinds are JSON-only
unless a serializer is added by the host. `pdf-lib` cannot author unsigned
`/Sig` widgets through its public API, so newly authored Signature and Initials
annotations currently save as interactive text fields and return a typed
warning. Existing signature widgets are inspected and preserved; editing a
cryptographically signed PDF may invalidate its signatures.
