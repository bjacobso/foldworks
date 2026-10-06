// A folded checklist shows how far along it is instead of nothing: a bar of
// done against total, and each entry as a chip that marks it done or not.

import type { HtmlBuilder } from "foldkit/html";
import { find, type FoldedView, type Items, type Row } from "@foldworks/outliner";

import { marksOf } from "./mentions";
import { Message } from "./message";

/** Lists that read as checklists, and what their entries are called. */
const CHECKLISTS: Readonly<Record<string, string>> = {
  Chapters: "chapters",
  "Volunteer day, April 12": "tasks",
};

/** An entry's text without its tags, to keep chips short. */
const plain = (text: string): string =>
  marksOf(text)
    .filter((mark) => mark.kind === "tag")
    .reduceRight((rest, mark) => rest.slice(0, mark.from) + rest.slice(mark.to), text)
    .replace(/\s+/g, " ")
    .trim() || "untitled";

/** A progress summary for a folded checklist, or nothing for other rows. */
export const checklistView = (
  items: Items,
  row: Row,
  h: HtmlBuilder<Message>,
): FoldedView | null => {
  const noun = CHECKLISTS[row.text];
  const entries = noun === undefined ? undefined : find(items, row.id)?.children;
  if (noun === undefined || entries === undefined || entries.length === 0) return null;
  const done = entries.filter((entry) => entry.checked).length;
  const summary = `${done} of ${entries.length} ${noun} done`;
  return {
    label: `${row.text}: ${summary}`,
    content: h.div(
      [h.Class("outliner-demo__summary")],
      [
        h.div(
          [h.Class("outliner-demo__progress")],
          [
            h.span(
              [h.Class("outliner-demo__bar"), h.AriaHidden(true)],
              [
                h.span(
                  [
                    h.Class("outliner-demo__bar-fill"),
                    h.Style({ width: `${(done / entries.length) * 100}%` }),
                  ],
                  [],
                ),
              ],
            ),
            h.span([h.Class("outliner-demo__progress-text")], [summary]),
          ],
        ),
        h.div(
          [h.Class("outliner-demo__chips")],
          entries.map((entry) =>
            h.button(
              [
                h.Class("outliner-demo__chip"),
                h.Type("button"),
                h.AriaPressed(String(entry.checked)),
                h.Title(entry.checked ? "Mark not done" : "Mark done"),
                h.DataAttribute("done", String(entry.checked)),
                h.OnClick(Message.ToggledDone({ id: entry.id })),
              ],
              [plain(entry.text)],
            ),
          ),
        ),
      ],
    ),
  };
};
