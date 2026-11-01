import { Effect, Schema as S } from "effect";
import type { EditOp, EditScript } from "@formalang/host/types";
import { preserveEditRows } from "./edit-rows.js";
import { Analysis, analyzeProgram, type Analysis as AnalysisValue } from "./analysis.js";
import { OutlineRow } from "./document.js";
import { FormaHost, call, required } from "./host.js";
import { preview } from "./values.js";

const Place = S.Union([
  S.Struct({ before: S.String }),
  S.Struct({ after: S.String }),
  S.Struct({ parent: S.NullOr(S.String), index: S.optional(S.Number) }),
]);
/** Matches the host's edit-script vocabulary; the host validates semantic constraints too. */
export const Script: S.Codec<EditScript> = S.Struct({
  version: S.Literal(1),
  description: S.optional(S.String),
  ops: S.Array(
    S.Union([
      S.Struct({ op: S.Literal("replace"), target: S.String, text: S.String }),
      S.Struct({ op: S.Literal("insert"), at: Place, text: S.String }),
      S.Struct({ op: S.Literal("delete"), target: S.String }),
      S.Struct({ op: S.Literal("wrap"), targets: S.Array(S.String), head: S.String }),
      S.Struct({ op: S.Literals(["splice", "unwrap", "raise"]), target: S.String }),
      S.Struct({ op: S.Literal("move"), target: S.String, to: Place }),
      S.Struct({ op: S.Literal("rename"), target: S.String, to: S.String }),
      S.Struct({ op: S.Literal("extract"), target: S.String, name: S.String }),
    ]),
  ),
});
export const Consequence = S.Struct({
  kind: S.Literals(["added", "removed", "changed"]),
  label: S.String,
  detail: S.optionalKey(S.String),
});
export const Proposal = S.Struct({
  token: S.Number,
  basis: S.Number,
  title: S.String,
  proposer: S.String,
  script: Script,
  rows: S.Array(OutlineRow),
  analysis: Analysis,
  consequences: S.Array(Consequence),
});
export type Proposal = typeof Proposal.Type;

const diagnostics = (analysis: AnalysisValue) =>
  analysis.diagnostics.map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`);
export const consequences = (
  before: AnalysisValue,
  after: AnalysisValue,
): ReadonlyArray<typeof Consequence.Type> => {
  const result: Array<typeof Consequence.Type> = [];
  const old = diagnostics(before),
    now = diagnostics(after);
  const difference = (left: string[], right: string[], kind: "added" | "removed") => {
    const remaining = [...right];
    for (const label of left) {
      const at = remaining.indexOf(label);
      if (at >= 0) remaining.splice(at, 1);
      else result.push({ kind, label });
    }
  };
  difference(old, now, "removed");
  difference(now, old, "added");
  for (const [id, observed] of Object.entries(after.values)) {
    const previous = before.values[id]?.value;
    if (observed.value === null || previous == null) continue;
    const was = preview(previous),
      value = preview(observed.value);
    if (was !== value)
      result.push({
        kind: "changed",
        label: after.rows.find((row) => row.id === id)?.text ?? "Expression value",
        detail: `${was} → ${value}`,
      });
  }
  const oldRequirements = new Set(Object.values(before.requirements).flat());
  const newRequirements = new Set(Object.values(after.requirements).flat());
  for (const name of newRequirements)
    if (!oldRequirements.has(name))
      result.push({
        kind: "added",
        label: `Requires ${name}`,
        detail: "Approval is required before this capability runs.",
      });
  for (const name of oldRequirements)
    if (!newRequirements.has(name)) result.push({ kind: "removed", label: `Requires ${name}` });
  return result;
};

/** Structural operations run through Forma, then the same analysis pipeline used by editing. */
export const previewEdit = (
  basis: AnalysisValue,
  script: EditScript,
  title: string,
  proposer: string,
  token: number,
) =>
  Effect.gen(function* () {
    const { host, sessionId, config } = yield* FormaHost;
    const apply = yield* required(host, "applyEditScript");
    const read = yield* required(host, "sourceToOutline");
    const result = yield* call(() =>
      apply({
        sourceId: config.sourceId,
        source: basis.document.source,
        identity: basis.document.identity,
        sessionId,
        script,
      }),
    );
    if (!result.ok)
      return yield* Effect.fail(result.errors.map((error) => error.message).join("; "));
    const rows = yield* call(() =>
      read({ sourceId: config.sourceId, source: result.source, identity: result.identity }),
    );
    const projected = yield* preserveEditRows(
      result.source,
      result.identity,
      rows.items,
      new Set(basis.rows.map((row) => row.id)),
    );
    const analyzed = yield* analyzeProgram({
      revision: basis.revision,
      rows: projected,
      base: {
        revision: basis.revision,
        source: result.source,
        identity: result.identity as AnalysisValue["document"]["identity"],
      },
    });
    return {
      token,
      basis: basis.revision,
      title,
      proposer,
      script,
      rows: projected,
      analysis: analyzed,
      consequences: consequences(basis, analyzed),
    } satisfies Proposal;
  });

export type Refactoring = "wrap" | "unwrap" | "raise" | "splice" | "rename" | "extract";
export const refactoring = (
  action: Refactoring,
  targets: ReadonlyArray<string>,
  argument: string,
): EditScript => {
  const target = targets[0];
  if (target === undefined) throw new Error("Select a form first.");
  let op: EditOp;
  if (action === "wrap") op = { op: "wrap", targets, head: argument || "do" };
  else if (action === "rename") op = { op: "rename", target, to: argument };
  else if (action === "extract") op = { op: "extract", target, name: argument };
  else op = { op: action, target };
  return { version: 1, description: action, ops: [op] };
};
