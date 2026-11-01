import { Effect } from "effect";
import { expect, it } from "vitest";
import { analyzeSource, hostLayer, onboarding, posted } from "./support/program.js";
import { FormaHost } from "../src/workbench/host.js";
import { analyzeProgram } from "../src/workbench/analysis.js";
import { sourceToOutline } from "@formalang/ts/syntax";
import { preview } from "../src/workbench/values.js";

it("observes calls inside functions and macro arguments without running capabilities", async () => {
  const analysis = await analyzeSource(onboarding);
  const at = (text: string) => {
    const start = onboarding.indexOf(text);
    return analysis.document.identity.nodes.find(
      (node) => node.span.start === start && node.span.end === start + text.length,
    )!.id;
  };
  expect(analysis.values[at("(* amount tax-rate)")]?.count).toBe(3);
  expect(preview(analysis.values[at("(map badge [1 3 7])")]!.value!)).toBe(
    '("bronze" "silver" "gold")',
  );
  expect(analysis.values[at("(>= years 5)")]?.count).toBe(3);
  expect(posted).toEqual([]);
});

it("projects retained values in their own session, then releases them", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const source = "(map (fn [x] (* x 2)) [1 2 3])";
      const read = sourceToOutline(source);
      const analysis = yield* analyzeProgram({
        revision: 1,
        rows: read.items,
        base: { revision: 0, source, identity: read.identity },
      });
      const { host } = yield* FormaHost;
      const value = analysis.values[read.items[0]!.id]!.value!;
      const projected = yield* Effect.promise(() =>
        host.projectValue({
          sessionId: analysis.valueSession!,
          valueRef: value.valueRef!,
          projections: ["plain-json"],
        }),
      );
      expect(projected.plainJson).toEqual([2, 4, 6]);
      yield* Effect.promise(() => host.closeSession({ sessionId: analysis.valueSession! }));
      const info = yield* Effect.promise(() =>
        host.sessionInfo({ sessionId: analysis.valueSession! }),
      ).pipe(Effect.exit);
      expect(info._tag).toBe("Failure");
    }).pipe(Effect.provide(hostLayer())),
  );
});

it("keeps observations before a type error and exposes elaborated declarations", async () => {
  const source = '(define good (+ 1 2))\n(+ 1 "bad")';
  const analysis = await analyzeSource(source);
  const good = analysis.rows.find((row) => row.text.startsWith("define good"))!;
  expect(analysis.values[good.id]?.value).toMatchObject({ kind: "int", value: 3 });
  expect(analysis.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toHaveLength(
    1,
  );
  const domain = await analyzeSource(onboarding);
  const step = domain.rows.find((row) => row.text.startsWith("step activate "))!;
  expect(domain.values[step.id]).toMatchObject({ origin: "elaboration", value: { kind: "map" } });
});
