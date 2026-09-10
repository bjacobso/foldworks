import { Option } from "effect";
import { fromString } from "foldkit/url";
import { describe, expect, it } from "vitest";

import {
  agentRouter,
  dataTablePath,
  dataGridRouter,
  codeEditorRouter,
  workbenchRouter,
  demoFromRoute,
  formBuilderPath,
  formStateFromRoute,
  homeRouter,
  queryBuilderRouter,
  pdfAnnotatorRouter,
  uiKitRouter,
  urlToAppRoute,
  workflowOrientationFromRoute,
  workflowPath,
} from "./route";

const parseUrl = (url: string) =>
  urlToAppRoute(Option.getOrThrow(fromString(url)));

describe("demo routes", () => {
  it("builds stable paths for each demo", () => {
    expect(homeRouter()).toBe("/");
    expect(agentRouter()).toBe("/agent");
    expect(demoFromRoute(parseUrl("https://demo.test/agent"))).toBe("Agent");
    expect(workbenchRouter()).toBe("/workbench");
    expect(demoFromRoute(parseUrl("https://demo.test/workbench"))).toBe("Workbench");
    expect(workflowPath("Horizontal")).toBe("/workflow?orientation=Horizontal");
    expect(dataTablePath()).toBe("/data-table");
    expect(dataTablePath("contact-1")).toBe("/data-table?person=contact-1");
    expect(demoFromRoute(parseUrl("https://demo.test/data-table?person=contact-1")))
      .toBe("DataTable");
    expect(dataGridRouter()).toBe("/data-grid");
    expect(codeEditorRouter()).toBe("/code-editor");
    expect(demoFromRoute(parseUrl("https://demo.test/code-editor"))).toBe("CodeEditor");
    expect(formBuilderPath("Complex", "Preview"))
      .toBe("/form-builder?example=Complex&mode=Preview");
    expect(uiKitRouter()).toBe("/ui-kit");
    expect(queryBuilderRouter()).toBe("/query-builder");
    expect(pdfAnnotatorRouter()).toBe("/pdf-annotator");
    expect(demoFromRoute(parseUrl("https://demo.test/query-builder"))).toBe("QueryBuilder");
    expect(demoFromRoute(parseUrl("https://demo.test/ui-kit"))).toBe("UiKit");
    expect(demoFromRoute(parseUrl("https://demo.test/pdf-annotator"))).toBe("PdfAnnotator");
  });

  it("parses form state and supplies defaults for a bare form route", () => {
    const configured = parseUrl(
      "https://demo.test/form-builder?example=Simple&mode=Preview",
    );
    expect(demoFromRoute(configured)).toBe("FormBuilder");
    expect(formStateFromRoute(configured)).toEqual({
      exampleId: "Simple",
      mode: "Preview",
    });

    expect(formStateFromRoute(parseUrl("https://demo.test/form-builder")))
      .toEqual({ exampleId: "Handoff", mode: "Editor" });
  });

  it("uses the root URL for the project homepage", () => {
    const route = parseUrl("https://demo.test/");
    expect(demoFromRoute(route)).toBe("Home");
    expect(workflowOrientationFromRoute(route)).toBe("Vertical");
    expect(workflowOrientationFromRoute(
      parseUrl("https://demo.test/workflow?orientation=Horizontal"),
    )).toBe("Horizontal");
  });
});
