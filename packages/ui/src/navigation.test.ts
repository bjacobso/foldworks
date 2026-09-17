import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { Breadcrumb, collapseBreadcrumbItems } from "./navigation";

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

describe("Breadcrumb", () => {
  it("renders message-driven items as buttons and href items as links", () => {
    const html = Breadcrumb.view({
      items: [
        { label: "Home", href: "/" },
        { label: "Schemas", onClick: {} as never },
      ],
      current: "Invoice",
    }, h);

    expect(Option.getOrUndefined(Scene.attr(find(html, "a"), "href"))).toBe("/");
    expect(find(html, "button")).toBeDefined();
    expect(Option.getOrUndefined(Scene.attr(find(html, '[aria-current="page"]'), "aria-current"))).toBe("page");
  });

  it("collapses the middle and exposes an actionable overflow control", () => {
    const items = ["Home", "Workspace", "Project", "Folder", "Schema"].map((label) => ({ label, href: "#" }));
    const entries = collapseBreadcrumbItems(items, "Invoice", {
      maxItems: 4,
      itemsBeforeCollapse: 1,
      itemsAfterCollapse: 2,
    });
    const html = Breadcrumb.view({
      items,
      current: "Invoice",
      maxItems: 4,
      itemsBeforeCollapse: 1,
      itemsAfterCollapse: 2,
      onExpand: {} as never,
    }, h);

    expect(entries.map((entry) => entry.kind)).toEqual(["item", "overflow", "item", "current"]);
    expect(Option.getOrUndefined(Scene.attr(find(html, "button"), "aria-label"))).toBe("Show 3 hidden breadcrumb items");
  });

  it("rejects collapse settings that cannot fit the overflow item", () => {
    expect(() => collapseBreadcrumbItems(
      [{ label: "A" }, { label: "B" }, { label: "C" }],
      "D",
      { maxItems: 2 },
    )).toThrow(/must fit/);
  });
});
