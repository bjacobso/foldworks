import { defineView } from "foldkit/submodel";
import { PdfViewer } from "foldworks/pdf-viewer";
import * as Graph from "foldworks/diagram/graph";
import { HighlightedText } from "foldworks/text-intelligence";
import { ProseDiff } from "foldworks/diff-viewer";
import { Alert, Button, Citation } from "foldworks/ui";
import { className } from "../workflow/styles";
import { graphDocument, quote, revisedQuote } from "./fixture";
import type { Model } from "./model";
import { Message } from "./message";
import { styles } from "./styles";

export const view = defineView<Model, Message>((model, h) =>
  h.div(
    [h.Class(className(styles.root))],
    [
      h.div(
        [h.Class(className(styles.pdf))],
        [
          PdfViewer.view(
            {
              model: model.viewer,
              toParentMessage: (message) => Message.GotViewerMessage({ message }),
              label: "Synthetic agreement",
              selectableText: true,
              onSelectText: (selection) => Message.SelectedPdfText({ selection }),
              highlights: [
                {
                  key: "quote",
                  regions: model.regions,
                  label: "Schedule bidding evidence",
                  tone: "warning",
                  isSelected: model.selectedKey === "quote",
                  onClick: Message.SelectedRange({ key: "quote" }),
                },
              ],
              banner: Alert.view(
                {
                  title: "Synthetic document",
                  description:
                    "Select text to inspect its provenance. Pages render near the viewport.",
                },
                h,
              ),
            },
            h,
          ),
        ],
      ),
      h.div(
        [h.Class(className(styles.panel))],
        [
          ...(model.error === ""
            ? []
            : [Alert.view({ title: "Sample error", description: model.error, tone: "danger" }, h)]),
          h.section(
            [h.Class(className(styles.section))],
            [
              h.h2([], ["Evidence in context"]),
              h.p(
                [],
                [
                  "Schedule bidding, Article 12, pages 1–2 ",
                  h.submodel({
                    slotId: "analysis-citation",
                    model: model.citation,
                    view: Citation.view,
                    viewInputs: Citation.styledViewInputs(
                      { label: 1, preview: quote, onActivate: Message.OpenedQuote() },
                      h,
                    ),
                    toParentMessage: (message) => Message.GotCitationMessage({ message }),
                  }),
                ],
              ),
              HighlightedText.view(
                {
                  text: quote,
                  selectedKey: model.selectedKey,
                  ranges: [
                    {
                      key: "quote",
                      from: 0,
                      to: quote.length,
                      label: "Schedule bidding evidence",
                      tooltip: "PDF pages 1–2",
                      tone: "warning",
                      onClick: Message.OpenedQuote(),
                    },
                    {
                      key: "eligibility",
                      from: 15,
                      to: 27,
                      label: "One year of service",
                      tooltip: "Eligibility requirement",
                      tone: "info",
                      onClick: Message.SelectedRange({ key: "eligibility" }),
                    },
                  ],
                },
                h,
              ),
              h.p(
                [h.Class(className(styles.hint))],
                [
                  `Retained page images: ${model.viewer.cachedPageIndexes.length} / ${model.viewer.maxCachedPages}. This sample has 12 pages.`,
                ],
              ),
              Button.view(
                {
                  label: "Jump to last page",
                  onClick: Message.GotViewerMessage({ message: PdfViewer.goToPage(11) }),
                  variant: "outline",
                  size: "sm",
                },
                h,
              ),
              h.p(
                [h.DataAttribute("pdf-selected-text", "true"), h.AriaLive("polite")],
                [
                  model.selectedText === ""
                    ? "Select text in the PDF to see it here."
                    : `Selected: ${model.selectedText}`,
                ],
              ),
            ],
          ),
          h.section(
            [h.Class(className(styles.section))],
            [
              h.h2([], ["Compare clause wording"]),
              h.div(
                [h.Class(className(styles.controls))],
                [
                  ...(["inline", "split"] as const).map((mode) =>
                    Button.view(
                      {
                        label: mode === "inline" ? "Inline comparison" : "Side-by-side comparison",
                        onClick: Message.ChangedDiffMode({ mode }),
                        variant: model.diffMode === mode ? "secondary" : "outline",
                        size: "sm",
                      },
                      h,
                    ),
                  ),
                ],
              ),
              ProseDiff.view({ oldText: quote, newText: revisedQuote, mode: model.diffMode }, h),
            ],
          ),
          h.section(
            [h.Class(className(styles.section))],
            [
              h.h2([], ["Explore relationships"]),
              Button.view(
                {
                  label: "Focus Article 12 neighborhood",
                  onClick: Message.ShowNeighborhood(),
                  variant: "outline",
                  size: "sm",
                },
                h,
              ),
              Graph.view(
                {
                  model: model.graph,
                  document: graphDocument,
                  height: 410,
                  toParentMessage: (message) => Message.GotGraphMessage({ message }),
                },
                h,
              ),
            ],
          ),
          h.p(
            [h.AriaLive("polite"), h.DataAttribute("analysis-announcement", "true")],
            [model.announcement],
          ),
        ],
      ),
    ],
  ),
);
