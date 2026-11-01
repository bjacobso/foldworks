// The capabilities the sample program may call. They are simulated: a
// directory of people and a chat channel that records what was posted.

import { Effect } from "effect";
import type { ValueProjection } from "@formalang/host/types";
import type { Capability } from "../workbench/index";

const PEOPLE: Readonly<
  Record<string, { readonly name: string; readonly title: string; readonly start: string }>
> = {
  ada: { name: "Ada Lovelace", title: "Analyst", start: "2026-11-02" },
  grace: { name: "Grace Hopper", title: "Engineer", start: "2026-11-09" },
};

const text = (value: ValueProjection | undefined): string | undefined =>
  value?.kind === "string" || value?.kind === "keyword" ? value.value : undefined;

const record = (fields: Readonly<Record<string, string>>): ValueProjection => ({
  kind: "map",
  entries: Object.entries(fields).map(([key, value]) => ({
    key: { kind: "keyword", value: `:${key}` },
    value: { kind: "string", value },
  })),
});

export const posted: string[] = [];

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
    perform: ([handle]) => {
      const person = PEOPLE[text(handle) ?? ""];
      return person === undefined
        ? Effect.fail(`No one in the directory is called ${text(handle) ?? "that"}.`)
        : Effect.succeed(record(person));
    },
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
    perform: ([channel, message]) =>
      Effect.sync(() => {
        posted.push(`${text(channel)}: ${text(message)}`);
        return { kind: "nil" } as const;
      }),
  },
];
