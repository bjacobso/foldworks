import { describe, expect, it } from "vitest";

import {
  dropLocationFromId,
  dropLocationId,
  moveField,
  movePage,
  moveSection,
  type FormDocument,
  type FormField,
} from "./document";

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
  });
});
