// The demo program and its prelude are the workbench's fixtures.

import { readFileSync } from "node:fs";
import { Effect, Layer } from "effect";
import { TsLanguageHost } from "@formalang/host/ts-host";
import { sourceToOutline, type OutlineItem } from "@formalang/ts/syntax";

import { analyzeProgram, type Analysis } from "../../src/workbench/analysis.js";
import type { Capability, WorkbenchConfig } from "../../src/workbench/config.js";
import { FormaHost } from "../../src/workbench/host.js";

const program = new URL("../../src/program/", import.meta.url);

export const onboarding = readFileSync(new URL("onboarding.forma", program), "utf8");
export const workflowPrelude = readFileSync(new URL("workflow.lisp", program), "utf8");

export const posted: string[] = [];

/** The demo's capabilities, with the same names, types, and purity. */
export const capabilities: ReadonlyArray<Capability> = [
  {
    name: "Directory.lookup",
    arity: 1,
    purity: "read",
    description: "Looks a person up in the company directory.",
    typeScheme: {
      kind: "function",
      params: [{ kind: "type", name: "String" }],
      result: { kind: "any" },
    },
    perform: () =>
      Effect.succeed({
        kind: "map",
        entries: [
          {
            key: { kind: "keyword", value: ":name" },
            value: { kind: "string", value: "Ada Lovelace" },
          },
        ],
      }),
  },
  {
    name: "Chat.post",
    arity: 2,
    purity: "write",
    description: "Posts a message to a chat channel.",
    typeScheme: {
      kind: "function",
      params: [
        { kind: "type", name: "String" },
        { kind: "type", name: "String" },
      ],
      result: { kind: "type", name: "Unit" },
    },
    perform: ([, message]) =>
      Effect.sync(() => {
        posted.push(message?.kind === "string" ? message.value : "");
        return { kind: "nil" } as const;
      }),
  },
];

export const config: WorkbenchConfig = {
  sourceId: "onboarding.forma",
  preludes: [{ sourceId: "workflow.lisp", source: workflowPrelude }],
  capabilities,
};

export const hostLayer = (overrides: Partial<WorkbenchConfig> = {}): Layer.Layer<FormaHost> =>
  FormaHost.layer(new TsLanguageHost(), { ...config, ...overrides });

/** Analyzes a source as the workbench does after reading it, optionally after editing its rows. */
export const analyzeSource = (
  source: string,
  layer: Layer.Layer<FormaHost> = hostLayer(),
  edit: (rows: ReadonlyArray<OutlineItem>) => ReadonlyArray<OutlineItem> = (rows) => rows,
): Promise<Analysis> => {
  const read = sourceToOutline(source);
  return Effect.runPromise(
    analyzeProgram({
      revision: 1,
      rows: edit(read.items),
      base: { revision: 0, source, identity: read.identity },
    }).pipe(Effect.provide(layer)),
  );
};

/** Rows with one row's text changed, as typing changes it. */
export const retype =
  (from: string, to: string) =>
  (rows: ReadonlyArray<OutlineItem>): ReadonlyArray<OutlineItem> =>
    rows.map((row) => ({
      ...row,
      text: row.text === from ? to : row.text,
      children: retype(from, to)(row.children),
    }));
