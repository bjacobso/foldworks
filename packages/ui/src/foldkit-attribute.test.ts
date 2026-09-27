import type { Attribute } from "foldkit/html";
import { describe, expectTypeOf, it } from "vitest";

// patches/foldkit@0.156.0.patch turns Foldkit's 310-variant `Attribute<Message>`
// union into one covariant interface. As a union, every generic view that infers
// `Message` from an attribute array compares two such unions member by member,
// which pushed TypeScript's identity cache for this package to V8's Map limit
// (docs/foldkit-upstream.md). If this fails after a Foldkit upgrade, carry the
// patch forward. The package's `typecheck` runs one checker (`--checkers 1`) so
// TS 7's parallel checkers cannot hide a cache that outgrows the limit again.
type IsUnion<T, All = T> = T extends unknown ? ([All] extends [T] ? false : true) : never;

describe("foldkit Attribute", () => {
  it("is a single type rather than a union of variants", () => {
    expectTypeOf<IsUnion<Attribute<unknown>>>().toEqualTypeOf<false>();
  });
});
