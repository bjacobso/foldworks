import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bootstrapFromSources, elaborateProgram } from "@formalang/ts/descriptor";
import { preludeSource } from "@formalang/ts/preludes";

import { dataflow } from "./checks";

const prelude = bootstrapFromSources(
  preludeSource("compiler.lisp"),
  readFileSync(new URL("./workflow.lisp", import.meta.url), "utf8"),
);

const steps = `(step verify :system "Persona" :writes [:identity])
(step check :system "Checkr" :reads [:identity] :writes [:check])
(step activate :system "Okta" :reads [:check])
`;

const warnings = (workflow: string) => {
  const source = steps + workflow;
  const { declarations, diagnostics } = elaborateProgram(source, { prelude, sourceId: "flow" });
  expect(diagnostics).toEqual([]);
  return dataflow(declarations, source).map((diagnostic) => [
    source.slice(diagnostic.span!.startOffset, diagnostic.span!.endOffset),
    diagnostic.message,
  ]);
};

describe("workflow dataflow", () => {
  it("accepts steps that run after the steps they depend on", () => {
    expect(warnings("(workflow w (use verify) (use check) (use activate))")).toEqual([]);
  });

  it("warns on a step that may run before its data is written", () => {
    expect(warnings("(workflow w (parallel (use verify) (use check)) (use activate))")).toEqual([
      ["check", "check may read :identity before verify writes it"],
    ]);
  });

  it("warns when the writer is not in the workflow", () => {
    expect(warnings("(workflow w (use check) (use activate))")).toEqual([
      ["check", "check reads :identity, but verify, which writes it, is not in w"],
    ]);
  });
});
