import { describe, expect, it } from "vitest";
import { inertHtml as h } from "foldkit/html";
import * as EditableText from "./editable-text";
import * as Overflow from "./overflow-list";
import * as Tokens from "./token-field";
import * as Combobox from "./stateful/combobox";
import * as Stack from "./panel-stack";
import * as Menu from "./stateful/menu-tree";
import * as DateInput from "./date-input";
import * as DatePicker from "./stateful/date-picker";
import * as Calendar from "@foldkit/ui/calendar";
import * as Button from "./button";
import * as Shortcuts from "./shortcuts";

describe("desktop primitives", () => {
  it("partitions overflow deterministically in either direction and preserves first render", () => {
    const items = ["a", "b", "c"].map((id) => ({ id }));
    const widths = { a: 40, b: 50, c: 60 };
    expect(Overflow.partition(items, {}, 100, 30).visible).toEqual(items);
    expect(Overflow.partition(items, widths, 158, 30).visible).toHaveLength(2);
    expect(Overflow.partition(items, widths, 166, 30).overflow).toHaveLength(0);
    expect(
      Overflow.partition(items, widths, 100, 30).visible.map((i) => i.id),
    ).toEqual(["a"]);
    expect(
      Overflow.partition(items, widths, 100, 30, {
        direction: "start",
      }).visible.map((i) => i.id),
    ).toEqual(["c"]);
    expect(
      Overflow.partition(items, widths, 0, 30, { minVisible: 2 }).visible,
    ).toHaveLength(2);
    expect(
      Overflow.partition(items.slice(0, 1), widths, 100, 30).overflow,
    ).toEqual([]);
    expect(() =>
      Overflow.partition([items[0]!, items[0]!], widths, 100, 30),
    ).toThrow();
  });
  it("keeps editing values controlled, validates commits and respects pending/read-only policies", () => {
    const policy = {
      value: "Before",
      validate: (value: string) => (value ? undefined : "Required"),
    };
    const start = EditableText.update(
      EditableText.init("name"),
      EditableText.Message.Started(),
      policy,
    );
    expect(start.commands).toHaveLength(1);
    const changed = EditableText.update(
      start.model,
      EditableText.Message.Changed({ value: "" }),
      policy,
    ).model;
    const invalid = EditableText.update(
      changed,
      EditableText.Message.Committed({ returnFocus: true }),
      policy,
    );
    expect(invalid.model.error).toBe("Required");
    expect(invalid.outMessage).toBeUndefined();
    expect(
      EditableText.update(
        changed,
        EditableText.Message.Cancelled({ returnFocus: true }),
        policy,
      ).model.mode,
    ).toBe("view");
    const commit = EditableText.update(
      start.model,
      EditableText.Message.Committed({ returnFocus: true }),
      policy,
    );
    expect(commit.outMessage).toEqual(
      EditableText.OutMessage.Committed({ value: "Before" }),
    );
    expect(
      EditableText.update(
        start.model,
        EditableText.Message.Committed({ returnFocus: true }),
        { ...policy, isPending: true },
      ).model,
    ).toBe(start.model);
    expect(
      EditableText.update(start.model, EditableText.Message.Blurred(), {
        ...policy,
        blur: "keep",
      }).model.mode,
    ).toBe("edit");
    expect(
      EditableText.update(start.model, EditableText.Message.Blurred(), {
        ...policy,
        blur: "cancel",
      }).outMessage?._tag,
    ).toBe("Cancelled");
  });
  it("tokenizes and deduplicates atomically with host validation and custom-value policy", () => {
    const config: Tokens.Config = {
      values: ["One"],
      options: [{ value: "Two", label: "Two" }],
      allowCustom: true,
      maxCount: 3,
      deduplicate: (v) => v.toLowerCase(),
      validate: (value) => (value === "bad" ? "Rejected" : undefined),
    };
    expect(Tokens.tokenize(" Two; three\n ", config)).toEqual(["Two", "three"]);
    expect(Tokens.add(config.values, ["one", "Two"], config).values).toEqual([
      "One",
      "Two",
    ]);
    expect(Tokens.add(config.values, ["Two", "bad"], config)).toEqual({
      values: ["One"],
      error: "Rejected",
    });
    expect(
      Tokens.add(config.values, ["Two", "three", "four"], config).values,
    ).toEqual(["One"]);
    expect(
      Tokens.add([], ["three"], { ...config, allowCustom: false }).error,
    ).toContain("not an available option");
    const first = Tokens.update(
      Tokens.init("tags"),
      Tokens.Message.Navigated({ key: "Backspace" }),
      config,
    );
    expect(first.model.active).toBe("One");
    const blurred = Tokens.update(
      first.model,
      Tokens.Message.GotCombobox({
        message: Combobox.Message.BlurredInput({
          restingInputValue: "",
          isClearable: true,
        }),
      }),
      config,
    );
    expect(blurred.model.active).toBe("One");
    expect(first.outMessage).toBeUndefined();
    expect(
      Tokens.update(
        first.model,
        Tokens.Message.Navigated({ key: "Delete" }),
        config,
      ).outMessage?.values,
    ).toEqual([]);
    expect(
      Tokens.update(first.model, Tokens.Message.Removed({ value: "One" }), {
        ...config,
        isReadOnly: true,
      }).outMessage,
    ).toBeUndefined();
  });
  it("panel requests leave persistence to the host and accepted pops restore focus", () => {
    const root = Stack.init("inspector", "root");
    expect(
      Stack.update(
        root,
        Stack.Message.RequestedPush({ id: "child", returnFocusId: "origin" }),
      ).model,
    ).toBe(root);
    const child = Stack.push(root, {
      id: "child",
      returnFocusId: "origin",
    }).model;
    expect(Stack.pop(child).model.panels).toEqual(root.panels);
    expect(Stack.pop(child).commands).toHaveLength(1);
    expect(Stack.pop(root).commands).toBeUndefined();
    expect(() =>
      Stack.push(child, { id: "child", returnFocusId: "" }),
    ).toThrow();
  });
  it("navigates nested menus with nearest Escape ownership and controlled check/radio state", () => {
    const items: ReadonlyArray<Menu.Item> = [
      {
        id: "view",
        label: "View",
        children: [
          { id: "disabled", label: "Disabled", isDisabled: true },
          {
            id: "compact",
            label: "Compact",
            kind: "checkbox",
            isChecked: true,
          },
        ],
      },
    ];
    let model = Menu.update(
      Menu.init("menu"),
      Menu.Message.Opened({ x: 10, y: 20 }),
      items,
    ).model;
    model = Menu.update(
      model,
      Menu.Message.Key({ key: "ArrowRight" }),
      items,
    ).model;
    expect(model.path).toEqual(["view", "compact"]);
    const toggle = Menu.update(
      model,
      Menu.Message.Key({ key: "Enter" }),
      items,
    );
    expect(toggle.model.isOpen).toBe(true);
    expect(toggle.outMessage).toEqual({
      _tag: "Selected",
      id: "compact",
      isChecked: false,
    });
    model = Menu.update(
      model,
      Menu.Message.Key({ key: "Escape" }),
      items,
    ).model;
    expect(model.path).toEqual(["view"]);
    expect(model.isOpen).toBe(true);
    expect(
      Menu.update(model, Menu.Message.Key({ key: "Escape" }), items).model
        .isOpen,
    ).toBe(false);
  });
  it("parses calendar dates strictly and applies the same constraints to text commits", () => {
    expect(DateInput.iso.parse("2026-02-29")).toBeUndefined();
    expect(DateInput.iso.parse("2024-02-29")).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
    expect(DateInput.calendarLocale("fr-FR", "Monday").monthNames[0]).toBe(
      "janvier",
    );
    const gb = DateInput.numericLocale("en-GB");
    const us = DateInput.numericLocale("en-US");
    expect(gb.parse("24/09/2026")).toEqual(us.parse("09/24/2026"));
    expect(gb.parse("09/24/2026")).toBeUndefined();
    const config = {
      value: null,
      min: { year: 2026, month: 9, day: 22 },
      disabledDates: [{ year: 2026, month: 9, day: 25 }],
    };
    let model = DateInput.init({ id: "date", today: config.min });
    expect(
      DateInput.update(
        model,
        DateInput.Message.GotPicker({
          message: DatePicker.Message.GotCalendarMessage({
            message: Calendar.Message.ClickedNextMonthButton(),
          }),
        }),
        config,
      ).outMessage,
    ).toBeUndefined();
    model = DateInput.update(
      model,
      DateInput.Message.Changed({ text: "2026-09-25" }),
      config,
    ).model;
    expect(
      DateInput.update(model, DateInput.Message.Committed(), config).model
        .error,
    ).toBe("This date is unavailable.");
    model = DateInput.update(
      model,
      DateInput.Message.Changed({ text: "2026-09-24" }),
      config,
    ).model;
    expect(
      DateInput.update(model, DateInput.Message.Committed(), config).outMessage
        ?.value,
    ).toEqual({ year: 2026, month: 9, day: 24 });
  });
  it("derives button labels, execution and ARIA from a shared definition", () => {
    const vnode = Button.view(
      {
        command: {
          definition: {
            id: "save",
            label: "Save",
            shortcut: Shortcuts.shortcut("s", "Mod"),
          },
          platform: "mac",
          toMessage: () => undefined as never,
        },
      },
      h,
    );
    expect(JSON.stringify(vnode)).toContain("Meta+s");
    expect(JSON.stringify(vnode)).toContain("Save");
  });
});
