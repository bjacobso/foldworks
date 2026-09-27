import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { foldworksLayers, foldworksStylexTest } from "./vite";

const readCss = (name: string) => readFile(resolve(import.meta.dirname, name), "utf8");

describe("foldworksLayers", () => {
  it("lists every cascade layer the base stylesheet uses", async () => {
    const css = await readCss("base.css");
    const used = [...css.matchAll(/@layer\s+([\w-]+)\s*\{/g)].map((match) => match[1]);

    expect(used.length).toBeGreaterThan(0);
    expect(foldworksLayers).toEqual(expect.arrayContaining([...new Set(used)]));
  });

  it("matches the declaration in layers.css", async () => {
    const css = await readCss("layers.css");

    expect(css).toContain(`@layer ${foldworksLayers.join(", ")};`);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "").trim()).toBe(
      `@layer ${foldworksLayers.join(", ")};`,
    );
  });
});

describe("foldworksStylexTest", () => {
  it("aliases @stylexjs/stylex to the test runtime", async () => {
    const [alias] = foldworksStylexTest().config().resolve.alias;

    expect(alias?.find.test("@stylexjs/stylex")).toBe(true);
    expect(alias?.find.test("@stylexjs/stylex/lib/stylex-inject")).toBe(false);
    expect(alias?.replacement).toBe(resolve(import.meta.dirname, "testing", "stylex.ts"));
    await expect(stat(alias?.replacement ?? "")).resolves.toBeDefined();
  });

  it("inlines installed Foldworks packages so the alias reaches them", () => {
    const inline = foldworksStylexTest({ inline: ["@acme/ui"] }).config().test.server.deps.inline;
    const matches = (path: string) =>
      inline.some((pattern) =>
        typeof pattern === "string" ? path.includes(pattern) : pattern.test(path),
      );

    expect(
      matches(
        "/app/node_modules/.pnpm/@foldworks+ui@0.1.0/node_modules/@foldworks/ui/dist/index.js",
      ),
    ).toBe(true);
    expect(matches("C:\\app\\node_modules\\@foldworks\\data-grid\\dist\\index.js")).toBe(true);
    expect(matches("/app/node_modules/effect/dist/index.js")).toBe(false);
    expect(inline).toContain("@acme/ui");
  });
});
