import * as stylex from "@stylexjs/stylex";
import { Option } from "effect";
import { inertHtml as h, type Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { Item, Table, Tooltip } from "./index";

const styles = stylex.create({ override: { color: "purple" } });

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

const attr = (html: Html, selector: string, name: string) =>
  Option.getOrUndefined(Scene.attr(find(html, selector), name));

describe("dense display components", () => {
  it("keeps static item actions separate and gives interactive items native controls", () => {
    const staticItem = Item.view(
      {
        title: "Report",
        actions: [h.button([h.Type("button")], ["Open"])],
      },
      h,
    );
    const buttonItem = Item.view(
      {
        title: "Show report",
        description: "Updated today",
        onClick: "open" as never,
        isSelected: true,
        isPressed: false,
        trailing: ["2"],
      },
      h,
    );
    const disabledLink = Item.view(
      {
        title: "Unavailable report",
        href: "/reports/old",
        isDisabled: true,
      },
      h,
    );

    expect(find(staticItem, "div button")).toBeDefined();
    expect(attr(buttonItem, "button", "type")).toBe("button");
    expect(attr(buttonItem, "button", "aria-current")).toBe("true");
    expect(attr(buttonItem, "button", "aria-pressed")).toBe("false");
    expect(find(buttonItem, "button span span")).toBeDefined();
    expect(attr(disabledLink, "a", "aria-disabled")).toBe("true");
    expect(attr(disabledLink, "a", "href")).toBeUndefined();
  });

  it("keys configured rows and applies column, cell, row, and slot attributes", () => {
    const table = Table.view(
      {
        caption: "Invoices",
        rowHeaders: true,
        columns: [
          { label: "Invoice", width: "12rem" },
          { label: "Amount", align: "end" },
        ],
        slotProps: {
          headerCell: { attributes: [h.DataAttribute("slot", "header")] },
          cell: { attributes: [h.DataAttribute("slot", "cell")], sx: styles.override },
        },
        rows: [
          {
            key: "invoice-1",
            cells: ["INV-001", { content: "$120", align: "center", colSpan: 2 }],
            onClick: "open" as never,
            isSelected: true,
            tone: "info",
            ariaLabel: "Open invoice 1",
          },
        ],
      },
      h,
    );

    expect(find(table, "tbody tr").key).toBe("invoice-1");
    expect(attr(table, "caption", "id")).toBeUndefined();
    expect(find(table, "col").data?.style?.width).toBe("12rem");
    expect(attr(table, "thead th", "scope")).toBe("col");
    expect(attr(table, "thead th", "data-slot")).toBe("header");
    expect(attr(table, "tbody tr", "data-tone")).toBe("info");
    expect(attr(table, "tbody tr", "data-selected")).toBe("true");
    expect(attr(table, "tbody th", "scope")).toBe("row");
    expect(attr(table, "tbody th", "data-slot")).toBe("cell");
    expect(attr(table, "tbody th", "class")).toContain("override");
    expect(attr(table, "tbody button", "aria-label")).toBe("Open invoice 1");
    expect(attr(table, "tbody td", "colSpan")).toBe("2");
  });

  it("renders stateless tooltip descriptions with a custom trigger and slot props", () => {
    const tooltip = Tooltip.view(
      {
        mode: "stateless",
        id: "save-help",
        trigger: ["Save"],
        label: "Saves this draft",
        placement: "bottom",
        slotProps: {
          trigger: { attributes: [h.DataAttribute("slot", "trigger")], sx: styles.override },
          panel: { attributes: [h.DataAttribute("slot", "panel")] },
        },
        renderTrigger: (attributes, children, builder) =>
          builder.button([...attributes, builder.Type("button")], children),
      },
      h,
    );
    const defaultTrigger = Tooltip.view(
      {
        mode: "stateless",
        trigger: ["Details"],
        label: "More information",
      },
      h,
    );

    expect(attr(tooltip, "button", "aria-describedby")).toBe("save-help");
    expect(attr(tooltip, "button", "data-slot")).toBe("trigger");
    expect(attr(tooltip, "button", "class")).toContain("override");
    expect(attr(tooltip, '[role="tooltip"]', "id")).toBe("save-help");
    expect(attr(tooltip, '[role="tooltip"]', "data-slot")).toBe("panel");
    expect(attr(defaultTrigger, "[aria-description]", "aria-description")).toBe("More information");
    expect(attr(defaultTrigger, "[aria-description]", "tabIndex")).toBe("0");
  });
});
