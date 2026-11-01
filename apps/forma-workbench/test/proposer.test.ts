import { Effect } from "effect";
import { expect, it } from "vitest";
import { analyzeProgram } from "../src/workbench/analysis.js";
import { localProposer } from "../src/workbench/proposer.js";
import { AskProposer } from "../src/workbench/propose-command.js";
import { sourceToOutline } from "@formalang/ts/syntax";
import { hostLayer } from "./support/program.js";

it("the local proposer creates deterministic scripts and previews without changing the basis", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const source = "(+ 1 2)";
      const read = sourceToOutline(source);
      const basis = yield* analyzeProgram({
        revision: 1,
        rows: read.items,
        base: { revision: 1, source, identity: read.identity },
      });
      const context = {
        prompt: "Wrap selection in do",
        selectedIds: [read.items[0]!.id],
        focusId: null,
        nodes: [],
        analysis: basis,
      };
      const answer = yield* localProposer.propose(context);
      expect(answer).toEqual(yield* localProposer.propose(context));
      const response = yield* AskProposer({
        basis,
        token: 1,
        prompt: context.prompt,
        selectedIds: context.selectedIds,
        focusId: null,
      }).effect;
      expect(response._tag).toBe("PreparedEdit");
      if (response._tag === "PreparedEdit") {
        expect(response.direct).toBe(false);
        expect(response.proposal.rows[0]?.text).toBe("do");
        expect(response.proposal.rows[0]?.children[0]?.id).toBe(read.items[0]!.id);
        expect(response.proposal.analysis.document.source).toMatch(/\(do\s+\(\+ 1 2\)\)/);
        expect(response.proposal.proposer).toBe("Local proposer");
      }
      expect(basis.document.source).toBe(source);
    }).pipe(Effect.provide(hostLayer())),
  );
});

it("validates provider scripts against the live identity before offering a preview", async () => {
  const provider = {
    name: "Test provider",
    propose: () =>
      Effect.succeed({
        kind: "edit" as const,
        title: "Invalid edit",
        script: { version: 1 as const, ops: [{ op: "delete" as const, target: "not-a-node" }] },
      }),
  };
  await Effect.runPromise(
    Effect.gen(function* () {
      const source = "(+ 1 2)";
      const read = sourceToOutline(source);
      const basis = yield* analyzeProgram({
        revision: 1,
        rows: read.items,
        base: { revision: 1, source, identity: read.identity },
      });
      const response = yield* AskProposer({
        basis,
        token: 1,
        prompt: "delete",
        selectedIds: [read.items[0]!.id],
        focusId: null,
      }).effect;
      expect(response._tag).toBe("FailedEdit");
      expect(basis.document.source).toBe(source);
    }).pipe(Effect.provide(hostLayer({ proposer: provider }))),
  );
});
