import { describe, expect, it } from "vitest";

import { sourceDiagnostics, sourceTokens, summary, viewOf } from "../src/workbench/adapter.js";
import { analyzeSource, hostLayer, onboarding, retype } from "./support/program.js";
import type { OutlineItem } from "@formalang/ts/syntax";

const rowTexts = async (
  source: string,
  edit?: (rows: ReadonlyArray<OutlineItem>) => ReadonlyArray<OutlineItem>,
) => {
  const analysis = await analyzeSource(source, hostLayer(), edit);
  const view = viewOf(analysis);
  const row = (text: string) =>
    [...view.rows.values()].find((candidate) => candidate.layout.text === text)!;
  return { analysis, view, row };
};

describe("the analysis adapter", () => {
  it("colors a row's symbols by what they resolve to", async () => {
    const { row } = await rowTexts(onboarding);
    const letRow = row("let [tax (* amount tax-rate)]");
    const kinds = letRow.tokens
      .filter((token) => token.kind !== "paren")
      .map((token) => [letRow.layout.text.slice(token.from, token.to), token.kind]);
    expect(kinds).toEqual([
      ["let", "special"],
      ["tax", "definition"],
      ["*", "builtin"],
      ["amount", "local"],
      ["tax-rate", "defined"],
    ]);
    const steps = row("use background-check");
    expect(steps.tokens).toEqual([
      { from: 0, to: 3, kind: "form" },
      { from: 4, to: 20, kind: "declared" },
    ]);
  });

  it("puts a diagnostic in the row that contains it, at its place in the text", async () => {
    const source = onboarding.replace("(map badge [1 3 7])", '(map badge [1 "three" 7])');
    const { row, view } = await rowTexts(source);
    const broken = row('map badge [1 "three" 7]');
    expect(broken.tone).toBe("error");
    const [diagnostic] = broken.diagnostics;
    expect(broken.layout.text.slice(diagnostic!.from, diagnostic!.to)).toBe('"three"');
    expect(view.unplaced).toEqual([]);
  });

  it("covers a row whose own text does not show the span", async () => {
    const source = onboarding.replace("(* amount tax-rate)", '(* amount "rate")');
    const { analysis, row } = await rowTexts(source);
    expect(summary(analysis).errors).toBe(1);
    const call = row('let [tax (* amount "rate")]');
    const [diagnostic] = call.diagnostics;
    expect(call.layout.text.slice(diagnostic!.from, diagnostic!.to)).toBe('(* amount "rate")');
  });

  it("gives the source pane the same facts in document offsets", async () => {
    const { analysis } = await rowTexts(onboarding);
    const tokens = sourceTokens(analysis);
    const at = (text: string) => {
      const start = onboarding.indexOf(text);
      return tokens.find((token) => token.from === start && token.to === start + text.length)?.kind;
    };
    expect(at("workflow")).toBe("form");
    expect(at("Directory.lookup")).toBe("capability");
    expect(sourceDiagnostics(analysis)).toEqual([]);
  });
});

describe("rows that do not read", () => {
  it("marks the row and analyzes the rest of the program", async () => {
    const { analysis, row, view } = await rowTexts(
      onboarding,
      retype("map badge [1 3 7]", "map badge [1 3 7"),
    );
    // The document keeps what was typed.
    expect(analysis.document.source).toContain("(map badge [1 3 7)");
    expect(analysis.analyzed).not.toBeNull();
    expect(analysis.brokenRows).toHaveLength(1);
    const broken = row("map badge [1 3 7");
    expect(broken.tone).toBe("error");
    expect(broken.diagnostics[0]).toMatchObject({ from: 0, to: 16, code: "parse/syntax" });
    // The forms after it are still read and analyzed.
    expect(summary(analysis)).toMatchObject({ forms: 13, errors: 1 });
    expect(
      row('step activate :system "Okta" :reads [:check :i9 :payroll]').tokens[0],
    ).toMatchObject({ kind: "form" });
    expect(view.unplaced).toEqual([]);
  });
});
