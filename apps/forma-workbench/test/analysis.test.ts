import { describe, expect, it } from "vitest";

import { analyzeSource, onboarding } from "./support/program.js";

describe("analyzing a program", () => {
  it("keeps the document's text and ids", async () => {
    const analysis = await analyzeSource(onboarding);
    expect(analysis.document.source).toBe(onboarding);
    expect(analysis.rows.length).toBeGreaterThan(30);
  });

  it("types code and elaborates descriptor forms in one document", async () => {
    const analysis = await analyzeSource(onboarding);
    const { source } = analysis.document;
    const typeOf = (text: string) => {
      const start = source.indexOf(text);
      const node = analysis.document.identity.nodes.find(
        (candidate) => candidate.span.start === start && candidate.span.end === start + text.length,
      );
      return node === undefined ? undefined : analysis.types[node.id];
    };
    expect(typeOf("(map with-tax [40 250 1200])")).toBe("List<Float>");
    expect(typeOf("(* amount tax-rate)")).toBe("Float");
    // The sample has no errors yet; the workflow's dataflow is checked by the app.
    expect(analysis.diagnostics).toEqual([]);
  });

  it("classifies symbols from the symbol index", async () => {
    const analysis = await analyzeSource(onboarding);
    const kinds = new Map<string, Set<string>>();
    for (const fact of Object.values(analysis.symbols)) {
      kinds.set(fact.kind, (kinds.get(fact.kind) ?? new Set()).add(fact.name));
    }
    expect([...kinds.get("special")!]).toEqual(expect.arrayContaining(["define", "let"]));
    expect([...kinds.get("macro")!]).toContain("cond");
    expect([...kinds.get("form")!]).toEqual(expect.arrayContaining(["step", "workflow"]));
    expect([...kinds.get("declared")!]).toContain("background-check");
    expect([...kinds.get("local")!]).toEqual(expect.arrayContaining(["amount", "tax"]));
    expect([...kinds.get("builtin")!]).toContain("map");
    const taxRate = analysis.definitions.find((definition) => definition.name === "tax-rate")!;
    expect(analysis.references[taxRate.key]).toHaveLength(1);
  });

  it("reports type errors and elaboration errors where the author wrote them", async () => {
    const source = `${onboarding}\n(with-tax "ten")\n(step audit :reads [:check])\n`;
    const analysis = await analyzeSource(source);
    const texts = analysis.diagnostics.map((diagnostic) => [
      diagnostic.phase,
      source.slice(diagnostic.start, diagnostic.end),
    ]);
    expect(texts).toEqual(
      expect.arrayContaining([
        ["typecheck", '"ten"'],
        ["elaborate", "(step audit :reads [:check])"],
      ]),
    );
  });
});
