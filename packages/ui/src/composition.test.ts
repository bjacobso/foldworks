import * as stylex from "@stylexjs/stylex";
import { Circle } from "@lucide/icons";
import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { Button, Card, Field } from "./index";

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

const attr = (html: Html, selector: string, name: string) =>
  Option.getOrUndefined(Scene.attr(find(html, selector), name));

describe("composition contract", () => {
  it("orders root sx overrides and supports root slot attributes", () => {
    const html = Card.view({
      title: "Review",
      children: ["Content"],
      sx: styles.root,
      slotProps: {
        root: {
          attributes: [h.DataAttribute("composition-root", "card")],
          sx: styles.rootSlot,
        },
      },
    }, h);

    expect(attr(html, "section", "class")).toContain("root rootSlot");
    expect(attr(html, "section", "data-composition-root")).toBe("card");
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
});
