import * as stylex from "@stylexjs/stylex";
import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { AppHeader, Badge, Breadcrumb, SplitView } from "./index";

const custom = stylex.create({ paneSlot: { color: "blue" }, pane: { color: "purple" } });

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
const style = (html: Html, selector: string): Readonly<Record<string, string>> =>
  (find(html, selector).data?.style ?? {}) as Readonly<Record<string, string>>;
const classes = (html: Html, selector: string) =>
  String(attr(html, selector, "class") ?? "").split(" ");

describe("SplitView", () => {
  it("builds the split grid template from pane widths", () => {
    const html = SplitView.view(
      {
        gap: "sm",
        panes: [
          { label: "Journeys", width: "280px", children: ["List"] },
          { label: "Form", children: ["Form"] },
          { label: "PDF", width: "minmax(320px, 1fr)", sticky: true, children: ["PDF"] },
        ],
      },
      h,
    );

    expect(attr(html, "[data-split-view]", "data-split-view")).toBe("3");
    expect(style(html, "[data-split-view]")["--foldworks-split-columns"]).toBe(
      "280px minmax(0, 1fr) minmax(320px, 1fr)",
    );
    expect(findAll(html, "section")).toHaveLength(3);
    expect(attr(html, '[data-split-pane="3"]', "aria-label")).toBe("PDF");
  });

  it("uses the requested breakpoint and query source", () => {
    const viewport = SplitView.view(
      { collapseBelow: "lg", panes: [{ children: ["A"] }, { children: ["B"] }] },
      h,
    );
    const container = SplitView.view(
      { responsiveTo: "container", panes: [{ children: ["A"] }, { children: ["B"] }] },
      h,
    );
    const always = SplitView.view(
      { collapseBelow: "never", panes: [{ children: ["A"] }, { children: ["B"] }] },
      h,
    );

    expect(classes(viewport, "[data-split-view]")).toContain("viewportLg");
    expect(classes(container, "[data-split-view]")).toContain("containerMd");
    expect(classes(always, "[data-split-view]")).toContain("always");
  });

  it("makes sticky and filled panes scroll on their own and keyboard reachable", () => {
    const flowing = SplitView.view(
      {
        stickyOffset: "56px",
        panes: [
          { label: "Form", children: ["A"] },
          { label: "PDF", sticky: true, children: ["B"] },
        ],
      },
      h,
    );
    expect(style(flowing, "[data-split-view]")["--foldworks-split-offset"]).toBe("56px");
    expect(classes(flowing, '[data-split-pane="2"]')).toEqual(
      expect.arrayContaining(["scrolls", "sticky"]),
    );
    expect(classes(flowing, '[data-split-pane="1"]')).not.toContain("scrolls");
    expect(attr(flowing, '[data-split-pane="2"]', "tabIndex")).toBe("0");
    expect(attr(flowing, '[data-split-pane="1"]', "tabIndex")).toBeUndefined();

    const filled = SplitView.view(
      {
        height: "fill",
        panes: [
          { label: "Fields", children: ["A"] },
          { label: "Inspector", sticky: true, children: ["B"] },
        ],
      },
      h,
    );
    expect(classes(filled, "[data-split-view]")).toContain("fill");
    expect(classes(filled, '[data-split-pane="1"]')).toContain("scrolls");
    // Every filled pane already scrolls within its bounded row, so sticky has nothing to do.
    expect(classes(filled, '[data-split-pane="2"]')).not.toContain("sticky");
  });

  it("sizes resizable panes with CSS variables and an auto track", () => {
    const html = SplitView.view(
      {
        panes: [
          {
            key: "list",
            label: "Mappings",
            width: "300px",
            resizable: { minWidth: "220px", maxWidth: "480px" },
            children: ["A"],
          },
          { key: "detail", label: "Detail", children: ["B"] },
        ],
      },
      h,
    );

    expect(style(html, "[data-split-view]")["--foldworks-split-columns"]).toBe(
      "auto minmax(0, 1fr)",
    );
    expect(style(html, '[data-split-pane="list"]')).toEqual({
      "--foldworks-split-pane-width": "300px",
      "--foldworks-split-pane-min": "220px",
      "--foldworks-split-pane-max": "480px",
    });
    expect(classes(html, '[data-split-pane="list"]')).toContain("resizable");
    expect(SplitView.columnTemplate([{ resizable: true, children: [] }, { children: [] }])).toBe(
      "auto minmax(0, 1fr)",
    );
  });

  it("shows one master/detail pane when stacked and merges pane styles into one class", () => {
    const html = SplitView.view(
      {
        collapsedPane: "detail",
        slotProps: { pane: { sx: custom.paneSlot, attributes: [h.DataAttribute("slot", "pane")] } },
        panes: [
          { key: "list", label: "Mappings", children: ["A"] },
          { key: "detail", label: "Detail", sx: custom.pane, children: ["B"] },
        ],
      },
      h,
    );

    expect(classes(html, '[data-split-pane="list"]')).toEqual(
      expect.arrayContaining(["pane", "paneSlot", "offstage"]),
    );
    expect(classes(html, '[data-split-pane="detail"]')).toEqual(
      expect.arrayContaining(["pane", "paneSlot", "pane"]),
    );
    expect(classes(html, '[data-split-pane="detail"]')).not.toContain("offstage");
    expect(attr(html, '[data-split-pane="detail"]', "data-slot")).toBe("pane");
  });

  it("rejects unsupported pane counts and unknown keys", () => {
    expect(() => SplitView.view({ panes: [{ children: [] }] }, h)).toThrow(/two or three/);
    expect(() =>
      SplitView.view({ panes: Array.from({ length: 4 }, () => ({ children: [] })) }, h),
    ).toThrow(/two or three/);
    expect(() =>
      SplitView.view(
        {
          panes: [
            { key: "a", children: [] },
            { key: "a", children: [] },
          ],
        },
        h,
      ),
    ).toThrow(/unique/);
    expect(() =>
      SplitView.view(
        { collapsedPane: "missing", panes: [{ key: "a", children: [] }, { children: [] }] },
        h,
      ),
    ).toThrow(/collapsedPane/);
  });
});

describe("AppHeader", () => {
  it("renders the title, breadcrumb, status, and actions slots", () => {
    const html = AppHeader.view(
      {
        title: "Compliance library",
        titleHref: "/",
        breadcrumb: { items: [{ label: "Forms", onClick: {} as never }], current: "I-9" },
        status: [Badge.view({ label: "Staging", tone: "warning", dot: true }, h)],
        actions: ["Help"],
        slotProps: { status: { attributes: [h.DataAttribute("region", "status")] } },
      },
      h,
    );

    expect(find(html, "header")).toBeDefined();
    expect(attr(html, "header a", "href")).toBe("/");
    expect(attr(html, "nav", "aria-label")).toBe("Breadcrumb");
    expect(attr(html, '[aria-current="page"]', "aria-current")).toBe("page");
    expect(Scene.textContent(find(html, '[data-region="status"]'))).toBe("Staging");
    expect(classes(html, "header")).not.toContain("withoutNavigation");
  });

  it("uses a message-driven title button and omits empty regions", () => {
    const html = AppHeader.view({ title: "Foldworks", onTitleClick: {} as never, sticky: true }, h);

    expect(attr(html, "button", "type")).toBe("button");
    expect(classes(html, "button")).toContain("titleButton");
    expect(classes(html, "header")).toEqual(
      expect.arrayContaining(["withoutNavigation", "sticky"]),
    );
    expect(findAll(html, "nav")).toHaveLength(0);
    expect(findAll(html, "header div")).toHaveLength(1);
  });
});

describe("Breadcrumb message items", () => {
  it("keep link and focus styles on the rendered button", () => {
    const html = Breadcrumb.view(
      { items: [{ label: "Forms", onClick: {} as never }], current: "I-9" },
      h,
    );
    expect(classes(html, "button")).toEqual(
      expect.arrayContaining(["breadcrumbLink", "focusable", "breadcrumbButton"]),
    );
  });
});
