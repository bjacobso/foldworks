import { Option } from "effect";
import { inertHtml as h } from "foldkit/html";
import { Scene } from "foldkit/test";
import { CircleHelp } from "@lucide/icons";
import { describe, expect, it } from "vitest";

import * as Icon from "./icon";

const rendered = (config: Icon.ViewConfig<never>) => {
  const html = Icon.view(config, h);
  if (html === null) throw new Error("Expected Icon.view to render an SVG");
  return html;
};

const attribute = (html: ReturnType<typeof rendered>, name: string) =>
  Option.getOrUndefined(Scene.attr(html, name));

describe("Icon.view", () => {
  it("renders Lucide data as a sized Foldkit SVG", () => {
    const html = rendered({ icon: CircleHelp, size: 20, strokeWidth: 1.5 });

    expect(attribute(html, "data-lucide-icon")).toBe(CircleHelp.name);
    expect(attribute(html, "width")).toBe("20");
    expect(attribute(html, "height")).toBe("20");
    expect(attribute(html, "stroke-width")).toBe("1.5");
    expect(Scene.findAll(html, "circle")).toHaveLength(1);
    expect(Scene.findAll(html, "path")).toHaveLength(2);
  });

  it("is decorative by default and supports a standalone accessible label", () => {
    const decorative = rendered({ icon: CircleHelp });
    const labelled = rendered({ icon: CircleHelp, label: "Help" });

    expect(attribute(decorative, "aria-hidden")).toBe("true");
    expect(attribute(labelled, "role")).toBe("img");
    expect(attribute(labelled, "aria-label")).toBe("Help");
  });
});
