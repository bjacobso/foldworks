import { Option } from "effect";
import { Minus } from "@lucide/icons";
import { inertHtml as h, type Html, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import * as Button from "./button";
import * as Checkbox from "./checkbox";
import * as Field from "./field";
import { Input, Label, NativeSelect, RadioGroup, Textarea } from "./forms";
import { NumberField } from "./number-field";
import * as ReadOnlyValue from "./read-only-value";
import * as Select from "./select";

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

const attr = (html: Html, selector: string, name: string) =>
  Option.getOrUndefined(Scene.attr(find(html, selector), name));

const has = (html: Html, selector: string) =>
  html !== null && Option.isSome(Scene.find(html, selector));

const text = (html: Html, selector: string) => Scene.textContent(find(html, selector));

const options = [
  { value: "eng", label: "Engineering" },
  { value: "ops", label: "Operations" },
];

const expectReadOnlyAnswer = (html: Html) => {
  expect(attr(html, '[role="textbox"]', "aria-readonly")).toBe("true");
  expect(attr(html, '[role="textbox"]', "tabIndex")).toBe("0");
  expect(attr(html, '[role="textbox"]', "disabled")).toBeUndefined();
  expect(attr(html, '[role="textbox"]', "aria-disabled")).toBeUndefined();
};

describe("ReadOnlyValue", () => {
  it("exposes a focusable read-only textbox, not a disabled control", () => {
    const html = ReadOnlyValue.view({ value: "Ada Lovelace", ariaLabel: "Legal name" }, h);

    expectReadOnlyAnswer(html);
    expect(attr(html, "div", "aria-label")).toBe("Legal name");
    expect(attr(html, "div", "data-empty")).toBe("false");
    expect(text(html, "div")).toBe("Ada Lovelace");
  });

  it("announces a missing answer and accepts a custom empty label", () => {
    const fallback = ReadOnlyValue.view({ ariaLabel: "Middle name" }, h);
    const custom = ReadOnlyValue.view(
      { ariaLabel: "Middle name", value: "", emptyLabel: "Not answered" },
      h,
    );

    expect(attr(fallback, "div", "data-empty")).toBe("true");
    expect(attr(fallback, '[aria-hidden="true"]', "aria-hidden")).toBe("true");
    expect(text(fallback, "div")).toContain("No value");
    expect(text(custom, "div")).toBe("Not answered");
  });

  it("marks multiline answers and submits a hidden form value", () => {
    const html = ReadOnlyValue.view(
      {
        value: "Engineering",
        formValue: "eng",
        name: "department",
        ariaLabel: "Department",
        isMultiline: true,
      },
      h,
    );

    expect(attr(html, "div", "aria-multiline")).toBe("true");
    expect(attr(html, 'input[type="hidden"]', "name")).toBe("department");
    expect(attr(html, 'input[type="hidden"]', "value")).toBe("eng");
  });

  it("renders rich children in place of plain text", () => {
    const html = ReadOnlyValue.view(
      { ariaLabel: "Address", children: [h.span([], ["1 Main St"])] },
      h,
    );

    expect(text(html, "div")).toBe("1 Main St");
  });
});

describe("value presentation", () => {
  it("shows Input and Textarea answers without an editable control", () => {
    const input = Input.view(
      { ariaLabel: "Given name", value: "Ada", name: "given", presentation: "value" },
      h,
    );
    const textarea = Textarea.view(
      { ariaLabel: "Notes", value: "Line one\nLine two", presentation: "value" },
      h,
    );

    expectReadOnlyAnswer(input);
    expect(has(input, 'input[type="text"]')).toBe(false);
    expect(text(input, '[role="textbox"]')).toBe("Ada");
    expect(attr(input, 'input[type="hidden"]', "value")).toBe("Ada");
    expect(attr(textarea, '[role="textbox"]', "aria-multiline")).toBe("true");
    expect(has(textarea, "textarea")).toBe(false);
  });

  it("masks password answers with a fixed length", () => {
    const html = Input.view(
      { ariaLabel: "Password", type: "password", value: "hunter2", presentation: "value" },
      h,
    );

    expect(text(html, '[role="textbox"]')).toBe("••••••••");
  });

  it("omits form submission for explicitly disabled answers", () => {
    const input = Input.view(
      {
        ariaLabel: "Given name",
        value: "Ada",
        name: "given",
        isDisabled: true,
        presentation: "value",
      },
      h,
    );
    const field = Field.input(
      {
        id: "name",
        label: "Name",
        value: "Ada",
        name: "name",
        isDisabled: true,
        presentation: "value",
      },
      h,
    );
    const native = NativeSelect.view(
      {
        value: "ops",
        options,
        ariaLabel: "Team",
        name: "team",
        isDisabled: true,
        presentation: "value",
      },
      h,
    );

    expect(has(input, 'input[type="hidden"]')).toBe(false);
    expect(has(field, 'input[type="hidden"]')).toBe(false);
    expect(has(native, 'input[type="hidden"]')).toBe(false);
  });

  it("names a bare answer through an external label", () => {
    const view = (_model: null, h: HtmlBuilder<never>) =>
      h.div(
        [],
        [
          Label.view({ id: "given-label", for: "given", children: ["Given name"] }, h),
          Input.view(
            { id: "given", ariaLabelledBy: "given-label", value: "Ada", presentation: "value" },
            h,
          ),
        ],
      );

    Scene.scene(
      { update: (model: null) => ({ model }), view },
      Scene.given(null),
      Scene.expect(Scene.role("textbox")).toHaveAccessibleName("Given name"),
    );
  });

  it("shows option labels for native selects and radio groups", () => {
    const native = NativeSelect.view(
      { value: "ops", options, ariaLabel: "Team", name: "team", presentation: "value" },
      h,
    );
    const compact = Select.control(
      {
        value: "eng",
        options,
        ariaLabel: "Team",
        presentation: "value",
        onChange: () => undefined as never,
      },
      h,
    );
    const radio = RadioGroup.view(
      {
        name: "team",
        value: "eng",
        options,
        ariaLabel: "Team",
        presentation: "value",
        onChange: () => undefined as never,
      },
      h,
    );
    const unanswered = RadioGroup.view(
      {
        name: "team",
        options,
        ariaLabel: "Team",
        presentation: "value",
        onChange: () => undefined as never,
      },
      h,
    );

    expect(text(native, '[role="textbox"]')).toBe("Operations");
    expect(attr(native, 'input[type="hidden"]', "value")).toBe("ops");
    expect(has(native, "select")).toBe(false);
    expect(text(compact, '[role="textbox"]')).toBe("Engineering");
    expect(text(radio, '[role="textbox"]')).toBe("Engineering");
    expect(has(radio, 'input[type="radio"]')).toBe(false);
    expect(attr(unanswered, '[role="textbox"]', "data-empty")).toBe("true");
    expect(has(unanswered, 'input[type="hidden"]')).toBe(false);
  });

  it("keeps checkbox semantics read-only instead of disabled", () => {
    const html = Checkbox.view(
      {
        id: "consent",
        label: "Consented to background check",
        isChecked: true,
        presentation: "value",
        onToggle: () => undefined as never,
      },
      h,
    );

    expect(attr(html, '[role="checkbox"]', "aria-readonly")).toBe("true");
    expect(attr(html, '[role="checkbox"]', "aria-checked")).toBe("true");
    expect(attr(html, '[role="checkbox"]', "aria-disabled")).toBeUndefined();
  });

  it("formats number answers and links field labels and descriptions", () => {
    const number = NumberField.view(
      {
        id: "hours",
        label: "Hours per week",
        description: "Scheduled hours",
        value: 37.5,
        presentation: "value",
        formatValue: (value) => `${value} h`,
        onChange: () => undefined as never,
      },
      h,
    );
    const field = Field.select(
      {
        id: "team",
        label: "Team",
        description: "Primary team",
        value: "ops",
        options,
        presentation: "value",
        error: "Confirm the team",
      },
      h,
    );

    expect(text(number, '[role="textbox"]')).toBe("37.5 h");
    expect(has(number, "button")).toBe(false);
    expect(attr(number, '[role="textbox"]', "aria-labelledby")).toBe("hours-label");
    expect(attr(number, '[role="textbox"]', "aria-describedby")).toBe("hours-description");
    expect(text(field, '[role="textbox"]')).toBe("Operations");
    expect(attr(field, '[role="textbox"]', "aria-labelledby")).toBe("team-label");
    expect(attr(field, '[role="textbox"]', "aria-invalid")).toBe("true");
    expect(text(field, '[id="team-description"]')).toBe("Confirm the team");
  });
});

describe("committed input values", () => {
  type Model = Readonly<{ draft: string; committed: string }>;
  type Message = Readonly<{ _tag: "Typed" | "Committed"; value: string }>;
  const update = (model: Model, message: Message) => ({
    model:
      message._tag === "Typed"
        ? { ...model, draft: message.value }
        : { ...model, committed: message.value },
  });

  it("reports Input onChange separately from onInput", () => {
    const view = (model: Model, h: HtmlBuilder<Message>) =>
      h.div(
        [],
        [
          Input.view<Message>(
            {
              ariaLabel: "Sample",
              value: model.draft,
              onInput: (value) => ({ _tag: "Typed", value }),
              onChange: (value) => ({ _tag: "Committed", value }),
            },
            h,
          ),
          h.output([], [model.committed]),
        ],
      );
    const input = Scene.role("textbox", { name: "Sample" });

    Scene.scene(
      { update, view },
      Scene.given({ draft: "", committed: "" }),
      Scene.type(input, "42"),
      Scene.expect(input).toHaveValue("42"),
      Scene.expect(Scene.selector("output")).toHaveText(""),
      Scene.change(input, "42"),
      Scene.expect(Scene.selector("output")).toHaveText("42"),
    );
  });

  it("attaches commit handlers to Textarea and Field controls", () => {
    const commit = (value: string): Message => ({ _tag: "Committed", value });

    const field = (_model: Model, h: HtmlBuilder<Message>) =>
      h.div(
        [],
        [
          Field.input({ id: "a", label: "A", onChange: commit }, h),
          Field.textarea({ id: "b", label: "B", onChange: commit }, h),
          Field.input({ id: "c", label: "C", isReadOnly: true, onChange: commit }, h),
          Textarea.view({ id: "notes", ariaLabel: "Notes", onChange: commit }, h),
        ],
      );
    Scene.scene(
      { update, view: field },
      Scene.given({ draft: "", committed: "" }),
      Scene.expect(Scene.selector("#a")).toHaveHandler("change"),
      Scene.expect(Scene.selector("#b")).toHaveHandler("change"),
      Scene.expect(Scene.selector("#c")).not.toHaveHandler("change"),
      Scene.expect(Scene.selector("#notes")).toHaveHandler("change"),
    );
  });
});

describe("Button icon and link", () => {
  it("requires an accessible label for icon buttons", () => {
    const html = Button.icon(
      { icon: Minus, label: "Zoom out", size: "sm", onClick: undefined as never },
      h,
    );

    expect(attr(html, "button", "aria-label")).toBe("Zoom out");
    expect(attr(html, "button", "type")).toBe("button");
    expect(() => Button.icon({ icon: Minus, label: " " }, h)).toThrow(/label/);
  });

  it("keeps button semantics for link-styled actions", () => {
    const html = Button.view(
      { label: "Back to journeys", variant: "link", onClick: undefined as never },
      h,
    );

    expect(attr(html, "button", "type")).toBe("button");
    expect(text(html, "button")).toBe("Back to journeys");
  });
});
