// What a workbench is configured with. The workbench knows no domain: the
// forms a program may use, the capabilities it may call, and the checks over
// its declarations all come from here.

import type { Proposer } from "./proposer.js";
import type { Effect } from "effect";
import type {
  Diagnostic,
  HostBuiltinDescriptor,
  SourceDocument,
  ValueProjection,
} from "@formalang/host/types";
import type { ElaboratedDeclaration } from "@formalang/ts/descriptor";

/**
 * Something a program can ask the host to do, such as look up a person or
 * post a message. Calls pause evaluation until the host answers, so the
 * workbench decides whether a call happens.
 */
export interface Capability {
  /** The name a program calls, such as `Directory.lookup`. Also the host effect's name. */
  readonly name: string;
  readonly arity: HostBuiltinDescriptor["arity"];
  /** How the type checker sees calls to it. */
  readonly typeScheme?: HostBuiltinDescriptor["typeScheme"];
  /**
   * Both reads and writes require approval on every explicit run. Live
   * analysis and REPL replay do not perform capabilities.
   */
  readonly purity: "read" | "write";
  /** One sentence shown at the permission checkpoint. */
  readonly description: string;
  /** Performs the call. A failure's message becomes the call's diagnostic. */
  readonly perform: (
    args: ReadonlyArray<ValueProjection>,
  ) => Effect.Effect<ValueProjection, string>;
}

/** A check over elaborated declarations that needs more than one of them. */
export type DeclarationCheck = (
  declarations: ReadonlyArray<ElaboratedDeclaration>,
  source: string,
) => ReadonlyArray<Diagnostic>;

export interface WorkbenchConfig {
  /** Defaults to the deterministic local proposer. Models must be explicitly supplied. */
  readonly proposer?: Proposer;
  /** Names the program, in diagnostics and the title bar. */
  readonly sourceId: string;
  /**
   * Domain preludes: `form` descriptors and their meta hooks. They
   * are bootstrapped on Forma's compiler prelude for elaboration and loaded
   * into the session for slots and the symbol index.
   */
  readonly preludes?: ReadonlyArray<SourceDocument>;
  /** Project file snapshot. Files are modules, loaded without executing their expressions. */
  readonly sources?: ReadonlyArray<SourceDocument>;
  readonly capabilities?: ReadonlyArray<Capability>;
  readonly checks?: ReadonlyArray<DeclarationCheck>;
  /** Evaluation step limit. Defaults to 200,000. */
  readonly stepLimit?: number;
}

export const hostBuiltinOf = (capability: Capability): HostBuiltinDescriptor => ({
  name: capability.name,
  arity: capability.arity,
  ...(capability.typeScheme === undefined ? {} : { typeScheme: capability.typeScheme }),
  handler: { kind: "host-effect", effect: capability.name },
  purity: capability.purity,
});
