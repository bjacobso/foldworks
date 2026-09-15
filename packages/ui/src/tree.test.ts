import { describe, expect, it } from "vitest";
import * as Tree from "./tree";

const node = (id: string, parentId: string | null, branch = false): Tree.Node => ({ id, parentId, label: id, branch, movable: true, renamable: true });
const nodes = [node("root", null, true), node("folder", "root", true), node("alpha", "folder"), node("beta", "root"), node("bravo", "root")];
const initial = () => Tree.init({ id: "tree", expandedIds: ["root", "folder"], selectedId: "alpha" });
const update = (model: Tree.Model, message: Tree.Message) => Tree.update(model, message, { nodes });
const key = (model: Tree.Model, key: string, time = 1000) => update(model, Tree.Message.Navigated({ key, time })).model;

describe("tree explorer", () => {
  it("keeps focus separate from selection until activation", () => {
    const next = key(initial(), "ArrowDown");
    expect(next.activeId).toBe("beta"); expect(next.selectedId).toBe("alpha");
    const selected = update(next, Tree.Message.Navigated({ key: "Enter", time: 0 }));
    expect(selected.model.selectedId).toBe("beta");
    expect(selected.outMessage).toEqual(Tree.OutMessage.Selected({ id: "beta" }));
  });
  it("collapses and expands ancestors while retaining stable descendant selection", () => {
    const parent = key(initial(), "ArrowLeft");
    expect(parent.activeId).toBe("folder");
    const collapsed = key(parent, "ArrowLeft");
    expect(Tree.visibleNodes(collapsed, nodes).map(node => node.id)).toEqual(["root", "folder", "beta", "bravo"]);
    expect(collapsed.selectedId).toBe("alpha");
    expect(key(key(collapsed, "ArrowRight"), "ArrowRight").activeId).toBe("alpha");
    const toggled = update(initial(), Tree.Message.Toggled({ id: "root" })).model;
    expect(toggled.activeId).toBe("root"); expect(toggled.selectedId).toBe("alpha");
  });
  it("supports boundary navigation and multi-character typeahead", () => {
    expect(key(initial(), "Home").activeId).toBe("root");
    expect(key(initial(), "End").activeId).toBe("bravo");
    const b = key(initial(), "b"); expect(b.activeId).toBe("beta");
    expect(key(b, "r", 1100).activeId).toBe("bravo");
    expect(key(b, "b", 1100).activeId).toBe("bravo");
  });
  it("reconciles deleted and hidden nodes without dangling active IDs", () => {
    const collapsed = Tree.reconcile({ ...initial(), expandedIds: [] }, nodes);
    expect(collapsed.activeId).toBe("root");
    const removed = Tree.reconcile(initial(), nodes.filter(node => node.id !== "alpha"));
    expect(removed.activeId).toBe("root"); expect(removed.selectedId).toBeNull();
    expect(Tree.reconcile(initial(), []).activeId).toBeNull();
  });
  it("requests rename without mutating application nodes", () => {
    let model = update(initial(), Tree.Message.StartedRename()).model;
    model = update(model, Tree.Message.ChangedDraft({ value: " new name " })).model;
    const renamed = update(model, Tree.Message.CommittedRename());
    expect(renamed.outMessage).toEqual(Tree.OutMessage.Renamed({ id: "alpha", label: "new name" }));
    expect(nodes[2]!.label).toBe("alpha"); expect(renamed.model.editingId).toBeNull();
  });
  it("rejects blank names, cancels edits, and detects concurrent rename", () => {
    const editing = update(initial(), Tree.Message.StartedRename()).model;
    const blank = update({ ...editing, draft: " " }, Tree.Message.CommittedRename());
    expect(blank.outMessage).toBeUndefined(); expect(blank.model.editingId).toBe("alpha");
    expect(update(editing, Tree.Message.CancelledRename()).model.editingId).toBeNull();
    const conflict = Tree.update(editing, Tree.Message.CommittedRename(), { nodes: nodes.map(node => node.id === "alpha" ? { ...node, label: "changed" } : node) });
    expect(conflict.outMessage).toBeUndefined(); expect(conflict.model.announcement).toContain("elsewhere");
  });
  it("calculates sibling moves with indices after removal", () => {
    const model = { ...initial(), activeId: "beta" };
    const move = Tree.moveTarget(model, "Down", { nodes })!;
    expect(move).toEqual({ id: "beta", parentId: "root", index: 2 });
    expect(Tree.moveNodes(nodes, move).filter(node => node.parentId === "root").map(node => node.id)).toEqual(["folder", "bravo", "beta"]);
  });
  it("indents beneath the previous folder and outdents after a parent", () => {
    const indent = Tree.moveTarget({ ...initial(), activeId: "beta" }, "Indent", { nodes })!;
    expect(indent).toEqual({ id: "beta", parentId: "folder", index: 1 });
    const moved = Tree.moveNodes(nodes, indent);
    expect(moved.find(node => node.id === "beta")?.parentId).toBe("folder");
    expect(Tree.moveTarget({ ...initial(), activeId: "beta" }, "Outdent", { nodes: moved })).toEqual({ id: "beta", parentId: "root", index: 1 });
  });
  it("moves subtrees intact and rejects cycles, invalid indices and leaf parents", () => {
    const moved = Tree.moveNodes(nodes, { id: "folder", parentId: null, index: 1 });
    expect(moved.find(node => node.id === "alpha")?.parentId).toBe("folder");
    for (const move of [{ id: "root", parentId: "folder", index: 0 }, { id: "folder", parentId: "beta", index: 0 }, { id: "beta", parentId: null, index: 99 }]) {
      expect(Tree.moveNodes(nodes, move)).toBe(nodes);
    }
  });
  it("applies host restrictions to both available actions and emitted requests", () => {
    const config = { nodes, canMove: () => false };
    expect(Tree.moveTarget(initial(), "Outdent", config)).toBeUndefined();
    expect(Tree.update(initial(), Tree.Message.Moved({ direction: "Outdent" }), config).outMessage).toBeUndefined();
  });
  it("rejects malformed forests instead of dropping records", () => {
    for (const malformed of [[node("x", null), node("x", null)], [node("x", "missing")], [node("x", "y", true), node("y", "x", true)]]) {
      expect(() => Tree.visibleNodes(initial(), malformed)).toThrow();
    }
  });
});
