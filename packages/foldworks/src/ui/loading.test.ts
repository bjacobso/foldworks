import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { Loader, Skeleton, Spinner } from "./index";

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

const attr = (html: Html, selector: string, name: string) =>
  Option.getOrUndefined(Scene.attr(find(html, selector), name));
const findAll = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  return Scene.findAll(html, selector);
};

describe("loading primitives", () => {
  it("keeps skeletons decorative by default and exposes labeled standalone statuses", () => {
    const decorative = Skeleton.view({}, h);
    const labeled = Skeleton.view({ label: "Loading profile" }, h);

    expect(attr(decorative, "div", "aria-hidden")).toBe("true");
    expect(attr(decorative, "div", "role")).toBeUndefined();
    expect(attr(labeled, '[role="status"]', "aria-label")).toBe("Loading profile");
    expect(Scene.textContent(find(labeled, ".visuallyHidden"))).toBe("Loading profile");
  });

  it("supports compact dimensions, shapes, static indicators, and root customization", () => {
    const html = Skeleton.view(
      {
        shape: "text",
        width: "60%",
        height: "10px",
        isAnimated: false,
        attributes: [h.Id("placeholder")],
        slotProps: { root: { attributes: [h.DataAttribute("slot", "root")] } },
      },
      h,
    );

    expect(find(html, "#placeholder").data?.style).toMatchObject({ height: "10px", width: "60%" });
    expect(attr(html, "#placeholder", "class")).toContain("skeletonText");
    expect(attr(html, "#placeholder", "class")).toContain("loadingStatic");
    expect(attr(html, "#placeholder", "data-slot")).toBe("root");
    expect(attr(Skeleton.view({ shape: "circle" }, h), "div", "class")).toContain("skeletonCircle");
  });

  it("labels standalone spinners and removes status semantics for decorative ones", () => {
    const standalone = Spinner.view({}, h);
    const decorative = Spinner.view({ decorative: true, size: "lg", isAnimated: false }, h);

    expect(attr(standalone, "span", "role")).toBe("status");
    expect(Scene.textContent(find(standalone, "span"))).toBe("Loading");
    expect(attr(decorative, "span", "aria-hidden")).toBe("true");
    expect(attr(decorative, "span", "role")).toBeUndefined();
    expect(attr(decorative, "span", "aria-label")).toBeUndefined();
    expect(attr(decorative, "span", "class")).toContain("spinnerLg");
    expect(attr(decorative, "span", "class")).toContain("loadingStatic");
  });

  it("composes one polite status with visible text and a decorative spinner", () => {
    const html = Loader.view({ label: "Saving", size: "md" }, h);

    expect(findAll(html, '[role="status"]')).toHaveLength(1);
    expect(attr(html, '[role="status"]', "aria-label")).toBe("Saving");
    expect(attr(html, '[role="status"]', "aria-live")).toBe("polite");
    expect(attr(html, '[role="status"]', "aria-atomic")).toBe("true");
    expect(attr(html, ".spinner", "aria-hidden")).toBe("true");
    expect(attr(html, ".spinner", "class")).toContain("spinnerMd");
    expect(Scene.textContent(find(html, ".loaderLabel"))).toBe("Saving");
    expect(attr(html, ".loaderLabel", "class")).not.toContain("visuallyHidden");
  });

  it("groups decorative placeholders under one hidden label and supports content slots", () => {
    const html = Loader.view(
      {
        label: "Loading account",
        hideLabel: true,
        children: [Skeleton.view({ shape: "circle" }, h), Skeleton.view({ shape: "text" }, h)],
        slotProps: { content: { attributes: [h.Id("placeholders")] } },
      },
      h,
    );

    expect(findAll(html, '[role="status"]')).toHaveLength(1);
    expect(findAll(html, ".spinner")).toHaveLength(0);
    expect(attr(html, '[role="status"]', "class")).toContain("loaderBlock");
    expect(attr(html, "#placeholders", "aria-hidden")).toBe("true");
    expect(findAll(html, ".skeleton")).toHaveLength(2);
    expect(attr(html, ".loaderLabel", "class")).toContain("visuallyHidden");
    expect(Scene.textContent(find(html, ".loaderLabel"))).toBe("Loading account");
  });
});
