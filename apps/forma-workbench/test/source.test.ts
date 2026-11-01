import { Effect } from "effect";
import { expect, it } from "vitest";
import { sourceToOutline } from "@formalang/ts/syntax";
import { readSource } from "../src/workbench/source.js";
import { hostLayer } from "./support/program.js";

it("reconciles source edits without changing untouched node ids or layout", async () => {
  const source = "; keep this\n(define x  42)\n\n(+ x 1)\n";
  const initial = sourceToOutline(source);
  const edited = await Effect.runPromise(
    readSource(source.replace("42", "43"), {
      revision: 0,
      source,
      identity: initial.identity,
    }).pipe(Effect.provide(hostLayer())),
  );
  expect(edited.document.source).toBe(source.replace("42", "43"));
  expect(edited.rows[2]?.id).toBe(initial.items[2]?.id);
  expect(edited.errors).toEqual([]);
  const broken = await Effect.runPromise(
    readSource(source.slice(0, -2), {
      revision: 0,
      source,
      identity: initial.identity,
    }).pipe(Effect.provide(hostLayer())),
  );
  expect(broken.errors.length).toBeGreaterThan(0);
});
