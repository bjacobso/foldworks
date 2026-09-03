import { describe, expect, it } from "vitest";

import {
  deleteSection,
  dragItemFromId,
  dragItemId,
  dropLocationFromId,
  dropLocationId,
  insertField,
  insertPage,
  insertSection,
  moveField,
  moveItem,
  movePage,
  moveSection,
  updateField,
  updatePage,
  type FormDocument,
  type FormField,
} from "./document";
import { OutMessage } from "./interaction";
import { paletteItemId, paletteTypeFromId } from "./registry";
import { applyReorder } from "./reorder";

type Field = FormField & Readonly<{ label: string }>;

const fixture = (): FormDocument<Field> => ({
  id: "form:1",
  title: "Test",
  description: "",
  actors: [
    { id: "employee", type: "employee", title: "Employee" },
    { id: "employer", type: "employer", title: "Employer" },
  ],
  sections: [
    {
      id: "employee-one",
      actorId: "employee",
      title: "Employee one",
      description: "",
      pages: [
        { id: "page-a", title: "A", description: "", fields: [
          { id: "field-a", type: "text", label: "A" },
          { id: "field-b", type: "text", label: "B" },
        ] },
      ],
    },
    {
      id: "employer-one",
      actorId: "employer",
      title: "Employer",
      description: "",
      pages: [{ id: "page-b", title: "B", description: "", fields: [] }],
    },
    {
      id: "employee-two",
      actorId: "employee",
      title: "Employee two",
      description: "",
      pages: [],
    },
  ],
});

describe("form document operations", () => {
  it("reorders root sections while preserving repeated actor assignments", () => {
    const moved = moveSection(fixture(), "employee-two", { kind: "Section", index: 0 });
    expect(moved?.sections.map((section) => section.id)).toEqual([
      "employee-two", "employee-one", "employer-one",
    ]);
    expect(moved?.sections.map((section) => section.actorId)).toEqual([
      "employee", "employee", "employer",
    ]);
  });

  it("moves pages between actor-owned sections", () => {
    const moved = movePage(fixture(), "page-a", {
      kind: "Page",
      sectionId: "employer-one",
      index: 1,
    });
    expect(moved?.sections[0]?.pages).toHaveLength(0);
    expect(moved?.sections[1]?.pages.map((page) => page.id)).toEqual(["page-b", "page-a"]);
  });

  it("moves fields between pages", () => {
    const moved = moveField(fixture(), "field-a", {
      kind: "Field",
      pageId: "page-b",
      index: 0,
    });
    expect(moved?.sections[0]?.pages[0]?.fields.map((field) => field.id)).toEqual(["field-b"]);
    expect(moved?.sections[1]?.pages[0]?.fields.map((field) => field.id)).toEqual(["field-a"]);
  });

  it("round-trips typed drop locations", () => {
    const location = { kind: "Page", sectionId: "section:one", index: 3 } as const;
    expect(dropLocationFromId(dropLocationId("form:1", location))).toEqual(location);
    expect(dropLocationFromId(dropLocationId("form:1", location, "outline")))
      .toEqual(location);
  });

  it("rejects insertion into unknown parents and out-of-range positions", () => {
    const document = fixture();
    expect(insertSection(document, { kind: "Section", index: 0 }, {
      id: "unknown-actor-section",
      actorId: "missing",
      title: "Missing",
      description: "",
      pages: [],
    })).toBeUndefined();
    expect(insertPage(document, {
      kind: "Page",
      sectionId: "employee-one",
      index: 2,
    }, { id: "new-page", title: "New", description: "", fields: [] }))
      .toBeUndefined();
    expect(insertField(document, {
      kind: "Field",
      pageId: "page-a",
      index: 3,
    }, { id: "new-field", type: "text", label: "New" })).toBeUndefined();
  });

  it("rejects moveItem when the declared kind does not match the item or target", () => {
    const document = fixture();
    expect(moveItem(document, "Page", "field-a", {
      kind: "Page",
      sectionId: "employer-one",
      index: 0,
    })).toBeUndefined();
    expect(moveItem(document, "Field", "field-a", {
      kind: "Page",
      sectionId: "employer-one",
      index: 0,
    })).toBeUndefined();
  });

  it("adjusts a same-page forward field move after removing the source", () => {
    const moved = moveField(fixture(), "field-a", {
      kind: "Field",
      pageId: "page-a",
      index: 2,
    });

    // Target index 2 is measured before removal, so removing index 0 makes it 1.
    expect(moved?.sections[0]?.pages[0]?.fields.map((field) => field.id))
      .toEqual(["field-b", "field-a"]);
  });

  it("handles malformed and colon-containing encoded ids", () => {
    expect(dropLocationFromId("not-a-form-target")).toBeUndefined();
    expect(dropLocationFromId("form-target:page:%E0%A4%A:1")).toBeUndefined();
    expect(dropLocationFromId("form-target:field:page:1:extra:segment"))
      .toBeUndefined();
    expect(dragItemFromId("form-item:field:%E0%A4%A")).toBeUndefined();
    expect(dragItemFromId("form-item:field:id:with:raw:colons")).toBeUndefined();

    const location = { kind: "Field", pageId: "page:with:colons", index: 1 } as const;
    expect(dropLocationFromId(dropLocationId("form:with:colons", location)))
      .toEqual(location);
    expect(dragItemFromId(dragItemId("Field", "field:with:colons")))
      .toEqual({ kind: "Field", id: "field:with:colons" });
  });

  it("allows deleting the last section", () => {
    const document = { ...fixture(), sections: [fixture().sections[0]!] };
    expect(deleteSection(document, "employee-one")?.sections).toEqual([]);
  });

  it("preserves untouched sibling section identity for targeted page and field updates", () => {
    const document = fixture();
    const sibling = document.sections[1];
    const pageUpdated = updatePage(document, "page-a", (page) => ({
      ...page,
      title: "Updated page",
    }));
    const fieldUpdated = updateField(document, "field-a", (field) => ({
      ...field,
      label: "Updated field",
    }));

    expect(pageUpdated.sections[1]).toBe(sibling);
    expect(fieldUpdated.sections[1]).toBe(sibling);
  });

  it("round-trips palette ids and applies palette and document reorders", () => {
    expect(paletteTypeFromId(paletteItemId("custom:type"))).toBe("custom:type");
    const document = fixture();
    const inserted = applyReorder({
      document,
      reordered: OutMessage.Reordered({
        itemId: paletteItemId("text"),
        fromContainerId: "palette",
        fromIndex: 0,
        toContainerId: dropLocationId(document.id, {
          kind: "Field",
          pageId: "page-b",
          index: 0,
        }),
        toIndex: 0,
      }),
      operations: { insertField, moveItem },
      createFromPalette: (type) => type === "text"
        ? { id: "new-field", type, label: "New" }
        : undefined,
    });
    expect(inserted?._tag).toBe("Inserted");
    expect(inserted?.document.sections[1]?.pages[0]?.fields[0]?.id)
      .toBe("new-field");
  });
});
