import { Effect } from "effect";
import { FormaHost, call, required } from "./host.js";
import type { Document } from "./document.js";

/** Read edited source against the current identity; malformed source leaves rows untouched. */
export const readSource = (source: string, base: Document) =>
  Effect.gen(function* () {
    const { host, config } = yield* FormaHost;
    const identify = yield* required(host, "identifySyntax");
    const read = yield* required(host, "sourceToOutline");
    const identified = yield* call(() =>
      identify({
        sourceId: config.sourceId,
        source,
        previous: { source: base.source, identity: base.identity },
      }),
    );
    const document: Document = {
      revision: base.revision,
      source,
      identity: identified.identity as Document["identity"],
    };
    const rows = yield* call(() =>
      read({ sourceId: config.sourceId, source, identity: identified.identity }),
    );
    return {
      document,
      rows: rows.items,
      errors: identified.identity.errors.map((error) => ({
        from: Math.min(source.length, error.span.start),
        to: Math.min(source.length, Math.max(error.span.end, error.span.start + 1)),
        severity: "error" as const,
        message: error.message,
        code: "parse/syntax",
      })),
    };
  });
