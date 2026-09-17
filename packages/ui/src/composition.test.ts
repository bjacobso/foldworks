import * as stylex from "@stylexjs/stylex";
import { Circle } from "@lucide/icons";
import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { Button, Card, Field, Table, type CardConfig, type IconConfig } from "./index";

const styles = stylex.create({
  root: { color: "green" },
  rootSlot: { color: "blue" },
  internalSlot: { color: "purple" },
});

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

const findAll = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  return Scene.findAll(html, selector);
};

const attr = (html: Html, selector: string, name: string) =>
  Option.getOrUndefined(Scene.attr(find(html, selector), name));

describe("composition contract", () => {
  it("orders root sx overrides and supports root slot attributes", () => {
    const html = Card.view({
      title: "Review",
      children: ["Content"],
      sx: styles.root,
      attributes: [h.DataAttribute("composition-root", "shorthand")],
      slotProps: {
        root: {
          attributes: [h.DataAttribute("composition-root", "slot")],
          sx: styles.rootSlot,
        },
      },
    }, h);

    expect(attr(html, "section", "class")).toContain("root rootSlot");
    expect(attr(html, "section", "data-composition-root")).toBe("slot");
  });

  it("styles and augments named internal slots", () => {
    const html = Card.view({
      title: "Review",
      children: ["Content"],
      slotProps: {
        content: {
          attributes: [h.DataAttribute("composition-slot", "content")],
          sx: styles.internalSlot,
        },
      },
    }, h);

    expect(attr(html, '[data-composition-slot="content"]', "class")).toContain("internalSlot");
  });

  it("uses the same slot shape for behavioral and form components", () => {
    const button = Button.view({
      label: "Continue",
      icon: Circle,
      slotProps: {
        startIcon: { attributes: [h.DataAttribute("composition-slot", "start-icon")] },
        label: {
          attributes: [h.DataAttribute("composition-slot", "label")],
          sx: styles.internalSlot,
        },
      },
    }, h);
    const field = Field.input({
      id: "name",
      label: "Name",
      slotProps: {
        control: {
          attributes: [h.DataAttribute("composition-slot", "control")],
          sx: styles.internalSlot,
        },
      },
    }, h);

    expect(attr(button, '[data-composition-slot="start-icon"]', "data-composition-slot")).toBe("start-icon");
    expect(attr(button, '[data-composition-slot="label"]', "class")).toContain("internalSlot");
    expect(attr(field, '[data-composition-slot="control"]', "class")).toContain("internalSlot");
  });

  it("applies repeated slot props to every rendered table cell", () => {
    const html = Table.view({
      columns: ["Name", "Status"],
      rows: [["Ada", "Active"], ["Lin", "Pending"]],
      slotProps: {
        headerCell: { attributes: [h.DataAttribute("composition-slot", "header-cell")] },
        row: { attributes: [h.DataAttribute("composition-slot", "row")] },
        cell: {
          attributes: [h.DataAttribute("composition-slot", "cell")],
          sx: styles.internalSlot,
        },
      },
    }, h);

    expect(findAll(html, '[data-composition-slot="header-cell"]')).toHaveLength(2);
    expect(findAll(html, '[data-composition-slot="row"]')).toHaveLength(2);
    expect(findAll(html, '[data-composition-slot="cell"]')).toHaveLength(4);
    expect(attr(html, '[data-composition-slot="cell"]', "class")).toContain("internalSlot");
  });

  it("rejects unknown slot names at compile time", () => {
    const acceptsCardConfig = (_config: CardConfig<never>) => undefined;
    acceptsCardConfig({
      children: [],
      slotProps: {
        // @ts-expect-error Card has no arbitrary slot names.
        notACardSlot: { sx: styles.root },
      },
    });

    const acceptsIconConfig = (_config: IconConfig<never>) => undefined;
    acceptsIconConfig({
      icon: Circle,
      sx: styles.root,
      // @ts-expect-error Leaf components expose root sx without a redundant root slot.
      slotProps: { root: { sx: styles.rootSlot } },
    });
  });
});
