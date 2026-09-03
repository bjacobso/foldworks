import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import * as Checkbox from "./checkbox";
import * as Fieldset from "./fieldset";
import * as Switch from "./switch";

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

const attr = (html: Html, selector: string, name: string) =>
  Option.getOrUndefined(Scene.attr(find(html, selector), name));

describe("styled choice controls", () => {
  it("preserves Foldkit checkbox semantics and description linkage", () => {
    const html = Checkbox.view({
      id: "terms",
      label: "Accept terms",
      description: "Required to continue",
      isChecked: true,
      onToggle: () => undefined as never,
    }, h);

    expect(attr(html, "button", "role")).toBe("checkbox");
    expect(attr(html, "button", "aria-checked")).toBe("true");
    const describedBy = attr(html, "button", "aria-describedby");
    expect(describedBy).toBe("terms-description");
    expect(attr(html, `[id="${describedBy}"]`, "id")).toBe(describedBy);
  });

  it("preserves Foldkit switch semantics", () => {
    const html = Switch.view({
      id: "updates",
      label: "Product updates",
      isChecked: false,
      onToggle: () => undefined as never,
    }, h);

    expect(attr(html, "button", "role")).toBe("switch");
    expect(attr(html, "button", "aria-checked")).toBe("false");
    expect(attr(html, "[id=\"updates-description\"]", "id")).toBe("updates-description");
  });

  it("links fieldset descriptions without owning child behavior", () => {
    const html = Fieldset.view({
      id: "preferences",
      legend: "Preferences",
      description: "Choose your defaults",
      children: ["Content"],
    }, h);

    expect(attr(html, "fieldset", "aria-describedby")).toBe("preferences-description");
    expect(attr(html, "legend", "id")).toBe("preferences-legend");
    expect(attr(html, "[id=\"preferences-description\"]", "id")).toBe("preferences-description");
  });
});
