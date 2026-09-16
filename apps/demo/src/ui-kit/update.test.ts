import { Stateful } from "@foldworks/ui";
import { describe, expect, it } from "vitest";

import { Message } from "./message";
import { initialModel } from "./model";
import { update } from "./update";

describe("UI foundation demos", () => {
  it("keeps the stepper and removable multi-select tags interactive", () => {
    const stepped = update(initialModel, Message.SelectedFoundationStep({ value: "Ship" })).model;
    const removed = update(stepped, Message.RemovedTool({ value: "Toast" })).model;

    expect(stepped.foundationStep).toBe("Ship");
    expect(removed.selectedTools).toEqual(["Combobox"]);
    expect(removed.announcement).toContain("Toast removed");
  });

  it("creates a managed toast and lifts its timer command", () => {
    const result = update(initialModel, Message.RequestedToast({ variant: "Success" }));

    expect(result.model.toasts.entries).toHaveLength(1);
    expect(result.model.toasts.entries[0]).toMatchObject({
      variant: "Success",
      payload: { title: "Success notification" },
    });
    expect(result.commands?.map(({ name }) => name)).toContain(Stateful.Toast.WaitBeforeDismissal.name);
  });

  it("folds typed menu and combobox selections into application state", () => {
    const menu = update(initialModel, Message.GotActionMenuMessage({
      message: Stateful.Menu.Message.SelectedItem({ index: 0, item: "Edit" }),
    })).model;
    const combobox = update(initialModel, Message.GotComboboxMessage({
      message: Stateful.Combobox.Message.SelectedItem({
        item: "Engineering", displayText: "Engineering", wasSelected: false,
      }),
    })).model;

    expect(menu.announcement).toContain("Edit selected");
    expect(combobox.department).toBe("Engineering");
  });
});
