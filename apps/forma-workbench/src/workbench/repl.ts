import { Effect } from "effect";
import { identifySyntax, indexSyntax } from "@formalang/ts/syntax";
import { blank, descriptorForms, type Analysis } from "./analysis.js";
import { FormaHost, call, configureSession, openValueSession, closeValueSession } from "./host.js";
import { preview } from "./values.js";

const definitions = new Set([
  "define",
  "macro",
  "type",
  "typeclass",
  "class",
  "instance",
  "form",
  ":",
  "import",
  "export",
  "export-from",
]);

/** Later scratch declarations replace earlier bindings, as in an interactive REPL. */
export const mergeReplSource = (...sources: readonly string[]): string => {
  const declarations: { text: string; key: string | undefined }[] = [];
  for (const source of sources) {
    const identity = identifySyntax(source);
    if (identity.errors.length) return sources.join("\n");
    const syntax = indexSyntax(identity);
    for (const node of syntax.children(null)) {
      const [head, name] = syntax.children(node.id);
      const kind = head ? source.slice(head.span.start, head.span.end) : "";
      const named =
        name?.kind === "Symbol"
          ? name
          : name?.kind === "List"
            ? syntax.children(name.id)[0]
            : undefined;
      const key =
        node.kind === "List" &&
        named?.kind === "Symbol" &&
        definitions.has(kind) &&
        !["import", "export", "export-from", "instance"].includes(kind)
          ? `${kind}:${source.slice(named.span.start, named.span.end)}`
          : undefined;
      if (key) {
        const index = declarations.findIndex((entry) => entry.key === key);
        if (index !== -1) declarations.splice(index, 1);
      }
      declarations.push({ text: source.slice(node.span.start, node.span.end), key });
    }
  }
  return declarations.map((entry) => entry.text).join("\n");
};

/** Keep declarations, skipping application expressions and capability-dependent definitions. */
export const replDefinitions = (source: string, analysis?: Analysis | null): string => {
  const identity =
    analysis?.document.source === source ? analysis.document.identity : identifySyntax(source);
  const syntax = indexSyntax(identity);
  return syntax
    .children(null)
    .flatMap((node) => {
      const head = syntax.children(node.id)[0];
      if (
        node.kind !== "List" ||
        head?.kind !== "Symbol" ||
        !definitions.has(source.slice(head.span.start, head.span.end)) ||
        (analysis?.requirements[node.id]?.length ?? 0) > 0
      )
        return [];
      return [source.slice(node.span.start, node.span.end)];
    })
    .join("\n");
};

/** Replay pure declarations against a fresh snapshot, so edits never leave hidden stale bindings. */
export const evaluateRepl = (context: string, declarations: string, input: string) =>
  Effect.gen(function* () {
    const service = yield* FormaHost;
    const { host, config, prelude } = service;
    const { sessionId } = yield* openValueSession(service);
    return yield* Effect.gen(function* () {
      yield* call(() => configureSession(host, sessionId, config));
      const source = mergeReplSource(context, declarations, input);
      const forms = descriptorForms(
        identifySyntax(source),
        source,
        (head) => prelude?.descriptions.get(head)?.phase === "domain",
      );
      const executable = blank(source, forms);
      const checked = yield* call(() =>
        host.typecheck({ sessionId, sourceId: config.sourceId, source: executable }),
      );
      if (checked.diagnostics.some((diagnostic) => diagnostic.severity === "error"))
        return {
          ok: false,
          output: checked.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
          declarations: "",
        };
      let state = yield* call(() =>
        host.evaluateInSession({
          sessionId,
          sourceId: config.sourceId,
          source: executable,
        }),
      );
      if (state.status === "host-call") {
        const pending = state.call;
        state = yield* call(() =>
          host.resumeHostCall({
            sessionId,
            evaluationId: pending.evaluationId,
            callId: pending.callId,
            result: {
              ok: false,
              diagnostics: [
                {
                  code: "repl/capability",
                  severity: "error",
                  message: `${pending.name} requires approval. Use Run in the authoring pane.`,
                  phase: "evaluate",
                },
              ],
            },
          }),
        );
      }
      return state.status === "completed"
        ? {
            ok: true,
            type: checked.display,
            output: state.result.printed ?? preview(state.result.value),
            declarations: mergeReplSource(declarations, replDefinitions(input)),
          }
        : {
            ok: false,
            output:
              state.status === "failed"
                ? state.diagnostics.map((diagnostic) => diagnostic.message).join("\n")
                : "Evaluation did not complete.",
            declarations: "",
          };
    }).pipe(Effect.ensuring(closeValueSession(service, sessionId).pipe(Effect.ignore)));
  });
