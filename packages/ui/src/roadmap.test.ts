import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { Heading, Link, Text, VisuallyHidden } from "./content";
import * as Layout from "./layout";
import { NumberField } from "./number-field";
import { Stepper } from "./stepper";
import { Tag } from "./tag";
import * as Combobox from "./stateful/combobox";
import * as Menu from "./stateful/menu";
import * as Popover from "./stateful/popover";
import * as Toast from "./stateful/toast";
import * as Tooltip from "./stateful/tooltip";

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};
const attr = (html: Html, selector: string, name: string) => Option.getOrUndefined(Scene.attr(find(html, selector), name));

describe("semantic content primitives", () => {
  it("keeps heading semantics separate from visual size and secures external links", () => {
    const heading = Heading.view({ level: 3, size: "xl", children: ["Roadmap"] }, h);
    const link = Link.view({ href: "https://example.com", external: true, children: ["Reference"] }, h);
    const text = Text.view({ as: "span", tone: "muted", truncate: true, children: ["Supporting copy"] }, h);
    const skip = VisuallyHidden.view({ focusable: true, children: ["Skip to content"] }, h);

    expect(find(heading, "h3")).toBeDefined();
    expect(attr(link, "a", "target")).toBe("_blank");
    expect(attr(link, "a", "rel")).toBe("noreferrer noopener");
    expect(find(text, "span")).toBeDefined();
    expect(attr(skip, "span", "tabIndex")).toBe("0");
  });
});

describe("responsive layout primitives", () => {
  it("emits mobile-first variables for stacks, grids, and containers", () => {
    const stack = Layout.Stack.view({ direction: { base: "column", md: "row" }, gap: { base: "sm", lg: "xl" }, children: ["A", "B"] }, h);
    const grid = Layout.Grid.view({ columns: { base: 1, sm: 2, lg: 4 }, gap: "md", responsiveTo: "container", children: ["A"] }, h);
    const container = Layout.Container.view({ size: "lg", query: true, padding: { base: "sm", md: "lg" }, children: ["A"] }, h);

    expect(find(stack, "div")).toBeDefined();
    expect(find(grid, "div")).toBeDefined();
    expect(find(container, "div")).toBeDefined();
  });

  it("rejects invalid explicit column counts", () => {
    expect(() => Layout.Grid.view({ columns: 0, children: [] }, h)).toThrow(/1 through 12/);
  });
});

describe("compound presentation primitives", () => {
  it("normalizes decimal stepping without floating point drift", () => {
    expect(NumberField.stepValue(0.2, 1, { step: 0.1 })).toBe(0.3);
    expect(NumberField.stepValue(10, 1, { step: 2, max: 10 })).toBe(10);
    expect(NumberField.normalize(-2, { min: 0 })).toBe(0);
  });

  it("renders labelled numeric controls, actionable tags, and step progress", () => {
    const number = NumberField.view({ id: "quantity", label: "Quantity", value: 2, min: 0, onChange: () => undefined as never }, h);
    const tag = Tag.view({ label: "Finance", isSelected: true, onSelect: {} as never, onRemove: {} as never }, h);
    const stepper = Stepper.view({ currentStepId: "review", steps: [
      { id: "details", label: "Details" }, { id: "review", label: "Review" }, { id: "publish", label: "Publish" },
    ] }, h);

    expect(attr(number, "input", "type")).toBe("number");
    expect(attr(tag, "button", "aria-pressed")).toBe("true");
    expect(attr(stepper, '[aria-current="step"]', "data-status")).toBe("current");
  });
});

describe("styled floating engines", () => {
  it("adapts grouped menu items to the typed Foldkit menu", () => {
    const TestMenu = Menu.create<"edit" | "delete">();
    const inputs = Menu.styledViewInputs({
      trigger: ["Actions"], ariaLabel: "Document actions",
      items: [
        { value: "edit", label: "Edit", group: "Document" },
        { value: "delete", label: "Delete", group: "Document", isDestructive: true },
      ],
    }, h);
    Scene.scene(
      { update: TestMenu.update, view: Scene.withViewInputs(TestMenu.view, inputs)() },
      Scene.given({ ...Menu.init({ id: "actions" }), isOpen: true }),
      Scene.Mount.resolve(Menu.PortalMenuBackdrop, Menu.Message.CompletedPortalMenuBackdrop()),
      Scene.Mount.resolve(Menu.AnchorMenu, Menu.Message.CompletedAnchorMenu()),
      Scene.expect(Scene.role("button", { name: "Document actions" })).toHaveAttr("aria-expanded", "true"),
      Scene.expect(Scene.role("menuitem", { name: "Edit" })).toExist(),
    );
  });

  it("renders anchored popover and tooltip surfaces through headless lifecycles", () => {
    const popoverInputs = Popover.styledViewInputs({ trigger: ["Filters"], content: ["Filter content"], ariaLabel: "Filters" }, h);
    Scene.scene(
      { update: Popover.update, view: Scene.withViewInputs(Popover.view, popoverInputs)() },
      Scene.given({ ...Popover.init({ id: "filters" }), isOpen: true }),
      Scene.Mount.resolve(Popover.PortalPopoverBackdrop, Popover.Message.CompletedPortalPopoverBackdrop()),
      Scene.Mount.resolve(Popover.AnchorPopover, Popover.Message.CompletedAnchorPopover()),
      Scene.expect(Scene.role("dialog")).toExist(),
    );

    const tooltipInputs = Tooltip.styledViewInputs({ trigger: ["Help"], label: "Helpful context" }, h);
    Scene.scene(
      { update: Tooltip.update, view: Scene.withViewInputs(Tooltip.view, tooltipInputs)() },
      Scene.given({ ...Tooltip.init({ id: "help", showDelay: 0 }), isOpen: true }),
      Scene.Mount.resolve(Tooltip.AnchorTooltip, Tooltip.Message.CompletedAnchorTooltip()),
      Scene.expect(Scene.role("tooltip", { name: "Helpful context" })).toExist(),
    );
  });

  it("filters and styles single and multi combobox inputs", () => {
    const options = [
      { value: "people", label: "People", keywords: ["team"] },
      { value: "operations", label: "Operations" },
    ] as const;
    expect(Combobox.filterOptions(options, "team").map(({ value }) => value)).toEqual(["people"]);
    const TestCombobox = Combobox.create<"people" | "operations">();
    const inputs = Combobox.styledViewInputs({ options, query: "", value: "people", ariaLabel: "Department" }, h);
    Scene.scene(
      { update: TestCombobox.update, view: Scene.withViewInputs(TestCombobox.view, inputs)() },
      Scene.given({ ...Combobox.init({ id: "department" }), isOpen: true, inputValue: "People" }),
      Scene.Mount.resolve(Combobox.AttachComboboxPreventBlur, Combobox.Message.CompletedAttachComboboxPreventBlur()),
      Scene.Mount.resolve(Combobox.PortalComboboxBackdrop, Combobox.Message.CompletedPortalComboboxBackdrop()),
      Scene.Mount.resolve(Combobox.AnchorCombobox, Combobox.Message.CompletedAnchorCombobox()),
      Scene.expect(Scene.role("combobox", { name: "Department" })).toHaveAttr("aria-expanded", "true"),
      Scene.expect(Scene.role("option", { name: "People" })).toHaveAttr("aria-selected", "true"),
    );
  });
});

describe("stateful toast adapter", () => {
  it("renders standard payloads with variant semantics and dismiss controls", () => {
    const shown = Toast.show(Toast.init({ id: "notices" }), {
      payload: { title: "Saved", description: "Workspace updated." }, variant: "Success", sticky: true,
    });
    Scene.scene(
      { update: Toast.update, view: Scene.withViewInputs(Toast.view, Toast.styledViewInputs({}, h))() },
      Scene.given(shown.model),
      Scene.expect(Scene.role("status")).toExist(),
      Scene.expect(Scene.role("button", { name: "Dismiss Saved" })).toExist(),
    );
  });
});
