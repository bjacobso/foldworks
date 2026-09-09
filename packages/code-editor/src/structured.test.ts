import { Schema as S } from "effect";
import { describe, expect, it } from "vitest";
import * as CodeEditor from "./code-editor";
import { validDiagnostics } from "./diagnostics";
import { difference } from "./native/operations";
import { validate, withSchema } from "./structured";

const Config = S.Struct({
  name: S.String.check(S.isMinLength(1)),
  environment: S.Literals(["development", "production"]),
  retries: S.Number.check(S.isInt(), S.isBetween({ minimum: 0, maximum: 10 })),
  flags: S.Array(S.Struct({ enabled: S.Boolean })),
});
const good = { name: "Demo", environment: "development", retries: 3, flags: [{ enabled: true }] };
const json = JSON.stringify(good);
const yaml = 'name: Demo\nenvironment: development\nretries: 3\nflags:\n  - enabled: true\n';
const document = (text: string, languageId = "json") => CodeEditor.init({ id: "test", text, languageId }).document;
const issues = (text: string, languageId = "json") => validate(Config, document(text, languageId));

describe("Effect Schema configuration validation", () => {
  it("validates both formats and leaves other languages alone", () => {
    expect(issues(json)).toEqual([]);
    expect(issues(yaml, "yaml")).toEqual([]);
    expect(issues(yaml, "yml")).toEqual([]);
    expect(issues("const x = 1", "typescript")).toEqual([]);
  });
  it.each(["json", "yaml"])("maps nested %s errors to the right values", (language) => {
    const text = language === "json" ? JSON.stringify({ ...good, retries: -1, flags: [{ enabled: true }, { enabled: "😀" }] })
      : yaml.replace("retries: 3", "retries: -1") + '  - enabled: "😀"\n';
    const found = issues(text, language);
    expect(found).toHaveLength(2);
    expect(found.map((issue) => text.slice(issue.from, issue.to))).toEqual(['-1', '"😀"']);
    expect(found[1]!.message).toContain("flags.1.enabled");
    expect(validDiagnostics(text, found)).toBe(true);
  });
  it("reports missing properties on their nearest container and unknown properties on their value", () => {
    const text = JSON.stringify({ ...good, flags: [{}], extra: "typo" });
    const found = issues(text);
    expect(found.map((issue) => text.slice(issue.from, issue.to)).sort()).toEqual(['"typo"', '{}']);
    expect(found.some((issue) => issue.message.includes("flags.0.enabled"))).toBe(true);
    expect(validate(Config, document(text), { onExcessProperty: "ignore" })).toHaveLength(1);
  });
  it("uses strict JSON syntax, including rejecting YAML syntax and trailing commas", () => {
    for (const text of ['{"name":}', '{"name":"Demo",}', 'name: Demo', '/* comment */ {}', ""]) {
      const found = issues(text);
      expect(found).toHaveLength(1);
      expect(validDiagnostics(text, found)).toBe(true);
    }
  });
  it("preserves JSON semantics for duplicate keys, escaped keys, and strings", () => {
    const schema = S.Struct({ enabled: S.Boolean });
    const text = '{"enabled":true,"enabl\\u0065d":"no"}';
    const found = validate(schema, document(text));
    expect(found).toHaveLength(1);
    expect(text.slice(found[0]!.from, found[0]!.to)).toBe('"no"');
    for (const text of ['"\\uD83D\\uDE00"', '"\\uD800"', '"a\\tb"', '"a\\u0000b"']) {
      expect(validate(S.String, document(text))).toEqual([]);
    }
  });
  it("reports YAML syntax errors, duplicate keys, and unresolved aliases", () => {
    for (const text of ["name: [\n", "name: one\nname: two\n", "name: *missing\n", "a: 1\n---\nb: 2\n"]) {
      const found = issues(text, "yaml");
      expect(found.length).toBeGreaterThan(0);
      expect(validDiagnostics(text, found)).toBe(true);
    }
  });
  it("handles YAML comments, block strings and aliases, and rejects cyclic aliases", () => {
    const text = 'name: |\n  Demo\n# comment\nenvironment: production\nretries: 2\nflags:\n  - &flag { enabled: true }\n  - *flag\n';
    expect(issues(text, "yaml")).toEqual([]);
    const invalid = text.replace("enabled: true", 'enabled: "no"');
    const found = issues(invalid, "yaml");
    expect(found.map((issue) => invalid.slice(issue.from, issue.to))).toEqual(['"no"', '*flag']);
    expect(validate(S.Unknown, document("a: &a { self: *a }", "yaml"))[0]!.message).toContain("Cyclic");
  });
  it("decodes transformations against their encoded input without changing editor text", () => {
    const schema = S.NumberFromString.check(S.isFinite());
    expect(validate(schema, document('"12"'))).toEqual([]);
    expect(validate(schema, document('"not a number"'))).toHaveLength(1);
  });
});

describe("schema editor composition", () => {
  const editor = withSchema(CodeEditor.implementation, Config);
  const diagnostics = (model: CodeEditor.Model) => model.diagnostics.flatMap((batch) => batch.diagnostics);
  const edit = (model: CodeEditor.Model, text: string) => editor.update(model, CodeEditor.Message.Edited({
    session: model.document.session, lease: model.lease, baseRevision: model.document.revision,
    edits: difference(model.document.text, text), before: model.selection, selection: { anchor: 0, head: 0 },
    kind: "input", time: 1, groupId: 0,
  }));
  it("validates initial text, mount, edits, and remounts without duplicating JSON syntax diagnostics", () => {
    let model = editor.init({ id: "schema", languageId: "json", text: "{}" });
    expect(diagnostics(model)).toHaveLength(4);
    model = editor.update(model, CodeEditor.Message.Mounted({ session: 0, lease: "mount" })).model;
    expect(diagnostics(model)).toHaveLength(4);
    const result = edit(model, json);
    expect(result.outMessage?._tag).toBe("ChangedDocument");
    expect(result.model.past).toHaveLength(1);
    expect(diagnostics(result.model)).toEqual([]);
    model = edit(result.model, '{"name":}').model;
    expect(diagnostics(model)).toHaveLength(1);
    expect(diagnostics(editor.update(model, CodeEditor.Message.Mounted({ session: 0, lease: "remount" })).model)).toHaveLength(1);
  });
  it("revalidates replacements and language changes, isolates instances, and rejects stale batches", () => {
    const first = editor.init({ id: "first", text: json, languageId: "json" });
    const second = editor.init({ id: "second", text: "{}", languageId: "yaml" });
    const replaced = editor.update(first, editor.execute(CodeEditor.Operation.ReplaceDocument({ text: yaml, languageId: "yaml", uri: "file:///config.yaml" }))).model;
    expect(diagnostics(replaced)).toEqual([]);
    expect(diagnostics(second)).toHaveLength(4);
    const stale = editor.update(replaced, editor.execute(CodeEditor.Operation.SetDiagnostics({ ...first.document, source: "yaml", diagnostics: [{ from: 0, to: 1, severity: "error", message: "old" }] }))).model;
    expect(stale).toBe(replaced);
    const plain = editor.update(second, editor.execute(CodeEditor.Operation.SetLanguage({ languageId: "text" }))).model;
    expect(diagnostics(plain)).toEqual([]);
    const again = editor.update(plain, editor.execute(CodeEditor.Operation.SetLanguage({ languageId: "yaml" }))).model;
    expect(diagnostics(again)).toHaveLength(4);
  });
  it("preserves other diagnostic sources and avoids decoding for selection or scrolling", () => {
    let calls = 0;
    const counted = withSchema(CodeEditor.implementation, S.String.check(S.makeFilter(() => { calls++; return true; })));
    let model = counted.init({ id: "counter", text: '"hello"', languageId: "json" });
    const initialCalls = calls;
    model = counted.update(model, CodeEditor.Message.Selected({ session: 0, lease: "", revision: 0, selection: { anchor: 1, head: 2 } })).model;
    model = counted.update(model, counted.execute(CodeEditor.Operation.SetDiagnostics({ ...model.document, source: "lsp", diagnostics: [{ from: 1, to: 2, severity: "warning", message: "external" }] }))).model;
    expect(calls).toBe(initialCalls);
    expect(diagnostics(model).some((issue) => issue.message === "external")).toBe(true);
  });
});
