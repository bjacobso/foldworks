import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import { formApp } from "./form-view";
import type { Message } from "./message";
import type { Model } from "./model";
import { Readout } from "./performance";
import { className, styles } from "./styles";

type H = HtmlBuilder<Message>;

const readoutRow = (label: string, phase: string, h: H): ReadonlyArray<Html> => [
  h.span([h.Class(className(styles.readoutLabel))], [label]),
  h.span([h.Class(className(styles.readoutValue)), h.DataAttribute("phase", phase)], ["–"]),
];

const aside = (h: H): Html =>
  h.aside(
    [h.Class(className(styles.aside))],
    [
      h.h2([h.Class(className(styles.asideTitle))], ["Mobile inputs"]),
      h.p(
        [h.Class(className(styles.asideText))],
        [
          "A candidate application built from stateless Foldkit controls tuned for phones. Each control is one view call with its own Messages; only the state picker uses a Submodel.",
        ],
      ),
      h.ul(
        [h.Class(className(styles.list))],
        [
          "17px text and 52px+ targets, so Safari never zooms and thumbs never miss.",
          "The right keyboard per field, Enter moves to the next field, and the last one submits.",
          "Autofill tokens on every field, including a hidden select behind the state sheet.",
          "Phone, date, and ZIP masks that keep the caret in place and accept autofilled values.",
          "One real one-time-code input drawn as six cells, so SMS autofill and paste work.",
          "Errors appear after you leave a field, then clear as soon as it's fixed.",
          "Yes/no questions reveal nested follow-ups with an animated expand. Hidden answers are kept but never validated.",
          "The action bar rides above the keyboard and respects the home indicator.",
          "Drafts survive a reload, such as switching to Messages for the code.",
        ].map((item) => h.li([], [item])),
      ),
      h.div(
        [h.Class(className(styles.readout)), h.OnMount(Readout({ scope: "#mobile-form-device" }))],
        [
          h.div(
            [h.Class(className(styles.readoutTitle))],
            [
              h.span([], ["Live timings (p50 · p95)"]),
              h.span(
                [h.Class(className(styles.readoutLabel))],
                [h.span([h.DataAttribute("count", "")], ["0"]), " samples"],
              ),
            ],
          ),
          ...readoutRow("Update", "Update", h),
          ...readoutRow("View", "View", h),
          ...readoutRow("Patch", "Patch", h),
          ...readoutRow("Input → next paint", "Paint", h),
          h.p(
            [h.Class(className(styles.readoutNote))],
            [
              "Measured in this tab for the whole demo application, including every other demo's state. Type in the form to collect samples.",
            ],
          ),
        ],
      ),
      h.a([h.Href("/apply.html"), h.Class(className(styles.link))], ["Open the standalone form →"]),
    ],
  );

export const view = defineView<Model, Message>((model, h) =>
  h.div(
    [h.Class(className(styles.page))],
    [
      h.div([h.Id("mobile-form-device"), h.Class(className(styles.device))], [formApp(model, h)]),
      aside(h),
    ],
  ),
);
