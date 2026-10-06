import { describe as group, expect, it } from "vitest";
import {
  analyze,
  complete,
  describe,
  diagnostics,
  environmentSample,
  occurrences,
  resolve,
  tokens,
} from "./environment";

const at = (text: string, part: string, offset = 0) => text.indexOf(part) + offset;
const kindOf = (text: string, part: string) =>
  tokens(analyze(text)).find((token) => token.from === text.indexOf(part))?.kind;

group("environment language service", () => {
  it("marks known and unknown settings and references", () => {
    const text = environmentSample;
    expect(kindOf(text, "APP_ENV")).toBe("property");
    expect(kindOf(text, "LOG_LEVL")).toBe("unknown");
    expect(kindOf(text, "${API_HOST}")).toBe("reference");
    expect(kindOf(text, "${RELEASE}")).toBe("reference");
    expect(kindOf(text, "${CACHE_HOST}")).toBe("unknown");
    expect(kindOf(text, "3\n")).toBe("number");
    expect(kindOf(text, "true\n")).toBe("constant");
    expect(kindOf(text, "# Settings")).toBe("comment");
  });

  it("reports unknown settings, unresolved references, and invalid values", () => {
    expect(diagnostics(analyze(environmentSample)).map((issue) => issue.message)).toEqual([
      "LOG_LEVL is not a setting the deploy host reads. Did you mean LOG_LEVEL?",
      "CACHE_HOST is not set in this file or by the platform.",
    ]);
    const text = "APP_ENV=staging\nRETRY_ATTEMPTS=12\nAPI_URL=${API_URL}\nAPI_HOST=${HOST\nNAME\n";
    const issues = diagnostics(analyze(text));
    expect(issues.map((issue) => issue.message)).toEqual([
      "Expected NAME=value.",
      "APP_ENV expects development or production.",
      "RETRY_ATTEMPTS expects a whole number from 0 to 10.",
      "API_URL cannot refer to itself.",
      "Close the reference with }.",
    ]);
    expect(text.slice(issues[1]!.from, issues[1]!.to)).toBe("staging");
    expect(diagnostics(analyze("LOG_LEVEL=\nAPP_ENV="))).toEqual([]);
    expect(diagnostics(analyze("  \n\t\r\nAPP_ENV=production\r\n"))).toEqual([]);
  });

  it("resolves references through other settings and the platform", () => {
    const analysis = analyze(environmentSample);
    expect(resolve(analysis, "API_URL")).toBe("https://api.foldworks.dev/v2");
    expect(resolve(analysis, "APP_NAME")).toBe("Foldworks 2026.10.1");
    expect(resolve(analysis, "CACHE_HOST")).toBeUndefined();
  });

  it("suggests settings that are not set yet, allowed values, and reference names", () => {
    const text = "APP_ENV=prod\nLOG\nAPI_HOST=api\nAPI_URL=https://${A";
    const analysis = analyze(text);
    const key = complete(analysis, at(text, "LOG", 3), false);
    expect(key?.items.map((item) => item.insert)).toContain("LOG_LEVEL=");
    expect(key?.items.map((item) => item.label)).not.toContain("APP_ENV");
    const value = complete(analysis, at(text, "prod", 4), false);
    expect(value).toMatchObject({ from: at(text, "prod"), to: at(text, "prod", 4) });
    expect(value?.items.map((item) => item.label)).toEqual(["development", "production"]);
    const reference = complete(analysis, text.length, false);
    expect(reference?.items.find((item) => item.label === "API_HOST")).toMatchObject({
      insert: "API_HOST}",
      detail: "api",
    });
    expect(reference?.items.map((item) => item.label)).not.toContain("API_URL");
    const paired = "CACHE_URL=redis://${REG}";
    expect(complete(analyze(paired), paired.length - 1, false)).toMatchObject({
      to: paired.length,
      items: expect.arrayContaining([
        { label: "REGION", insert: "REGION}", detail: "eu-west-1 · platform", kind: "reference" },
      ]),
    });
    expect(complete(analyze("APP_NAME=Fold"), 13, false)).toBeUndefined();
    expect(complete(analyze("# LOG"), 5, true)).toBeUndefined();
  });

  it("describes settings, references, and values that use references", () => {
    const text = environmentSample;
    const analysis = analyze(text);
    expect(describe(analysis, at(text, "APP_ENV", 2))).toMatchObject({
      title: "APP_ENV",
      values: ["development", "production"],
    });
    expect(describe(analysis, at(text, "${API_HOST}", 3))).toMatchObject({
      title: "API_HOST",
      kind: "Set on line 5",
      value: "api.foldworks.dev",
    });
    expect(describe(analysis, at(text, "${RELEASE}", 3))).toMatchObject({
      kind: "Platform value",
      value: "2026.10.1",
    });
    expect(describe(analysis, at(text, "https://"))).toMatchObject({
      title: "API_URL",
      value: "https://api.foldworks.dev/v2",
    });
    expect(describe(analysis, at(text, "LOG_LEVL"))).toBeUndefined();
  });

  it("finds where a name is set and used", () => {
    const text = environmentSample;
    expect(
      occurrences(analyze(text), "API_HOST").map(({ from, to, kind }) => [
        text.slice(from, to),
        kind,
      ]),
    ).toEqual([
      ["API_HOST=api.foldworks.dev", "definition"],
      ["${API_HOST}", "reference"],
    ]);
  });
});
