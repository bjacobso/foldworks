export * as Workbench from "./workbench.js";
export * as Workspace from "./workspace.js";
export { FormaHost, type FormaHostService } from "./host.js";
export type { Capability, DeclarationCheck, WorkbenchConfig } from "./config.js";

export {
  localProposer,
  modelProposer,
  Answer,
  type Proposer,
  type ProposalContext,
} from "./proposer.js";
export { Script, type Proposal, type Refactoring } from "./edits.js";
export { sourceTokens, sourceDiagnostics, hoverFact, completeAt, viewOf } from "./adapter.js";
