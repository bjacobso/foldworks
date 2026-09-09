import { Schema as S } from "effect";
import { Runtime, Update } from "foldkit";
import { Editor, Message, block, text } from "@foldworks/editor";
import "@foldworks/ui/theme.css";
import "@foldworks/editor/styles.css";

const Model = S.Struct({ first: Editor.Model, second: Editor.Model });
type Model = typeof Model.Type;
type Event = { _tag: "First" | "Second"; message: Message };
const count = Math.max(
  1,
  Math.min(
    1000,
    Number(new URLSearchParams(location.search).get("blocks")) || 1,
  ),
);
Runtime.run(
  Runtime.makeElement({
    Model,
    container: document.getElementById("fixture"),
    init: () => ({
      model: {
        first: Editor.init({
          id: "first",
          document: {
            version: 1,
            blocks: Array.from({ length: count }, (_, index) =>
              block(`block-${index}`, "paragraph", [text(`First ${index}`)]),
            ),
          },
        }),
        second: Editor.init({ id: "second", markdown: "Second" }),
      },
    }),
    update: (model: Model, event: Event): Update.Return<Model, Event> => {
      const key = event._tag === "First" ? "first" : "second";
      const result = Editor.update(model[key], event.message);
      return { model: { ...model, [key]: result.model } };
    },
    view: (model, h) =>
      h.div(
        [],
        [
          h.submodel({
            slotId: "first",
            model: model.first,
            view: Editor.view,
            toParentMessage: (message) => ({ _tag: "First", message }),
          }),
          h.submodel({
            slotId: "second",
            model: model.second,
            view: Editor.view,
            toParentMessage: (message) => ({ _tag: "Second", message }),
          }),
        ],
      ),
  }),
);
