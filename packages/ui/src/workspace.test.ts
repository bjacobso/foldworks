import { describe, expect, it } from "vitest";
import * as Workspace from "./workspace";

const init = () => Workspace.init({ id: "test", size: 300, minSize: 150, maxSize: 500, secondaryMinSize: 200 });
describe("workspace sizing", () => {
  it("rejects invalid constraints and clamps an initial size", () => {
    for (const config of [{ minSize: -1 }, { minSize: 300, maxSize: 100 }, { size: NaN }, { secondaryMinSize: Infinity }]) {
      expect(() => Workspace.init({ id: "test", ...config })).toThrow();
    }
    expect(Workspace.init({ id: "test", size: 999 }).size).toBe(600);
  });
  it("preserves the preferred width across narrow and wider containers", () => {
    const narrow = Workspace.update(init(), Workspace.Message.Measured({ extent: 408 })).model;
    expect(Workspace.currentSize(narrow)).toBe(200);
    expect(narrow.size).toBe(300);
    const wide = Workspace.update(narrow, Workspace.Message.Measured({ extent: 900 })).model;
    expect(Workspace.currentSize(wide)).toBe(300);
  });
  it("keeps minimum sizes when the workspace must overflow", () => {
    const model = Workspace.update(init(), Workspace.Message.Measured({ extent: 100 })).model;
    expect(Workspace.currentSize(model)).toBe(150);
    expect(Workspace.maximumSize(model)).toBe(150);
  });
  it("restores the preferred size when cancelling a drag in a constrained container", () => {
    const constrained = Workspace.update(init(), Workspace.Message.Measured({ extent: 408 })).model;
    const dragged = Workspace.update(constrained, Workspace.Message.Resized({ size: 180 })).model;
    const cancelled = Workspace.update(dragged, Workspace.Message.CancelledResize({ size: constrained.size })).model;
    expect(cancelled.size).toBe(300);
    expect(Workspace.currentSize(cancelled)).toBe(200);
  });
  it("clamps requests against both panes and ignores invalid measurements", () => {
    const model = Workspace.update(init(), Workspace.Message.Measured({ extent: 600 })).model;
    expect(Workspace.update(model, Workspace.Message.Resized({ size: 1000 })).model.size).toBe(392);
    expect(Workspace.update(model, Workspace.Message.Resized({ size: -100 })).model.size).toBe(150);
    expect(Workspace.update(model, Workspace.Message.Resized({ size: NaN })).model).toBe(model);
    expect(Workspace.update(model, Workspace.Message.Measured({ extent: 0 })).model).toBe(model);
  });
  it("restores the saved width and emits a focus command on collapse", () => {
    const result = Workspace.update(init(), Workspace.Message.Toggled());
    expect(result.commands).toHaveLength(1);
    expect(Workspace.currentSize(result.model)).toBe(0);
    expect(result.model.size).toBe(300);
    expect(Workspace.currentSize(Workspace.update(result.model, Workspace.Message.Toggled()).model)).toBe(300);
  });
  it("supports an always-open primary pane", () => {
    const model = Workspace.init({ id: "fixed", collapsible: false, collapsed: true });
    expect(model.collapsed).toBe(false);
    expect(Workspace.update(model, Workspace.Message.Toggled()).model).toBe(model);
  });
});
