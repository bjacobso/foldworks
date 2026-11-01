// The language host as a Foldkit resource. An application provides
// `FormaHost.layer(host, config)` through the runtime's `resources`, which
// builds it once and shares it with every command, so the host never enters
// the model. The layer opens the workbench's session and loads its preludes.

import { Context, Effect, Layer } from "effect";
import type { Diagnostic, LanguageHost } from "@formalang/host/types";
import { bootstrapFromSources, type BootstrappedPrelude } from "@formalang/ts/descriptor";
import { preludeSource } from "@formalang/ts/preludes";

import { hostBuiltinOf, type WorkbenchConfig } from "./config.js";

export interface FormaHostService {
  readonly host: LanguageHost;
  /** Session ownership stays in the resource and ends with the runtime scope. */
  readonly sessions: Set<string>;
  /** The workbench's session, with the preludes loaded and the capabilities configured. */
  readonly sessionId: string;
  readonly config: WorkbenchConfig;
  /** Descriptors and elaboration hooks, when the configuration has preludes. */
  readonly prelude: BootstrappedPrelude | undefined;
  readonly sourceDiagnostics?: readonly Diagnostic[];
}

export class FormaHost extends Context.Service<FormaHost, FormaHostService>()(
  "@formalang/workbench/FormaHost",
) {
  /** Opens a session on `host` for a workbench configured with `config`. */
  static layer(host: LanguageHost, config: WorkbenchConfig): Layer.Layer<FormaHost> {
    return Layer.effect(
      FormaHost,
      Effect.gen(function* () {
        const sessions = new Set<string>();
        yield* Effect.addFinalizer(() =>
          Effect.forEach([...sessions], (sessionId) =>
            call(() => host.closeSession({ sessionId })).pipe(Effect.ignore),
          ),
        );
        const { sessionId } = yield* Effect.promise(() =>
          host.openSession({ defaultStepLimit: config.stepLimit ?? 200_000 }),
        );
        sessions.add(sessionId);
        const sourceDiagnostics = yield* Effect.promise(() =>
          configureSession(host, sessionId, config),
        );
        const [domain, ...additional] = (config.preludes ?? []).map((document) => document.source);
        const prelude =
          domain === undefined
            ? undefined
            : bootstrapFromSources(preludeSource("compiler.lisp"), domain, ...additional);
        return FormaHost.of({ host, sessionId, config, prelude, sessions, sourceDiagnostics });
      }),
    );
  }
}

/** Loads the preludes and configures the capabilities, as after `resetSession`. */
export const configureSession = async (
  host: LanguageHost,
  sessionId: string,
  config: WorkbenchConfig,
): Promise<readonly Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];
  const preludes = config.preludes ?? [];
  if (preludes.length > 0) {
    const loaded = await host.loadSourceBundle({
      sessionId,
      sources: preludes.map((document) => ({ ...document, kind: "prelude" as const })),
    });
    diagnostics.push(...loaded.diagnostics);
  }
  await host.configureSession({
    sessionId,
    hostBuiltins: (config.capabilities ?? []).map(hostBuiltinOf),
  });
  if ((config.sources?.length ?? 0) > 0) {
    const loaded = await host.loadSourceBundle({
      sessionId,
      sources: config.sources!.map((source) => ({ ...source, kind: "source" as const })),
    });
    diagnostics.push(...loaded.diagnostics);
  }
  return diagnostics;
};

/** A host service the workbench needs, or a failure naming the missing capability. */
export const required = <K extends keyof LanguageHost>(
  host: LanguageHost,
  name: K,
): Effect.Effect<NonNullable<LanguageHost[K]>, string> => {
  const service = host[name];
  return service === undefined
    ? Effect.fail(`The ${host.name} host does not implement ${String(name)}.`)
    : Effect.succeed(
        (service as (...args: never) => unknown).bind(host) as NonNullable<LanguageHost[K]>,
      );
};

/** A host request, failing with the error's message. */
export const call = <A>(run: () => Promise<A>): Effect.Effect<A, string> =>
  Effect.tryPromise({
    try: run,
    catch: (error) => (error instanceof Error ? error.message : String(error)),
  });

/** Fresh evaluation sessions share configuration, while keeping environments and values isolated. */
export const openValueSession = (service: FormaHostService) =>
  call(() =>
    service.host.openSession({ defaultStepLimit: service.config.stepLimit ?? 200_000 }),
  ).pipe(Effect.tap(({ sessionId }) => Effect.sync(() => service.sessions.add(sessionId))));
export const closeValueSession = (service: FormaHostService, sessionId: string) =>
  call(() => service.host.closeSession({ sessionId })).pipe(
    Effect.tap(() => Effect.sync(() => service.sessions.delete(sessionId))),
  );
