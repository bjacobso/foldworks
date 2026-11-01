import { Effect, Schema as S } from "effect";
import type { EvaluationState, HostCall, Diagnostic } from "@formalang/host/types";
import { descriptorForms, blank, SourceDiagnostic, type Analysis } from "./analysis.js";
import { FormaHost, call, configureSession, openValueSession, closeValueSession } from "./host.js";
import { Observed, Projection, observationsOf, evaluationDiagnostics, preview } from "./values.js";

export const HostCallSchema = S.Struct({
  evaluationId: S.String,
  callId: S.String,
  effect: S.String,
  name: S.String,
  args: S.Array(Projection),
});
export const RunOutcome = S.Struct({
  token: S.Number,
  basis: S.Number,
  sessionId: S.String,
  status: S.Literals(["pending", "completed", "failed"]),
  call: S.NullOr(HostCallSchema),
  values: S.Record(S.String, Observed),
  diagnostics: S.Array(SourceDiagnostic),
  printed: S.NullOr(S.String),
  description: S.String,
  purity: S.Literals(["read", "write"]),
});
export type RunOutcome = typeof RunOutcome.Type;

/** HostCall currently has no author span; only a unique authored reference can be located reliably. */
export const callSpan = (analysis: Analysis, pending: HostCall) => {
  const references = Object.entries(analysis.symbols).filter(
    ([, fact]) => fact.kind === "capability" && fact.name === pending.name,
  );
  const node =
    references.length === 1
      ? analysis.document.identity.nodes.find((node) => node.id === references[0]![0])
      : undefined;
  return node === undefined ? { start: 0, end: analysis.document.source.length } : node.span;
};

const outcome = (state: EvaluationState, sessionId: string, basis: Analysis, token: number) =>
  Effect.gen(function* () {
    const { config } = yield* FormaHost;
    const pending = state.status === "host-call" ? state.call : null;
    const capability =
      pending === null
        ? undefined
        : (config.capabilities ?? []).find(
            (item) => item.name === pending.name && item.name === pending.effect,
          );
    const diagnostics = evaluationDiagnostics(state).map((diagnostic) => ({
      sourceId: diagnostic.span?.sourceId,
      start: diagnostic.span?.startOffset ?? 0,
      end: diagnostic.span?.endOffset ?? basis.document.source.length,
      severity:
        diagnostic.severity === "warning" || diagnostic.severity === "info"
          ? diagnostic.severity
          : ("error" as const),
      message: diagnostic.message,
      code: diagnostic.code,
      phase: diagnostic.phase,
    }));
    return {
      token,
      basis: basis.revision,
      sessionId,
      status:
        pending !== null
          ? ("pending" as const)
          : state.status === "completed"
            ? ("completed" as const)
            : ("failed" as const),
      call: pending,
      values: observationsOf(state),
      diagnostics,
      printed:
        state.status === "completed" ? (state.result.printed ?? preview(state.result.value)) : null,
      description: capability?.description ?? "No capability implementation is configured.",
      purity: capability?.purity ?? "write",
    } satisfies RunOutcome;
  });

export const startRun = (basis: Analysis, token: number) =>
  Effect.gen(function* () {
    const service = yield* FormaHost;
    const { host, config, prelude } = service;
    const { sessionId } = yield* openValueSession(service);
    return yield* Effect.gen(function* () {
      yield* call(() => configureSession(host, sessionId, config));
      const forms = descriptorForms(
        basis.document.identity,
        basis.document.source,
        (head) => prelude?.descriptions.get(head)?.phase === "domain",
      );
      const state = yield* call(() =>
        host.evaluateInSession({
          sessionId,
          sourceId: config.sourceId,
          source: blank(basis.document.source, forms),
          observe: { identity: basis.document.identity },
          retainValues: "all",
        }),
      );
      return yield* outcome(state, sessionId, basis, token);
    }).pipe(Effect.onError(() => closeValueSession(service, sessionId).pipe(Effect.ignore)));
  });

export const resumeRun = (run: RunOutcome, basis: Analysis, allow: boolean) =>
  Effect.gen(function* () {
    const { host, config } = yield* FormaHost;
    const pending = run.call;
    if (pending === null) return yield* Effect.fail("The run is not awaiting approval.");
    const capability = (config.capabilities ?? []).find(
      (item) => item.name === pending.name && item.name === pending.effect,
    );
    const failure = (message: string): Diagnostic => ({
      code: "capability/denied",
      message,
      severity: "error",
      phase: "evaluate",
      span: {
        sourceId: config.sourceId,
        startOffset: callSpan(basis, pending).start,
        endOffset: callSpan(basis, pending).end,
      },
    });
    const result =
      !allow || capability === undefined
        ? {
            ok: false as const,
            diagnostics: [
              failure(allow ? `No implementation for ${pending.name}` : `Denied ${pending.name}`),
            ],
          }
        : yield* capability.perform(pending.args).pipe(
            Effect.map((value) => ({ ok: true as const, value })),
            Effect.catch((reason) =>
              Effect.succeed({ ok: false as const, diagnostics: [failure(reason)] }),
            ),
          );
    const state = yield* call(() =>
      host.resumeHostCall({
        sessionId: run.sessionId,
        evaluationId: pending.evaluationId,
        callId: pending.callId,
        result,
      }),
    );
    return yield* outcome(state, run.sessionId, basis, run.token);
  });
