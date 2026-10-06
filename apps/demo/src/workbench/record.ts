// The Record view shows a worker as the system of record holds it: more than
// the directory shows, nested, with lists too long to send at once. Branches
// load when they are opened, a page at a time, the way a payload behind a
// handle would. The host keeps only how many children have loaded at each
// path and reads them from the record, so they follow saved changes.

import type { ValueTree } from "@foldworks/ui";

import { eligible, requirements, RULE_VERSION, type Snapshot, type Worker } from "./domain";
import type { Model } from "./model";

export type Json =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<Json>
  | Readonly<{ [key: string]: Json }>;

/** Children loaded per request: a branch's first page, or one more page. */
export const PAGE = 10;
export const ROOT_ID = "record";

const SITES: Readonly<Record<string, ReadonlyArray<string>>> = {
  Acme: ["Acme Fulfillment · Dock 2", "Acme Fulfillment · Returns"],
  Globex: ["Globex Plant 4 · Line A", "Globex Plant 4 · Line C"],
};

// Illustrative history, fixed per worker so every visit reads the same.
const seedOf = (id: string) => [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
const day = (offset: number) =>
  new Date(Date.UTC(2026, 8, 30) - offset * 86_400_000).toISOString().slice(0, 10);

const shifts = (worker: Worker): ReadonlyArray<Json> => {
  const seed = seedOf(worker.id);
  const sites = SITES[worker.employer] ?? [`${worker.employer} · Main site`];
  // An inactive worker's shifts stopped when they left.
  const first = worker.active ? 0 : 75;
  return Array.from({ length: worker.active ? 18 + (seed % 13) : 6 }, (_, index) => ({
    date: day(first + Math.floor((index * 7) / 5)),
    site: sites[(seed + index) % sites.length]!,
    start: (seed + index) % 3 === 0 ? "14:00" : "07:00",
    hours: [8, 8, 10, 6][(seed + index) % 4]!,
  }));
};

/** The worker as stored, with the saved changes to them, newest first. */
export const workerRecord = (snapshot: Snapshot, worker: Worker): Json => {
  const seed = seedOf(worker.id);
  return {
    id: worker.id,
    name: worker.name,
    employment: {
      employer: worker.employer,
      status: worker.active ? "active" : "inactive",
      workState: worker.state,
      startedOn: `2023-${String((seed % 12) + 1).padStart(2, "0")}-${String((seed % 27) + 1).padStart(2, "0")}`,
    },
    documents: [
      worker.i9Complete
        ? {
            type: "I-9",
            status: "verified",
            verifiedOn: `2024-${String((seed % 9) + 1).padStart(2, "0")}-14`,
            evidence: { list: "A", title: "U.S. passport", expires: "2031-06-30" },
          }
        : { type: "I-9", status: "missing", requestedOn: "2026-09-02", remindersSent: 2 },
      { type: "W-4", status: "filed", filedOn: "2026-01-09" },
    ],
    compliance: {
      eligible: eligible(worker),
      blockingViolations: worker.blockingViolations,
      openTasks: requirements(worker),
      ruleVersion: RULE_VERSION,
    },
    shifts: shifts(worker),
    history: snapshot.transactions
      .filter((tx) => tx.workerId === worker.id)
      .map((tx) => ({
        id: tx.id,
        actor: tx.actor,
        timestamp: tx.timestamp,
        revision: { before: tx.basis, after: tx.basis + 1 },
        state: { before: tx.before, after: tx.after },
        tasks: { added: tx.added, removed: tx.removed },
        ruleVersion: tx.ruleVersion,
      })),
  };
};

const isList = (value: Json): value is ReadonlyArray<Json> => Array.isArray(value);

/** The parts of a value, as key and value pairs. */
const partsOf = (value: Json): ReadonlyArray<readonly [string, Json]> =>
  value === null || typeof value !== "object"
    ? []
    : isList(value)
      ? value.map((entry, index) => [String(index), entry])
      : Object.entries(value);

const count = (size: number) => `${size} ${size === 1 ? "entry" : "entries"}`;

/** A value inside another's preview: scalars in full, collections by size. */
const brief = (value: Json): string =>
  value === null || typeof value !== "object"
    ? JSON.stringify(value)
    : isList(value)
      ? `[${value.length}]`
      : "{…}";

const describe = (value: Json): Readonly<{ preview: string; kind: string }> => {
  if (value === null) return { preview: "null", kind: "null" };
  if (isList(value)) return { preview: `list · ${count(value.length)}`, kind: "list" };
  if (typeof value !== "object") return { preview: JSON.stringify(value), kind: typeof value };
  // A record previews its first fields, so a page of list entries can be told apart.
  const fields = Object.entries(value).map(([key, entry]) => `${key}: ${brief(entry)}`);
  const preview = `{${fields.join(", ")}}`;
  return { preview: preview.length > 72 ? `${preview.slice(0, 70)}…}` : preview, kind: "record" };
};

/**
 * The nodes for a record. A branch has children once they were requested, up
 * to the number loaded at its path, and offers the rest as more.
 */
export const valueNodes = (
  value: Json,
  loaded: Readonly<Record<string, number>>,
  rootId = ROOT_ID,
): ReadonlyArray<ValueTree.ValueNode> => {
  const build = (current: Json, id: string, key: string | undefined): ValueTree.ValueNode => {
    const parts = partsOf(current);
    const shown = loaded[id];
    const children =
      shown === undefined
        ? undefined
        : parts
            .slice(0, shown)
            .map(([part, entry]) => build(entry, `${id}/${encodeURIComponent(part)}`, part));
    return {
      id,
      ...(key === undefined ? {} : { key }),
      ...describe(current),
      ...(parts.length === 0 ? {} : { expandable: true }),
      ...(children === undefined ? {} : { children }),
      ...(children !== undefined && parts.length > children.length
        ? { more: parts.length - children.length }
        : {}),
    };
  };
  return [build(value, rootId, undefined)];
};

/** The selected worker's record as tree nodes, with the branches loaded so far. */
export const recordNodes = (model: Model): ReadonlyArray<ValueTree.ValueNode> => {
  const worker = model.snapshot.workers.find((item) => item.id === model.selectedId);
  return worker ? valueNodes(workerRecord(model.snapshot, worker), model.loaded) : [];
};

/** The record opens with its top-level fields loaded. */
export const initialLoaded: Readonly<Record<string, number>> = { [ROOT_ID]: PAGE };

/** Loads a branch's first page when it opens, or its next page on “more”. */
export const loadMore = (
  loaded: Readonly<Record<string, number>>,
  request: ValueTree.OutMessage,
): Readonly<Record<string, number>> => ({
  ...loaded,
  [request.id]: (request._tag === "RequestedMore" ? request.loaded : 0) + PAGE,
});
