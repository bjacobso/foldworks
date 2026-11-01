import type { HtmlBuilder, Html } from "foldkit/html";
import type { hoverFact } from "./adapter.js";
import { preview } from "./values.js";

/** Outline and source popups render exactly the same language facts. */
export const hoverContent = <Message>(
  fact: NonNullable<ReturnType<typeof hoverFact>>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("wb__hover")],
    [
      h.strong([], [fact.title]),
      h.p([], [fact.type ?? fact.kind]),
      ...(fact.observed?.value == null ? [] : [h.code([], [preview(fact.observed.value)])]),
      ...(fact.requirements.length === 0
        ? []
        : [h.p([], [`Requires: ${fact.requirements.join(", ")}`])]),
      ...(fact.doc === undefined ? [] : [h.p([], [fact.doc])]),
      ...(fact.definition === undefined
        ? []
        : [
            h.p(
              [],
              [`Defined in ${fact.definition.sourceId} · ${fact.references.length} references`],
            ),
          ]),
    ],
  );
