// Build and test configuration helpers for applications that use Foldworks
// with Vite and Vitest. This entry runs in Node inside `vite.config.ts` or
// `vitest.config.ts`; it never imports StyleX or component code.
import { fileURLToPath } from "node:url";

/**
 * Cascade layers that must rank below StyleX's `priority*` layers, in order.
 *
 * Pass them to the StyleX plugin so its stylesheet declares them first,
 * whichever stylesheet the browser happens to load first:
 *
 * ```ts
 * stylex.vite({ useCSSLayers: { before: foldworksLayers } })
 * ```
 */
export const foldworksLayers: ReadonlyArray<string> = ["foldworks-reset"];

type Alias = { readonly find: RegExp; readonly replacement: string };

/** The subset of a Vite plugin that `foldworksStylexTest` returns. */
export type FoldworksStylexTestPlugin = {
  readonly name: "foldworks:stylex-test";
  readonly enforce: "pre";
  readonly config: () => {
    readonly resolve: { readonly alias: Array<Alias> };
    readonly test: {
      readonly server: { readonly deps: { readonly inline: Array<string | RegExp> } };
    };
  };
};

export type FoldworksStylexTestOptions = {
  /**
   * Additional installed packages that import `@stylexjs/stylex` and must be
   * processed by Vite so the alias reaches them. `@foldworks/*` packages are
   * always included.
   */
  readonly inline?: ReadonlyArray<string | RegExp>;
};

// Resolves next to this module: `dist/testing/stylex.js` when installed, or
// the TypeScript source when this file is loaded from the repository.
const stubPath = (): string =>
  fileURLToPath(
    new URL(
      import.meta.url.endsWith(".ts") ? "./testing/stylex.ts" : "./testing/stylex.js",
      import.meta.url,
    ),
  );

/**
 * A Vite plugin for Vitest that swaps `@stylexjs/stylex` for the uncompiled
 * test runtime in `@foldworks/ui/testing/stylex`, so views render in tests
 * without the StyleX compiler. Class names equal the style keys.
 *
 * ```ts
 * // vitest.config.ts
 * import { foldworksStylexTest } from "@foldworks/ui/vite";
 * import { defineConfig } from "vitest/config";
 *
 * export default defineConfig({ plugins: [foldworksStylexTest()] });
 * ```
 */
export const foldworksStylexTest = (
  options: FoldworksStylexTestOptions = {},
): FoldworksStylexTestPlugin => ({
  name: "foldworks:stylex-test",
  enforce: "pre",
  config: () => ({
    resolve: { alias: [{ find: /^@stylexjs\/stylex$/, replacement: stubPath() }] },
    // Vitest loads installed packages with Node by default, which bypasses
    // aliases. Inlining sends them through Vite so they receive the stub.
    test: { server: { deps: { inline: [/[\\/]@foldworks[\\/]/, ...(options.inline ?? [])] } } },
  }),
});
