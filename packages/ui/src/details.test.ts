import { Eye } from "@lucide/icons";
import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { Badge, Card, CodeBlock, DescriptionList, Legend, Progress, Stat, Tag } from "./index";

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

const text = (html: Html, selector: string) => Scene.textContent(find(html, selector));

const classes = (html: Html, selector: string) => (attr(html, selector, "class") ?? "").split(" ");

describe("Badge", () => {
  it("keeps the subtle neutral default", () => {
    expect(classes(Badge.view({ label: "Draft" }, h), "span")).toEqual(["base", "neutral"]);
  });

  it("supports outline, monospace, and the accent and muted tones", () => {
    const outline = Badge.view({ label: "Hidden", tone: "muted", variant: "outline" }, h);
    const code = Badge.view({ label: "I-9", tone: "accent", mono: true }, h);

    expect(classes(outline, "span")).toEqual(["base", "muted", "outline", "outlineMuted"]);
    expect(classes(code, "span")).toEqual(["base", "accent", "mono"]);
  });
});

describe("Tag", () => {
  it("shares Badge tones and a monospace option", () => {
    const html = Tag.view({ label: "text", tone: "warning", mono: true }, h);

    expect(classes(html, "span")).toEqual(expect.arrayContaining(["tag", "tagWarning", "tagMono"]));
    expect(classes(Tag.view({ label: "Plain" }, h), "span")).toEqual(["tag"]);
  });
});

describe("Progress", () => {
  it("renders the original single-element meter without a caption", () => {
    const html = Progress.view({ value: 42, ariaLabel: "Upload" }, h);

    expect(attr(html, "div", "role")).toBe("progressbar");
    expect(classes(html, '[role="progressbar"]')).toEqual(["progress"]);
    expect(findAll(html, "div")).toHaveLength(2);
  });

  it("adds size, tone, and an announced caption", () => {
    const html = Progress.view(
      { value: 2, max: 9, ariaLabel: "Coverage", size: "sm", tone: "warning", caption: "2 / 9" },
      h,
    );

    expect(attr(html, '[role="progressbar"]', "aria-valuetext")).toBe("2 / 9");
    expect(attr(html, '[role="progressbar"]', "aria-valuenow")).toBe("2");
    expect(classes(html, ".progressTrack")).toEqual(["progress", "progressSm", "progressTrack"]);
    expect(classes(html, ".progressIndicator")).toContain("progressWarning");
    expect(text(html, "span")).toBe("2 / 9");
    expect(attr(html, "span", "aria-hidden")).toBe("true");
  });
});

describe("Card", () => {
  it("removes content padding when flush", () => {
    const html = Card.view(
      { title: "Journeys", flush: true, children: ["Table"], footer: ["Footer"] },
      h,
    );

    expect(classes(html, "header")).toContain("cardHeaderFlush");
    expect(classes(html, "footer")).toContain("cardFooterFlush");
    expect(classes(Card.view({ children: ["Plain"] }, h), "div")).toEqual(["cardContent"]);
  });
});

describe("DescriptionList", () => {
  const items = [
    { term: "Form", value: "I-9" },
    { term: "Template", value: "{{ applicant.name }}", format: "code" as const },
    { term: "Tags", value: [Badge.view({ label: "Hidden" }, h)], format: "chips" as const },
    { term: "Notes" },
  ];

  it("renders term and value rows in a horizontal layout by default", () => {
    const html = DescriptionList.view({ items }, h);

    expect(classes(html, "dl")).toContain("horizontal");
    expect(findAll(html, ".rowHorizontal")).toHaveLength(4);
    expect(findAll(html, "dt").map(Scene.textContent)).toEqual([
      "Form",
      "Template",
      "Tags",
      "Notes",
    ]);
    expect(text(html, "dd code")).toBe("{{ applicant.name }}");
    expect(classes(html, ".chips")).toContain("value");
    expect(findAll(html, "dd").map(Scene.textContent).at(-1)).toBe("—");
  });

  it("supports stacked rows, dividers, and a fixed term column", () => {
    const html = DescriptionList.view(
      { items: items.slice(0, 2), layout: "stacked", dividers: true, emptyValue: "Not set" },
      h,
    );
    const rows = findAll(html, ".rowStacked").map((row) =>
      Option.getOrUndefined(Scene.attr(row, "class")),
    );

    expect(classes(html, "dl")).toContain("stacked");
    expect(rows).toEqual(["rowStacked rowDivided", "rowStacked rowDivided rowDivider"]);
  });
});

describe("Stat", () => {
  it("pairs its label and value in a description list", () => {
    const html = Stat.view(
      { label: "Passing journeys", value: "4 / 4", description: "Expectations hold" },
      h,
    );

    expect(text(html, "dt")).toBe("Passing journeys");
    expect(text(html, ".value")).toBe("4 / 4");
    expect(findAll(html, "dd").map(Scene.textContent)).toEqual(["4 / 4", "Expectations hold"]);
    expect(classes(html, "dl")).toEqual(["root", "tile"]);
  });

  it("tints tone tiles and announces delta direction", () => {
    const html = Stat.view(
      {
        label: "Gaps",
        value: "3",
        tone: "danger",
        delta: { value: "2", trend: "down", tone: "success", label: "since last release" },
      },
      h,
    );

    expect(classes(html, "dl")).toContain("tileDanger");
    expect(classes(html, ".value")).toContain("danger");
    expect(classes(html, ".delta")).toContain("success");
    expect(text(html, ".delta")).toBe("Down 2 since last release");
    expect(classes(Stat.view({ label: "A", value: "1", variant: "plain" }, h), "dl")).toEqual([
      "root",
    ]);
  });
});

describe("Legend", () => {
  it("renders a labelled list of decorative markers", () => {
    const html = Legend.view(
      {
        ariaLabel: "Widget states",
        orientation: "vertical",
        items: [
          {
            label: "Filled",
            value: "12",
            marker: { kind: "swatch", tone: "success", fill: "soft" },
          },
          {
            label: "Omitted",
            marker: { kind: "swatch", color: "var(--chart-3)", shape: "line", fill: "dashed" },
          },
          { label: "Shown", marker: { kind: "icon", icon: Eye } },
          { label: "Required", marker: { kind: "symbol", symbol: "*", tone: "danger" } },
        ],
      },
      h,
    );
    const markers = findAll(html, ".marker");

    expect(attr(html, "ul", "role")).toBe("list");
    expect(attr(html, "ul", "aria-label")).toBe("Widget states");
    expect(classes(html, "ul")).toContain("vertical");
    expect(findAll(html, "li")).toHaveLength(4);
    expect(markers).toHaveLength(4);
    expect(classes(html, ".soft")).toEqual(["swatch", "square", "soft"]);
    expect(classes(html, ".lineDashed")).toEqual(["swatch", "line", "lineDashed"]);
    expect(findAll(html, "svg")).toHaveLength(1);
    expect(text(html, ".symbol")).toBe("*");
    expect(text(html, "li")).toBe("Filled12");
  });
});

describe("CodeBlock", () => {
  it("renders plain read-only code without a trailing empty line", () => {
    const html = CodeBlock.view({ code: "{{ name }}\n" }, h);

    expect(text(html, "pre code")).toBe("{{ name }}");
    expect(findAll(html, "button")).toHaveLength(0);
    expect(findAll(html, '[role="region"]')).toHaveLength(0);
  });

  it("applies highlighter tokens and line numbers", () => {
    const html = CodeBlock.view(
      {
        code: "let a = 1\n// done",
        language: "javascript",
        lineNumbers: true,
        highlight: (code) =>
          code
            .split("\n")
            .map((line) =>
              line.startsWith("//")
                ? [{ text: line, kind: "comment" as const }]
                : [{ text: "let", kind: "keyword" as const }, { text: line.slice(3) }],
            ),
      },
      h,
    );

    expect(findAll(html, ".line")).toHaveLength(2);
    expect(text(html, ".keyword")).toBe("let");
    expect(text(html, ".comment")).toBe("// done");
    expect(findAll(html, ".lineNumber").map(Scene.textContent)).toEqual(["1", "2"]);
    expect(attr(html, ".lineNumber", "aria-hidden")).toBe("true");
    expect(attr(html, "div", "data-language")).toBe("javascript");
  });

  it("caps its height as a focusable region and exposes copy state", () => {
    const html = CodeBlock.view(
      {
        code: "{}",
        title: "payload.json",
        maxHeight: "120px",
        copy: { onCopy: {} as never, isCopied: true },
      },
      h,
    );

    expect(attr(html, '[role="region"]', "aria-label")).toBe("payload.json");
    expect(attr(html, '[role="region"]', "tabIndex")).toBe("0");
    expect(text(html, ".title")).toBe("payload.json");
    expect(text(html, "button")).toBe("Copied");
    expect(text(html, '[role="status"]')).toBe("Copied");
  });

  it("floats the copy button when untitled and labels it by language", () => {
    const untitled = CodeBlock.view({ code: "x", copy: { onCopy: {} as never } }, h);
    const titled = CodeBlock.view(
      { code: "x", language: "liquid", copy: { onCopy: {} as never } },
      h,
    );

    expect(classes(untitled, "button")).toContain("copyFloating");
    expect(attr(untitled, "button", "aria-label")).toBe("Copy code");
    expect(text(titled, ".title")).toBe("liquid");
    expect(classes(titled, "button")).not.toContain("copyFloating");
  });
});
