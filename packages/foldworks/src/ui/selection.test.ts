import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import * as Badge from "./badge";
import { Toggle, ToggleGroup } from "./forms";
import * as SegmentedControl from "./segmented-control";

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

const attr = (html: Html, selector: string, name: string) =>
  Option.getOrUndefined(Scene.attr(find(html, selector), name));

const text = (html: Html, selector: string) => Scene.textContent(find(html, selector));

type Page = "identity" | "employment" | "review";
const pages = [
  { value: "identity", label: "Identity", count: 2, countLabel: "2 hidden fields" },
  {
    value: "employment",
    label: "Employment",
    needsAttention: true,
    attentionLabel: "Linked field is on this page",
  },
  { value: "review", label: "Review", isDisabled: true },
] as const;

describe("Toggle counts", () => {
  it("renders a filter-chip count inside the pressed button", () => {
    const html = Toggle.view(
      {
        label: "Failing journeys only",
        isPressed: false,
        count: 0,
        countLabel: "0 journeys",
        onToggle: () => undefined as never,
        slotProps: { count: { attributes: [h.DataAttribute("slot", "count")] } },
      },
      h,
    );

    expect(attr(html, "button", "aria-pressed")).toBe("false");
    expect(text(html, "button")).toBe("Failing journeys only00 journeys");
    expect(attr(html, '[data-count="0"]', "data-slot")).toBe("count");
    expect(attr(html, '[data-count="0"] [aria-hidden]', "aria-hidden")).toBe("true");
  });

  it("keeps the label-only toggle unchanged", () => {
    const html = Toggle.view(
      { label: "Bold", isPressed: true, onToggle: () => undefined as never },
      h,
    );

    expect(text(html, "button")).toBe("Bold");
    if (html === null) throw new Error("Expected rendered toggle");
    expect(Option.isNone(Scene.find(html, "[data-count]"))).toBe(true);
  });
});

describe("SegmentedControl adornments", () => {
  it("renders per-option counts, badges, attention, and disabled options", () => {
    const html = SegmentedControl.view<never, Page>(
      {
        value: "identity",
        ariaLabel: "Form pages",
        onChange: () => undefined as never,
        options: [
          ...pages,
          {
            value: "review",
            label: "Summary",
            badge: [Badge.view({ label: "New", tone: "info" }, h)],
          },
        ],
      },
      h,
    );

    expect(text(html, '[data-count="2"]')).toBe("22 hidden fields");
    expect(attr(html, "[data-attention]", "aria-pressed")).toBe("false");
    expect(text(html, "[data-attention]")).toBe("EmploymentLinked field is on this page");
    expect(attr(html, "button[disabled]", "disabled")).toBe("true");
    expect(find(html, "button[disabled]").data?.on?.click).toBeUndefined();
    expect(text(html, '[role="group"]')).toContain("SummaryNew");
  });
});

describe("ToggleGroup adornments", () => {
  it("renders per-option counts and attention without changing selection behavior", () => {
    type Changed = Readonly<{ _tag: "Changed"; values: ReadonlyArray<Page> }>;
    Scene.scene(
      {
        update: (_model: ReadonlyArray<Page>, message: Changed) => ({ model: message.values }),
        view: (model: ReadonlyArray<Page>, builder) =>
          ToggleGroup.view<Changed, Page>(
            {
              values: model,
              ariaLabel: "Form pages",
              multiple: true,
              options: pages,
              onChange: (values): Changed => ({ _tag: "Changed", values }),
            },
            builder,
          ),
      },
      Scene.given<ReadonlyArray<Page>>(["identity"]),
      Scene.expect(Scene.selector("[data-attention]")).toHaveAttr("aria-pressed", "false"),
      Scene.click(Scene.selector("[data-attention]")),
      Scene.expect(Scene.selector("[data-attention]")).toHaveAttr("aria-pressed", "true"),
      Scene.expect(Scene.selector("button[disabled]")).toExist(),
    );
  });
});
