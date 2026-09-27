import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { RefreshCw } from "@lucide/icons";
import { PdfViewer, type PdfOverlay, type PdfOverlayTone } from "@foldworks/pdf-annotator";
import { Alert, Badge, Button, Toggle } from "@foldworks/ui";

import { className } from "../workflow/styles";
import { sampleFields, type FieldStatus, type SampleField } from "./fixture";
import { Message } from "./message";
import type { Model, StatusFilter } from "./model";
import { styles } from "./styles";

// The application owns what a status means; the viewer only needs a tone.
const statusTone: Readonly<Record<FieldStatus, PdfOverlayTone>> = {
  filled: "success",
  blank: "neutral",
  omitted: "muted",
  missing: "danger",
};

const statusLabel: Readonly<Record<FieldStatus, string>> = {
  filled: "Filled",
  blank: "Blank",
  omitted: "Omitted",
  missing: "Missing",
};

const statusBadgeTone = (status: FieldStatus) =>
  status === "filled" ? "success" : status === "missing" ? "danger" : "neutral";

const statuses: ReadonlyArray<FieldStatus> = ["filled", "blank", "omitted", "missing"];

const visibleFields = (model: Model): ReadonlyArray<SampleField> =>
  model.statusFilter === "all"
    ? sampleFields
    : sampleFields.filter((field) => field.status === model.statusFilter);

const overlays = (model: Model): ReadonlyArray<PdfOverlay<Message>> =>
  model.showOverlays
    ? visibleFields(model).map((field) => ({
        key: field.key,
        pageIndex: field.pageIndex,
        rect: field.rect,
        label: `${field.label}: ${statusLabel[field.status].toLowerCase()}${field.value === undefined ? "" : `, ${field.value}`}`,
        tone: statusTone[field.status],
        status: field.status,
        isSelected: Option.contains(model.selectedKey, field.key),
        onClick: Message.ClickedOverlay({ key: field.key }),
      }))
    : [];

const filterChip = (model: Model, filter: StatusFilter, h: HtmlBuilder<Message>): Html => {
  const count =
    filter === "all"
      ? sampleFields.length
      : sampleFields.filter((field) => field.status === filter).length;
  return Toggle.view(
    {
      label: `${filter === "all" ? "All" : statusLabel[filter]} (${count})`,
      isPressed: model.statusFilter === filter,
      onToggle: () => Message.ChangedStatusFilter({ filter }),
    },
    h,
  );
};

const fieldRow = (model: Model, field: SampleField, h: HtmlBuilder<Message>): Html => {
  const selected = Option.contains(model.selectedKey, field.key);
  return h.keyed("li")(
    field.key,
    [],
    [
      h.button(
        [
          h.Type("button"),
          h.Class(className(styles.field, selected && styles.fieldSelected)),
          h.AriaPressed(selected ? "true" : "false"),
          h.OnClick(Message.SelectedField({ key: field.key })),
        ],
        [
          h.span([h.Class(className(styles.swatch, styles[field.status])), h.AriaHidden(true)], []),
          h.span(
            [h.Class(className(styles.fieldCopy))],
            [
              h.span([h.Class(className(styles.fieldLabel))], [field.label]),
              h.span(
                [h.Class(className(styles.fieldMeta))],
                [
                  `Page ${field.pageIndex + 1}${field.value === undefined ? "" : ` · ${field.value}`}`,
                ],
              ),
            ],
          ),
          Badge.view({ label: statusLabel[field.status], tone: statusBadgeTone(field.status) }, h),
        ],
      ),
    ],
  );
};

const selectedDetails = (model: Model, h: HtmlBuilder<Message>): Html => {
  const field = sampleFields.find((candidate) => Option.contains(model.selectedKey, candidate.key));
  if (field === undefined) {
    return h.p(
      [h.Class(className(styles.description))],
      [
        "Select a widget on the page or in the list. The list scrolls the viewer with PdfViewer.scrollTo.",
      ],
    );
  }
  const round = (value: number) => Math.round(value * 10) / 10;
  return h.pre(
    [h.Class(className(styles.details)), h.AriaLabel(`${field.label} geometry`)],
    [
      [
        `key     ${field.key}`,
        `page    ${field.pageIndex + 1}`,
        `rect    x ${round(field.rect.x)}, y ${round(field.rect.y)}`,
        `        ${round(field.rect.width)} × ${round(field.rect.height)} pt`,
        "        (user space, bottom-left)",
      ].join("\n"),
    ],
  );
};

const panel = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.aside(
    [h.Class(className(styles.panel)), h.AriaLabel("Widget statuses")],
    [
      h.h2([h.Class(className(styles.heading))], ["Widget statuses"]),
      h.p(
        [h.Class(className(styles.description))],
        [
          "Rectangles come straight from PDF user space. The viewer maps them through each page's crop box and rotation.",
        ],
      ),
      h.div(
        [h.Class(className(styles.filters)), h.Role("group"), h.AriaLabel("Filter by status")],
        [filterChip(model, "all", h), ...statuses.map((status) => filterChip(model, status, h))],
      ),
      h.div(
        [h.Class(className(styles.filters))],
        [
          Toggle.view(
            {
              label: "Show overlays",
              isPressed: model.showOverlays,
              onToggle: (isVisible) => Message.ToggledOverlays({ isVisible }),
            },
            h,
          ),
        ],
      ),
      selectedDetails(model, h),
      h.ul(
        [h.Class(className(styles.list))],
        visibleFields(model).map((field) => fieldRow(model, field, h)),
      ),
    ],
  );

export const view = defineView<Model, Message>((model, h) =>
  h.div(
    [h.Class(className(styles.viewport))],
    [
      h.div(
        [h.Class(className(styles.viewerCard))],
        [
          PdfViewer.view(
            {
              model: model.viewer,
              toParentMessage: (message) => Message.GotViewerMessage({ message }),
              label: "Synthetic onboarding packet",
              overlays: overlays(model),
              watermark: "Synthetic",
              banner:
                model.generateError === ""
                  ? Alert.view(
                      {
                        title: "Synthetic preview",
                        description:
                          "Every value on these pages was generated for the demo. It is not a real submission.",
                      },
                      h,
                    )
                  : Alert.view(
                      {
                        title: "The sample PDF could not be generated",
                        description: model.generateError,
                        tone: "danger",
                      },
                      h,
                    ),
              actions: [
                Button.view(
                  {
                    icon: RefreshCw,
                    ariaLabel: "Regenerate sample PDF",
                    variant: "ghost",
                    size: "icon",
                    onClick: Message.RequestedSample(),
                  },
                  h,
                ),
              ],
            },
            h,
          ),
        ],
      ),
      panel(model, h),
    ],
  ),
);
