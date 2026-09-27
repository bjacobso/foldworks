import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Breadcrumb, Sidebar, TabBar, collapseBreadcrumbItems } from "./navigation";

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

const attr = (html: Html, selector: string, name: string) =>
  Option.getOrUndefined(Scene.attr(find(html, selector), name));

const text = (html: Html, selector: string) => Scene.textContent(find(html, selector));

type Screen = "overview" | "form" | "scenarios" | "translations";
type Selected = Readonly<{ _tag: "Selected"; value: Screen }>;
const Selected = (value: Screen): Selected => ({ _tag: "Selected", value });

const screens = [
  { value: "overview", label: "Overview" },
  { value: "form", label: "Form", href: "#form" },
  {
    value: "scenarios",
    label: "Scenarios",
    badge: [h.span([h.DataAttribute("badge", "failures")], ["2 failing"])],
  },
  { value: "translations", label: "Translations", hint: "Planned", isDisabled: true },
] as const;

describe("Breadcrumb", () => {
  it("renders message-driven items as buttons and href items as links", () => {
    const html = Breadcrumb.view(
      {
        items: [
          { label: "Home", href: "/" },
          { label: "Schemas", onClick: {} as never },
        ],
        current: "Invoice",
      },
      h,
    );

    expect(Option.getOrUndefined(Scene.attr(find(html, "a"), "href"))).toBe("/");
    expect(find(html, "button")).toBeDefined();
    expect(
      Option.getOrUndefined(Scene.attr(find(html, '[aria-current="page"]'), "aria-current")),
    ).toBe("page");
  });

  it("collapses the middle and exposes an actionable overflow control", () => {
    const items = ["Home", "Workspace", "Project", "Folder", "Schema"].map((label) => ({
      label,
      href: "#",
    }));
    const entries = collapseBreadcrumbItems(items, "Invoice", {
      maxItems: 4,
      itemsBeforeCollapse: 1,
      itemsAfterCollapse: 2,
    });
    const html = Breadcrumb.view(
      {
        items,
        current: "Invoice",
        maxItems: 4,
        itemsBeforeCollapse: 1,
        itemsAfterCollapse: 2,
        onExpand: {} as never,
      },
      h,
    );

    expect(entries.map((entry) => entry.kind)).toEqual(["item", "overflow", "item", "current"]);
    expect(Option.getOrUndefined(Scene.attr(find(html, "button"), "aria-label"))).toBe(
      "Show 3 hidden breadcrumb items",
    );
  });

  it("rejects collapse settings that cannot fit the overflow item", () => {
    expect(() =>
      collapseBreadcrumbItems([{ label: "A" }, { label: "B" }, { label: "C" }], "D", {
        maxItems: 2,
      }),
    ).toThrow(/must fit/);
  });
});

describe("TabBar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a navigation landmark with current, hinted, disabled, and trailing content", () => {
    const html = TabBar.view(
      {
        id: "bundle",
        ariaLabel: "Bundle views",
        value: "overview",
        tabs: screens,
        onChange: (value) => Selected(value) as never,
        trailing: [h.span([h.DataAttribute("release", "ready")], ["Ready"])],
      },
      h,
    );

    expect(attr(html, "nav", "aria-label")).toBe("Bundle views");
    expect(attr(html, "nav", "data-tab-bar")).toBe("navigation");
    expect(attr(html, '[id="bundle-tab-overview"]', "aria-current")).toBe("page");
    expect(attr(html, '[id="bundle-tab-form"]', "aria-current")).toBeUndefined();
    expect(attr(html, '[id="bundle-tab-form"]', "href")).toBe("#form");
    expect(find(html, '[id="bundle-tab-scenarios"] [data-badge="failures"]')).toBeDefined();
    expect(attr(html, '[id="bundle-tab-translations"]', "aria-disabled")).toBe("true");
    expect(attr(html, '[id="bundle-tab-translations"]', "aria-describedby")).toBe(
      "bundle-tab-translations-hint",
    );
    expect(text(html, '[id="bundle-tab-translations-hint"]')).toBe("Planned");
    expect(find(html, '[data-release="ready"]')).toBeDefined();
    if (html === null) throw new Error("Expected rendered tab bar");
    expect(Option.isNone(Scene.find(html, '[role="tab"]'))).toBe(true);
  });

  it("dispatches navigation messages but never for disabled tabs", () => {
    Scene.scene(
      {
        update: (_model: Screen, message: Selected) => ({ model: message.value }),
        view: (model: Screen, builder) =>
          TabBar.view<Selected, Screen>(
            {
              id: "bundle",
              ariaLabel: "Bundle views",
              value: model,
              tabs: screens,
              onChange: Selected,
            },
            builder,
          ),
      },
      Scene.given<Screen>("overview"),
      Scene.click(Scene.selector('[id="bundle-tab-scenarios"]')),
      Scene.expect(Scene.selector('[id="bundle-tab-scenarios"]')).toHaveAttr(
        "aria-current",
        "page",
      ),
    );

    const html = TabBar.view(
      {
        id: "bundle",
        ariaLabel: "Bundle views",
        value: "overview",
        tabs: screens,
        onChange: (value) => Selected(value) as never,
      },
      h,
    );
    const disabled = find(html, '[id="bundle-tab-translations"]');
    expect(disabled.data?.on?.click).toBeUndefined();
    expect(disabled.sel).toBe("button");
  });

  it("uses tablist semantics with one tab stop and arrow-key selection that skips disabled tabs", () => {
    vi.stubGlobal("document", { querySelector: () => null });
    vi.stubGlobal("HTMLElement", class {});
    const tab = (value: Screen) => Scene.selector(`[id="${TabBar.tabId("bundle", value)}"]`);
    Scene.scene(
      {
        update: (_model: Screen, message: Selected) => ({ model: message.value }),
        view: (model: Screen, builder) =>
          TabBar.view<Selected, Screen>(
            {
              id: "bundle",
              ariaLabel: "Bundle views",
              semantics: "tablist",
              panelId: "bundle-panel",
              value: model,
              tabs: screens,
              onChange: Selected,
            },
            builder,
          ),
      },
      Scene.given<Screen>("scenarios"),
      Scene.expect(Scene.role("tablist")).toHaveAttr("aria-label", "Bundle views"),
      Scene.expect(tab("scenarios")).toHaveAttr("aria-selected", "true"),
      Scene.expect(tab("scenarios")).toHaveAttr("tabIndex", "0"),
      Scene.expect(tab("overview")).toHaveAttr("tabIndex", "-1"),
      Scene.expect(tab("overview")).toHaveAttr("aria-controls", "bundle-panel"),
      Scene.keydown(tab("scenarios"), "ArrowRight"),
      Scene.expect(tab("overview")).toHaveAttr("aria-selected", "true"),
      Scene.keydown(tab("overview"), "ArrowLeft"),
      Scene.expect(tab("scenarios")).toHaveAttr("aria-selected", "true"),
      Scene.keydown(tab("scenarios"), "Home"),
      Scene.expect(tab("overview")).toHaveAttr("aria-selected", "true"),
      Scene.keydown(tab("overview"), "End"),
      Scene.expect(tab("scenarios")).toHaveAttr("aria-selected", "true"),
    );
  });

  it("falls back to the first enabled tab as the tab stop when nothing is selected", () => {
    const html = TabBar.view(
      {
        id: "bundle",
        ariaLabel: "Bundle views",
        semantics: "tablist",
        tabs: [
          { value: "translations", label: "Translations", isDisabled: true },
          { value: "form", label: "Form" },
        ],
        onChange: (value) => Selected(value) as never,
      },
      h,
    );

    expect(attr(html, '[id="bundle-tab-translations"]', "tabIndex")).toBe("-1");
    expect(attr(html, '[id="bundle-tab-form"]', "tabIndex")).toBe("0");
    expect(attr(html, '[id="bundle-tab-form"]', "aria-selected")).toBe("false");
  });
});

describe("Sidebar", () => {
  it("renders href items as links, message items as buttons, and per-item counts", () => {
    const html = Sidebar.view(
      {
        groups: [
          {
            label: "Pages",
            items: [
              { label: "Home", href: "/" },
              { label: "Page 1", onClick: Selected("form") as never, isCurrent: true, count: 12 },
              {
                label: "Page 2",
                onClick: Selected("scenarios") as never,
                count: 3,
                countLabel: "3 hidden fields",
              },
              { label: "Archive" },
            ],
          },
        ],
      },
      h,
    );

    expect(attr(html, "a", "href")).toBe("/");
    const current = find(html, '[aria-current="page"]');
    expect(current.sel).toBe("button");
    expect(Option.getOrUndefined(Scene.attr(current, "type"))).toBe("button");
    expect(text(html, '[aria-current="page"] [data-count]')).toBe("12");
    expect(text(html, '[data-count="3"]')).toBe("33 hidden fields");
    expect(attr(html, '[data-count="3"] [aria-hidden]', "aria-hidden")).toBe("true");
  });
});
