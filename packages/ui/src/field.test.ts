import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import * as Field from "./field";

const attribute = (html: Html, selector: string, name: string) => {
  if (html === null) throw new Error("Expected a rendered field");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return Option.getOrUndefined(Scene.attr(node, name));
};

const controls = [
  ["input", (description?: string) => Field.input({
    id: "name",
    label: "Name",
    ...(description === undefined ? {} : { description }),
  }, h)],
  ["textarea", (description?: string) =>
    Field.textarea({
      id: "notes",
      label: "Notes",
      ...(description === undefined ? {} : { description }),
    }, h)],
  ["select", (description?: string) =>
    Field.select({
      id: "role",
      label: "Role",
      ...(description === undefined ? {} : { description }),
      options: [],
    }, h)],
] as const;

describe("Field accessibility", () => {
  for (const [selector, render] of controls) {
    it(`links ${selector} descriptions to the control`, () => {
      const html = render("Helpful context");
      const describedBy = attribute(html, selector, "aria-describedby");

      expect(describedBy).toBeDefined();
      expect(attribute(html, "p", "id")).toBe(describedBy);
    });

    it(`does not leave a dangling ${selector} description reference`, () => {
      const html = render();
      const describedBy = attribute(html, selector, "aria-describedby");

      expect(describedBy).toBeDefined();
      expect(attribute(html, `[id="${describedBy}"]`, "id")).toBe(describedBy);
    });
  }
});
