import { expect, it } from "vitest";
import { Outliner, updateItem, walk } from "@foldworks/outliner";
import { initialModel } from "./model";
import { Message } from "./message";
import { QUOTED_ID } from "./sample";
import { update } from "./update";

it("offers host data in editable rows while keeping reference queries in quoted rows read only", () => {
  const initial = initialModel();
  const editable = walk(initial.outline.items).find(
    (node) => node.text === "Reading the weather",
  )!.id;
  const items = updateItem(
    updateItem(initial.outline.items, editable, (node) => ({ ...node, text: "@jo" })),
    QUOTED_ID,
    (node) => ({ ...node, text: "@jo" }),
  );
  const model = { ...initial, outline: { ...initial.outline, items } };
  const request = (id: string) =>
    update(
      model,
      Message.GotOutlinerMessage({
        message: Outliner.Message.RequestedCompletion({ id, start: 3, end: 3 }),
      }),
    ).model.outline;
  expect(request(editable).completion?.items.some((item) => item.label === "@jonah")).toBe(true);
  const quoted = request(QUOTED_ID);
  expect(quoted.completion).toBeNull();
  expect(quoted.items).toBe(items);
});
