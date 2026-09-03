import { describe, expect, it } from "vitest";

import { exampleForms } from "./form-builder/model";
import {
  nextFormId,
  nextWorkflowId,
  parseFormExport,
  parseWorkflowExport,
  serializeFormExport,
  serializeWorkflowExport,
} from "./document-storage";
import { initialDocument } from "./workflow/model";

describe("document JSON", () => {
  it("round-trips validated workflow exports", () => {
    expect(parseWorkflowExport(serializeWorkflowExport(initialDocument))).toEqual(initialDocument);
    expect(parseWorkflowExport('{"version":1,"kind":"form"}')).toBeUndefined();
  });

  it("round-trips validated form exports", () => {
    expect(parseFormExport(serializeFormExport(exampleForms.Handoff))).toEqual(exampleForms.Handoff);
    expect(parseFormExport("not json")).toBeUndefined();
  });

  it("continues generated IDs after imported documents", () => {
    expect(nextWorkflowId({
      root: {
        ...initialDocument.root,
        elements: [{
          id: "node-19",
          type: "action",
          data: { title: "Imported", description: "", size: "default" },
          branches: [],
        }],
      },
    })).toBe(20);
    expect(nextFormId({
      ...exampleForms.Simple,
      sections: [{
        id: "form-section-4",
        actorId: "employee",
        title: "Imported",
        description: "",
        pages: [],
      }],
    })).toBe(5);
  });
});
