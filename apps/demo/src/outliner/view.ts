import { ChevronsDownUp, ChevronsUpDown, Lock, Redo2, SquareCheck, Undo2 } from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import { Button, Icon } from "@foldworks/ui";
import { History } from "@foldworks/history";
import {
  Outliner,
  find,
  shortcutHelp,
  walk,
  type Placeholder,
  type Row,
} from "@foldworks/outliner";

import { decorations, describeMark, type MarkInfo } from "./mentions";
import { Message } from "./message";
import type { Model } from "./model";
import { outlinePolicy } from "./policy";
import { QUOTED_ID } from "./sample";
import { checklistView } from "./summary";

const outlineMessage = (message: Outliner.Message): Message =>
  Message.GotOutlinerMessage({ message });

const toolbar = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("outliner-demo__toolbar"), h.Role("toolbar"), h.AriaLabel("Outline tools")],
    [
      Button.view(
        {
          icon: Undo2,
          ariaLabel: "Undo",
          variant: "ghost",
          size: "icon",
          isDisabled: !History.canUndo(model.outline.history),
          onClick: outlineMessage(Outliner.Message.ClickedUndo()),
        },
        h,
      ),
      Button.view(
        {
          icon: Redo2,
          ariaLabel: "Redo",
          variant: "ghost",
          size: "icon",
          isDisabled: !History.canRedo(model.outline.history),
          onClick: outlineMessage(Outliner.Message.ClickedRedo()),
        },
        h,
      ),
      h.span([h.Class("outliner-demo__divider"), h.AriaHidden(true)], []),
      Button.view(
        {
          icon: ChevronsDownUp,
          label: "Collapse all",
          variant: "ghost",
          size: "sm",
          onClick: outlineMessage(Outliner.Message.SetAllCollapsed({ collapsed: true })),
        },
        h,
      ),
      Button.view(
        {
          icon: ChevronsUpDown,
          label: "Expand all",
          variant: "ghost",
          size: "sm",
          onClick: outlineMessage(Outliner.Message.SetAllCollapsed({ collapsed: false })),
        },
        h,
      ),
      h.div(
        [h.Class("outliner-demo__levels"), h.Role("group"), h.AriaLabel("Show levels")],
        [1, 2, 3].map((level) =>
          h.button(
            [
              h.Class("outliner-demo__level"),
              h.Type("button"),
              h.Title(`Show ${level} ${level === 1 ? "level" : "levels"}`),
              h.AriaLabel(`Show ${level} ${level === 1 ? "level" : "levels"}`),
              h.OnClick(outlineMessage(Outliner.Message.ExpandedToLevel({ level }))),
            ],
            [String(level)],
          ),
        ),
      ),
      h.span([h.Class("outliner-demo__spacer")], []),
      Button.view(
        {
          icon: SquareCheck,
          label: "Checkboxes",
          variant: model.showCheckboxes ? "secondary" : "ghost",
          size: "sm",
          onClick: Message.ToggledCheckboxes(),
        },
        h,
      ),
    ],
  );

/** The card for a mention or a tag. */
const markCard = (info: MarkInfo, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("outliner-demo__card")],
    [
      h.strong([], [info.title]),
      h.span([], [info.detail]),
      h.span(
        [h.Class("outliner-demo__card-count")],
        [info.count === 1 ? "On 1 item" : `On ${info.count} items`],
      ),
    ],
  );

/** Says why the quoted principles can't be edited, at the end of their first row. */
const quotedHint = (row: Row, h: HtmlBuilder<Message>): Html | null =>
  row.id !== QUOTED_ID
    ? null
    : h.span(
        [
          h.Class("outliner-demo__quoted"),
          h.Title("Quoted word for word from Leave No Trace, so it can't be edited here"),
        ],
        [Icon.view({ icon: Lock, size: 12 }, h), h.span([], ["Quoted · read only"])],
      );

/** Lists that invite one more entry show a placeholder at their end. */
const OPEN_LISTS: Readonly<Record<string, Placeholder>> = {
  Chapters: { key: "chapter", label: "chapter" },
  "Open questions": { key: "question", label: "question" },
};

const mouseTips = (platform: Model["platform"]): ReadonlyArray<string> => {
  const option = platform === "mac" ? "⌥" : "Alt";
  const shift = platform === "mac" ? "⇧" : "Shift";
  return [
    "Drag a bullet to move it; slide left or right to change its level.",
    "Click a bullet to hoist that item. Use the path above to come back.",
    `${option}-click a triangle to open or close every level beneath it.`,
    `Drag across rows, or ${shift}-click, to select several.`,
    "Paste indented text or a Markdown list to add many items at once.",
    "Type @ to mention someone on the crew, or # to tag an item. Rest the pointer on one to see who or what it is.",
    "Fold the chapters or the volunteer day to see their progress. Click an entry there to mark it done.",
    "Done items are signed off, so nothing can be moved into one, and the quoted principles can't be edited. A refused drop shows a dashed red marker.",
  ];
};

const help = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.aside(
    [h.Class("outliner-demo__help"), h.AriaLabel("Outliner shortcuts")],
    [
      h.h3([], ["Keyboard shortcuts"]),
      h.dl(
        [],
        shortcutHelp(model.platform).flatMap(({ keys, label }) => [
          h.dt([], [h.kbd([], [keys])]),
          h.dd([], [label]),
        ]),
      ),
      h.h3([], ["Working with rows"]),
      h.ul(
        [],
        mouseTips(model.platform).map((tip) => h.li([], [tip])),
      ),
    ],
  );

export const view = defineView<Model, Message>((model, h) => {
  const all = walk(model.outline.items);
  const done = all.filter((node) => node.checked).length;
  return h.div(
    [h.Class("outliner-demo"), h.DataAttribute("outliner-demo", "true")],
    [
      h.div(
        [h.Class("outliner-demo__layout")],
        [
          h.section(
            [h.Class("outliner-demo__document"), h.AriaLabel("Field guide outline")],
            [
              h.header(
                [h.Class("outliner-demo__header")],
                [
                  h.h1([h.Class("outliner-demo__name")], ["Field guide"]),
                  h.span([h.Class("outliner-demo__stats")], [`${all.length} items · ${done} done`]),
                ],
              ),
              toolbar(model, h),
              h.div(
                [h.Class("outliner-demo__page")],
                [
                  h.submodel({
                    slotId: "outliner-demo-outline",
                    model: model.outline,
                    view: Outliner.view,
                    viewInputs: {
                      ...outlinePolicy(model.outline.items),
                      label: "Field guide outline",
                      showCheckboxes: model.showCheckboxes,
                      decorations: decorations(model.outline.items),
                      rowAccessory: (row: Row) => quotedHint(row, h),
                      foldedView: (row: Row) => checklistView(model.outline.items, row, h),
                      placeholders: (parentId: string | null) => {
                        const parent =
                          parentId === null ? undefined : find(model.outline.items, parentId);
                        const placeholder =
                          parent === undefined ? undefined : OPEN_LISTS[parent.text];
                        return placeholder === undefined ? [] : [placeholder];
                      },
                      hover: ({ text, offset, source }) => {
                        const info = describeMark(
                          model.outline.items,
                          text,
                          offset,
                          source === "Keyboard",
                        );
                        return info === undefined
                          ? null
                          : { from: info.from, to: info.to, content: markCard(info, h) };
                      },
                    },
                    toParentMessage: outlineMessage,
                  }),
                ],
              ),
            ],
          ),
          help(model, h),
        ],
      ),
    ],
  );
});
