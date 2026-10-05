import { resolve } from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { decodeDocument } from "@foldkit/markdown";
import { analyzeModule, generateCatalog } from "../../docs/generate";

const root = resolve(import.meta.dirname, "../../../..");
describe("source documentation", () => {
  it("extracts typed contracts, exact source lines, and JSDoc without inventing state transitions", () => {
    const module = analyzeModule(
      `import { Schema as S } from "effect";
/** Visible state. */
export const Model = S.Struct({
  /** Editing mode. */
  mode: S.Literals(["view", "edit"]),
});
export const Message = defineMessageUnion({ Started: {}, Changed: { value: S.String } });
export const OutMessage = defineMessageUnion({ Committed: { value: S.String } });
/** Apply one event. */
export const update = (model: Model, message: Message): Result => ({ model });
const hidden = 42;
export type Result = Readonly<{ model: Model }>;
`,
      "packages/example/src/index.ts",
      "index",
    );
    expect(module.symbols.find((item) => item.name === "Model")).toMatchObject({
      line: 3,
      description: "Visible state.",
    });
    expect(module.symbols.find((item) => item.name === "update")?.signature).toContain(
      "(model: Model, message: Message): Result =>",
    );
    expect(module.symbols.some((item) => item.name === "hidden")).toBe(false);
    expect(module.contracts).toEqual([
      {
        name: "Model",
        kind: "model",
        fields: [
          { name: "mode", schema: 'S.Literals(["view", "edit"])', description: "Editing mode." },
        ],
      },
      {
        name: "Message",
        kind: "messages",
        fields: [
          { name: "Started", schema: "{}", description: "" },
          { name: "Changed", schema: "{ value: S.String }", description: "" },
        ],
      },
      {
        name: "OutMessage",
        kind: "outMessages",
        fields: [{ name: "Committed", schema: "{ value: S.String }", description: "" }],
      },
    ]);
  });

  it("discovers newly exported modules and subpaths and stops at re-export cycles", async () => {
    const fixture = await mkdtemp(resolve(tmpdir(), "foldworks-docs-"));
    const pkg = resolve(fixture, "packages/example");
    try {
      await mkdir(resolve(pkg, "src"), { recursive: true });
      await writeFile(
        resolve(pkg, "package.json"),
        JSON.stringify({
          name: "@foldworks/example",
          version: "1.0.0",
          exports: {
            ".": { import: "./dist/index.js" },
            "./extra": { import: "./dist/extra.js" },
            "./theme.css": "./dist/theme.css",
          },
        }),
      );
      await writeFile(resolve(pkg, "README.md"), "# Example\n\nSource-owned guide.");
      await writeFile(resolve(pkg, "src/index.ts"), 'export * as Child from "./child.js";\n');
      await writeFile(
        resolve(pkg, "src/child.ts"),
        'export * from "./index";\nexport const useful = 1;\n',
      );
      await writeFile(resolve(pkg, "src/extra.ts"), "export type Extra = string;\n");
      const [result] = await generateCatalog(fixture);
      expect(result?.modules.map((module) => module.id)).toEqual(["child", "extra", "index"]);
      expect(result?.entrypoints).toEqual(["@foldworks/example", "@foldworks/example/extra"]);
      expect(decodeDocument(JSON.parse(JSON.stringify(result?.readme))).blocks).toHaveLength(2);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });

  it("generates every public package in this repository with serializable READMEs", async () => {
    const catalog = await generateCatalog(root);
    expect(catalog.map((pkg) => pkg.id)).toContain("keyboard");
    expect(catalog.map((pkg) => pkg.id)).toContain("sidebar");
    expect(catalog.find((pkg) => pkg.id === "ui")?.modules.map((module) => module.id)).toContain(
      "stateful/dialog",
    );
    for (const pkg of catalog) {
      expect(pkg.modules.length).toBeGreaterThan(0);
      expect(() => decodeDocument(JSON.parse(JSON.stringify(pkg.readme)))).not.toThrow();
    }
  });
});
