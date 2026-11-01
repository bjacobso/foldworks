import { Effect } from "effect";
import { expect, it } from "vitest";
import { Outliner } from "@foldworks/outliner";
import { sourceToOutline } from "@formalang/ts/syntax";
import { analyzeProgram } from "../src/workbench/analysis.js";
import { fromRows } from "../src/workbench/document.js";
import { previewEdit, refactoring } from "../src/workbench/edits.js";
import { init } from "../src/workbench/init.js";
import { Message } from "../src/workbench/message.js";
import { update } from "../src/workbench/update.js";
import { hostLayer } from "./support/program.js";

it("renames a definition and its uses, preserves shadowing, and undoes atomically with exact source", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const source = "; keep layout\n(define x  4)\n(let [x 2] (+ x 1))\n(+ x 2)\n";
      const read = sourceToOutline(source);
      const document = { revision: 1, source, identity: read.identity };
      const basis = yield* analyzeProgram({ revision: 1, rows: read.items, base: document });
      const definition = basis.definitions.find(
        (definition) => definition.name === "x" && definition.scope === "global",
      )!;
      const proposal = yield* previewEdit(
        basis,
        refactoring("rename", [definition.nodeId!], "total"),
        "Rename",
        "Refactoring",
        1,
      );
      expect(proposal.analysis.document.source).toContain("(define total  4)");
      expect(proposal.analysis.document.source).toContain("(let [x 2] (+ x 1))");
      expect(proposal.analysis.document.source).toContain("(+ total 2)");
      expect(
        proposal.analysis.document.identity.nodes.some((node) => node.id === definition.nodeId),
      ).toBe(true);
      const initialized = init({ id: "test", title: "program.forma", source }).model;
      const model = {
        ...initialized,
        outline: {
          ...Outliner.init({ id: "test-outline", items: fromRows(read.items) }),
          revision: 1,
        },
        document,
        analysis: basis,
        documents: [{ rows: read.items, document }],
        editToken: 1,
      };
      const applied = update(model, Message.PreparedEdit({ proposal, direct: true })).model;
      expect(applied.document!.source).toContain("(+ total 2)");
      const undone = update(
        applied,
        Message.GotOutlinerMessage({ message: Outliner.Message.ClickedUndo() }),
      ).model;
      expect(undone.document!.source).toBe(source);
    }).pipe(Effect.provide(hostLayer())),
  );
});

it("rejects a rename that captures another binding before any source changes", async () => {
  const source = "(define x 1)\n(let [y 2] (+ x y))";
  await Effect.runPromise(
    Effect.gen(function* () {
      const read = sourceToOutline(source);
      const basis = yield* analyzeProgram({
        revision: 1,
        rows: read.items,
        base: { revision: 1, source, identity: read.identity },
      });
      const definition = basis.definitions.find((definition) => definition.name === "x")!;
      const result = yield* previewEdit(
        basis,
        refactoring("rename", [definition.nodeId!], "y"),
        "Rename",
        "Refactoring",
        1,
      ).pipe(Effect.result);
      expect(result._tag).toBe("Failure");
      expect(basis.document.source).toBe(source);
    }).pipe(Effect.provide(hostLayer())),
  );
});
