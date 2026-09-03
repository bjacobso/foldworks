import { Option } from "effect";
import { fromString } from "foldkit/url";
import { describe, expect, it } from "vitest";

import {
  dataGridRouter,
  demoFromRoute,
  formBuilderPath,
  formStateFromRoute,
  uiKitRouter,
  urlToAppRoute,
  workflowOrientationFromRoute,
  workflowPath,
} from "./route";

const parseUrl = (url: string) =>
  urlToAppRoute(Option.getOrThrow(fromString(url)));

describe("demo routes", () => {
  it("builds stable paths for each demo", () => {
    expect(workflowPath("Horizontal")).toBe("/workflow?orientation=Horizontal");
    expect(dataGridRouter()).toBe("/data-grid");
    expect(formBuilderPath("Complex", "Preview"))
      .toBe("/form-builder?example=Complex&mode=Preview");
    expect(uiKitRouter()).toBe("/ui-kit");
    expect(demoFromRoute(parseUrl("https://demo.test/ui-kit"))).toBe("UiKit");
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

  it("keeps the root URL as a workflow alias", () => {
    const route = parseUrl("https://demo.test/");
    expect(demoFromRoute(route)).toBe("Workflow");
    expect(workflowOrientationFromRoute(route)).toBe("Vertical");
    expect(workflowOrientationFromRoute(
      parseUrl("https://demo.test/workflow?orientation=Horizontal"),
    )).toBe("Horizontal");
  });
});
