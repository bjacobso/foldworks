import { ValueTree } from "@foldworks/ui";
import { describe, expect, it } from "vitest";

import { applyProposal, initialSnapshot } from "./domain";
import { Message } from "./message";
import { init } from "./model";
import { recordNodes, ROOT_ID } from "./record";
import { update } from "./update";

const selected = (id: string) =>
  update(init(), Message.SelectedWorker({ id, panel: "Record" })).model;
const branch = (model: ReturnType<typeof init>, id: string) => {
  const find = (nodes: ReadonlyArray<ValueTree.ValueNode>): ValueTree.ValueNode | undefined =>
    nodes
      .map((node) => (node.id === id ? node : find(node.children ?? [])))
      .find((node) => node !== undefined);
  return find(recordNodes(model))!;
};
const record = (message: ValueTree.Message) => Message.GotRecordMessage({ message });

describe("worker source record", () => {
  it("opens at its top level and leaves nested branches to load", () => {
    const model = selected("worker:bob");
    const [root] = recordNodes(model);
    expect(root?.id).toBe(ROOT_ID);
    expect(root?.children?.map((node) => node.key)).toEqual([
      "id",
      "name",
      "employment",
      "documents",
      "compliance",
      "shifts",
      "history",
    ]);
    expect(branch(model, "record/shifts")).toMatchObject({
      preview: "list · 22 entries",
      expandable: true,
    });
    expect(branch(model, "record/shifts").children).toBeUndefined();
  });

  it("loads a branch a page at a time", () => {
    const opened = update(
      selected("worker:bob"),
      record(ValueTree.Message.Toggled({ id: "record/shifts" })),
    ).model;
    expect(opened.loaded["record/shifts"]).toBe(10);
    expect(branch(opened, "record/shifts").children).toHaveLength(10);
    expect(branch(opened, "record/shifts").more).toBe(12);
    expect(branch(opened, "record/shifts/0").preview).toMatch(/^\{date: "2026-09-30", site: /);

    const more = update(
      opened,
      record(ValueTree.Message.ClickedMore({ id: "record/shifts" })),
    ).model;
    expect(branch(more, "record/shifts").children).toHaveLength(20);
    expect(branch(more, "record/shifts").more).toBe(2);
  });

  it("reads saved changes from the record and starts over for another worker", () => {
    const base = selected("worker:bob");
    const snapshot = applyProposal(
      initialSnapshot,
      { workerId: "worker:bob", basis: 0, before: "NY", after: "CA" },
      { id: "tx:test", timestamp: "2026-10-01T09:00:00.000Z" },
    );
    const model = ["record/history", "record/history/0", "record/history/0/state"].reduce(
      (current, id) => update(current, record(ValueTree.Message.Toggled({ id }))).model,
      { ...base, snapshot },
    );
    expect(
      branch(model, "record/history/0/state").children?.map(
        (node) => `${node.key}: ${node.preview}`,
      ),
    ).toEqual(['before: "NY"', 'after: "CA"']);

    const other = update(
      model,
      Message.SelectedWorker({ id: "worker:alice", panel: "Record" }),
    ).model;
    expect(other.loaded).toEqual({ [ROOT_ID]: 10 });
    expect(other.record.expandedIds).toEqual([ROOT_ID]);
  });
});
