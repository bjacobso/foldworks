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
    const html = view(
      {
        model,
        toParentMessage: () => undefined as never,
        brand: { title: "Foldworks", description: "Primitives", href: "/", icon: Blocks },
        groups: [
          {
            id: "packages",
            label: "Packages",
            items: [
              {
                id: "data",
                label: "Data grid",
                href: "/data",
                icon: Table2,
                isActive: true,
                badge: "New",
              },
            ],
          },
        ],
        header: h.header([], ["Header"]),
        content: h.div([], ["Content"]),
        footer: { title: "Ben", description: "Owner", icon: User },
      },
      h,
    );

    expect(attr(html, '[data-sidebar-provider="test-sidebar"]', "data-state")).toBe("expanded");
    expect(attr(html, '[href="/data"]', "aria-current")).toBe("page");
    expect(attr(html, '[aria-controls="test-sidebar-desktop"]', "aria-expanded")).toBe("true");
    expect(attr(html, '[data-sidebar="mobile"]', "aria-hidden")).toBe("true");
  });

  it("renders message-driven items that dispatch their message and close the mobile drawer", () => {
    type Parent =
      | Readonly<{ _tag: "Opened"; page: string }>
      | Readonly<{ _tag: "Sidebar"; message: Message }>;
    type State = Readonly<{ opened: ReadonlyArray<string>; sidebar: ReturnType<typeof init> }>;
    const opened = (page: string): Parent => ({ _tag: "Opened", page });

    Scene.scene(
      {
        update: (model: State, message: Parent) => ({
          model:
            message._tag === "Opened"
              ? { ...model, opened: [...model.opened, message.page] }
              : { ...model, sidebar: update(model.sidebar, message.message).model },
        }),
        view: (model: State, builder) =>
          view<Parent>(
            {
              model: model.sidebar,
              toParentMessage: (message) => ({ _tag: "Sidebar", message }),
              brand: { title: "Foldworks", href: "/", icon: Blocks },
              groups: [
                {
                  id: "pages",
                  items: [
                    {
                      id: "identity",
                      label: "Identity",
                      onClick: opened("identity"),
                      icon: Table2,
                      isActive: model.opened.at(-1) === "identity",
                      count: 4,
                      countLabel: "4 hidden fields",
                      items: [
                        { id: "address", label: "Address", onClick: opened("address"), count: 2 },
                      ],
                    },
                    { id: "docs", label: "Docs", href: "/docs", icon: Table2 },
                  ],
                },
              ],
              header: builder.header([], ["Header"]),
              content: builder.div([], ["Content"]),
            },
            builder,
          ),
      },
      Scene.given<State>({
        opened: [],
        sidebar: update(init({ id: "pages" }), Message.ToggledMobile()).model,
      }),
      Scene.expect(Scene.selector('[data-sidebar="mobile"]')).toHaveAttr("aria-hidden", "false"),
      Scene.expect(
        Scene.selector('[data-sidebar="desktop"] [data-sidebar-item="identity"]'),
      ).toHaveAttr("type", "button"),
      Scene.expect(
        Scene.selector('[data-sidebar="desktop"] [data-sidebar-item="docs"]'),
      ).toHaveAttr("href", "/docs"),
      Scene.click(Scene.selector('[data-sidebar="mobile"] [data-sidebar-item="identity"]')),
      Scene.expect(Scene.selector('[data-sidebar="mobile"]')).toHaveAttr("aria-hidden", "true"),
      Scene.expect(
        Scene.selector('[data-sidebar="desktop"] [data-sidebar-item="identity"]'),
      ).toHaveAttr("aria-current", "page"),
      Scene.expect(
        Scene.selector('[data-sidebar="desktop"] [data-sidebar-item="identity"]'),
      ).not.toHaveAttr("aria-label"),
      Scene.expect(
        Scene.selector('[data-sidebar="desktop"] [data-sidebar-item="identity"] [data-count="4"]'),
      ).toExist(),
      Scene.expect(
        Scene.selector('[data-sidebar="desktop"] [data-sidebar-item="address"] [data-count="2"]'),
      ).toExist(),
    );
  });

  it("hides item counts while the desktop sidebar is collapsed", () => {
    const model = update(init({ id: "collapsed" }), Message.ToggledCollapsed()).model;
    const html = view(
      {
        model,
        toParentMessage: () => undefined as never,
        brand: { title: "Foldworks", href: "/", icon: Blocks },
        groups: [
          {
            id: "pages",
            items: [{ id: "identity", label: "Identity", href: "/", icon: Table2, count: 4 }],
          },
        ],
        header: h.header([], ["Header"]),
        content: h.div([], ["Content"]),
      },
      h,
    );

    if (html === null) throw new Error("Expected rendered sidebar");
    expect(Option.isNone(Scene.find(html, '[data-sidebar="desktop"] [data-count]'))).toBe(true);
    expect(Option.isSome(Scene.find(html, '[data-sidebar="mobile"] [data-count]'))).toBe(true);
    expect(
      attr(html, '[data-sidebar="desktop"] [data-sidebar-item="identity"]', "aria-label"),
    ).toBe("Identity");
  });
});
