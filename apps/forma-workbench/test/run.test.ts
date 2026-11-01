import { Effect } from "effect";
import { expect, it } from "vitest";
import { sourceToOutline } from "@formalang/ts/syntax";
import { analyzeProgram } from "../src/workbench/analysis.js";
import { resumeRun, startRun } from "../src/workbench/run.js";
import { FormaHost } from "../src/workbench/host.js";
import { Message } from "../src/workbench/message.js";
import { update } from "../src/workbench/update.js";
import { init } from "../src/workbench/init.js";
import { fromRows } from "../src/workbench/document.js";
import { Outliner } from "@foldworks/outliner";
import { hostLayer } from "./support/program.js";
import type { Capability } from "../src/workbench/config.js";

it("gates every host call, propagates requirements, and cancels a stale permission on edits", async () => {
  const performed: string[] = [];
  const capabilities: ReadonlyArray<Capability> = [
    {
      name: "Test.read",
      arity: 0,
      purity: "read",
      description: "Read a value",
      typeScheme: { kind: "function", params: [], result: { kind: "type", name: "Float" } },
      perform: () =>
        Effect.sync(() => {
          performed.push("read");
          return { kind: "int", value: 42 };
        }),
    },
    {
      name: "Test.write",
      arity: 1,
      purity: "write",
      description: "Write a value",
      typeScheme: {
        kind: "function",
        params: [{ kind: "type", name: "Float" }],
        result: { kind: "type", name: "Unit" },
      },
      perform: () =>
        Effect.sync(() => {
          performed.push("write");
          return { kind: "nil" };
        }),
    },
  ];
  await Effect.runPromise(
    Effect.gen(function* () {
      const source = "(define commit [x] (Test.write x))\n(commit (Test.read))";
      const read = sourceToOutline(source);
      const basis = yield* analyzeProgram({
        revision: 1,
        rows: read.items,
        base: { revision: 1, source, identity: read.identity },
      });
      expect(basis.requirements[read.items[1]!.id]).toEqual(["Test.read", "Test.write"]);
      expect(performed).toEqual([]);
      const pending = yield* startRun(basis, 1);
      expect(pending.call?.name).toBe("Test.read");
      expect(performed).toEqual([]);
      const next = yield* resumeRun(pending, basis, true);
      expect(next.call?.name).toBe("Test.write");
      expect(performed).toEqual(["read"]);
      const denied = yield* resumeRun(next, basis, false);
      expect(denied.status).toBe("failed");
      expect(denied.diagnostics[0]?.message).toContain("Denied Test.write");
      expect(performed).toEqual(["read"]);
      const again = yield* startRun(basis, 2);
      const approval = yield* resumeRun(again, basis, true);
      const done = yield* resumeRun(approval, basis, true);
      expect(done.status).toBe("completed");
      expect(performed).toEqual(["read", "read", "write"]);
      const waiting = yield* startRun(basis, 3);
      const original = init({ id: "test", title: "program.forma", source }).model;
      const model = {
        ...original,
        analysis: basis,
        document: basis.document,
        run: waiting,
        runToken: 3,
        outline: {
          ...Outliner.init({ id: "test-outline", items: fromRows(read.items) }),
          revision: 1,
        },
      };
      const edited = update(
        model,
        Message.GotOutlinerMessage({
          message: Outliner.Message.EditedText({
            id: read.items[1]!.id,
            text: "commit 1",
            start: 8,
            end: 8,
            time: 1,
          }),
        }),
      );
      expect(edited.model.run).toBeNull();
      const aborted = edited.commands?.find(
        (command) => command.name === "AbortSupersededFormaRun",
      );
      expect(aborted).toBeDefined();
      yield* aborted!.effect;
      const { host } = yield* FormaHost;
      const info = yield* Effect.promise(() =>
        host.sessionInfo({ sessionId: waiting.sessionId }),
      ).pipe(Effect.exit);
      expect(info._tag).toBe("Failure");
    }).pipe(Effect.provide(hostLayer({ capabilities }))),
  );
});
