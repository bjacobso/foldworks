import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { Blocks, Table2, User } from "@lucide/icons";
import { describe, expect, it } from "vitest";

import { Message } from "./message";
import { init } from "./model";
import { update } from "./update";
import { view } from "./view";

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

const attr = (html: Html, selector: string, name: string) =>
  Option.getOrUndefined(Scene.attr(find(html, selector), name));

describe("Sidebar", () => {
  it("owns controlled desktop and mobile visibility state", () => {
    const initial = init({ id: "test-sidebar" });
    const collapsed = update(initial, Message.ToggledCollapsed()).model;
    const opened = update(collapsed, Message.ToggledMobile()).model;
    const closed = update(opened, Message.ClosedMobile()).model;

    expect(collapsed.isCollapsed).toBe(true);
    expect(collapsed.announcement).toBe("Navigation collapsed.");
    expect(opened.isMobileOpen).toBe(true);
    expect(closed.isMobileOpen).toBe(false);
  });

  it("renders grouped navigation, inset content, triggers, and active state", () => {
    const model = init({ id: "test-sidebar" });
    const html = view({
      model,
      toParentMessage: () => undefined as never,
      brand: { title: "Foldworks", description: "Primitives", href: "/", icon: Blocks },
      groups: [{
        id: "packages",
        label: "Packages",
        items: [{ id: "data", label: "Data grid", href: "/data", icon: Table2, isActive: true, badge: "New" }],
      }],
      header: h.header([], ["Header"]),
      content: h.div([], ["Content"]),
      footer: { title: "Ben", description: "Owner", icon: User },
    }, h);

    expect(attr(html, '[data-sidebar-provider="test-sidebar"]', "data-state")).toBe("expanded");
    expect(attr(html, '[href="/data"]', "aria-current")).toBe("page");
    expect(attr(html, '[aria-controls="test-sidebar-desktop"]', "aria-expanded")).toBe("true");
    expect(attr(html, '[data-sidebar="mobile"]', "aria-hidden")).toBe("true");
  });
});
