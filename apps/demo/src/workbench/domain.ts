import { Schema as S } from "effect";

// A deterministic reference adapter. These are illustrative product rules,
// not a compliance ruleset or a connection to a Triplex database.
export const RULE_VERSION = "Workforce demo · v1";
export const STORAGE_KEY = "foldworks-workers-v1";
export const State = S.Literals(["NY", "CA", "TX"]);
export type State = typeof State.Type;
export const Worker = S.Struct({
  id: S.String,
  name: S.String,
  employer: S.String,
  state: State,
  active: S.Boolean,
  i9Complete: S.Boolean,
  blockingViolations: S.Number,
});
export type Worker = typeof Worker.Type;
export const Transaction = S.Struct({
  id: S.String,
  workerId: S.String,
  actor: S.String,
  timestamp: S.String,
  ruleVersion: S.String,
  basis: S.Number,
  before: State,
  after: State,
  added: S.Array(S.String),
  removed: S.Array(S.String),
});
export type Transaction = typeof Transaction.Type;
export const Snapshot = S.Struct({
  version: S.Literal(1),
  revision: S.Number,
  workers: S.Array(Worker),
  transactions: S.Array(Transaction),
});
export type Snapshot = typeof Snapshot.Type;
export const initialSnapshot: Snapshot = {
  version: 1,
  revision: 0,
  workers: [
    { id: "worker:alice", name: "Alice Chen", employer: "Acme", state: "CA", active: true, i9Complete: true, blockingViolations: 0 },
    { id: "worker:bob", name: "Bob Williams", employer: "Acme", state: "NY", active: true, i9Complete: false, blockingViolations: 0 },
    { id: "worker:maria", name: "Maria Garcia", employer: "Globex", state: "TX", active: true, i9Complete: true, blockingViolations: 0 },
    { id: "worker:james", name: "James Okafor", employer: "Acme", state: "TX", active: true, i9Complete: true, blockingViolations: 0 },
    { id: "worker:priya", name: "Priya Shah", employer: "Globex", state: "NY", active: true, i9Complete: true, blockingViolations: 0 },
    { id: "worker:leo", name: "Leo Martinez", employer: "Acme", state: "CA", active: false, i9Complete: true, blockingViolations: 0 },
  ],
  transactions: [],
};

export const eligible = (worker: Worker): boolean =>
  worker.active && worker.i9Complete && worker.blockingViolations === 0;

export const requirements = (worker: Worker): ReadonlyArray<string> => [
  ...(!worker.i9Complete ? ["Complete I-9"] : []),
  ...(worker.state === "NY" ? ["NY Wage Notice"] : []),
  ...(worker.state === "CA" ? ["CA Wage Notice", "CA Sick Leave Policy"] : []),
];

export const Proposal = S.Struct({ workerId: S.String, basis: S.Number, before: State, after: State });
export type Proposal = typeof Proposal.Type;

export const consequences = (worker: Worker, after: State) => {
  const beforeRequirements = requirements(worker);
  const afterRequirements = requirements({ ...worker, state: after });
  return {
    added: afterRequirements.filter((item) => !beforeRequirements.includes(item)),
    removed: beforeRequirements.filter((item) => !afterRequirements.includes(item)),
    taskCount: afterRequirements.length,
  };
};

export const applyProposal = (
  snapshot: Snapshot,
  proposal: Proposal,
  receipt: Readonly<{ id: string; timestamp: string }>,
): Snapshot => {
  const worker = snapshot.workers.find((item) => item.id === proposal.workerId);
  if (snapshot.revision !== proposal.basis || worker?.state !== proposal.before) {
    throw new Error("The data changed since this preview. Discard and reload before trying again.");
  }
  if (proposal.before === proposal.after) throw new Error("Choose a different state to preview a change.");
  const diff = consequences(worker, proposal.after);
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    workers: snapshot.workers.map((item) => item.id === worker.id ? { ...item, state: proposal.after } : item),
    transactions: [{
      ...receipt,
      workerId: worker.id,
      actor: "You · Demo operator",
      ruleVersion: RULE_VERSION,
      basis: snapshot.revision,
      before: proposal.before,
      after: proposal.after,
      added: diff.added,
      removed: diff.removed,
    }, ...snapshot.transactions],
  };
};

const decodeSnapshot = (json: string): Snapshot => S.decodeUnknownSync(Snapshot)(JSON.parse(json));

export const readSnapshot = (): Readonly<{ snapshot: Snapshot; error: string }> => {
  try {
    const json = window.localStorage.getItem(STORAGE_KEY);
    return { snapshot: json === null ? initialSnapshot : decodeSnapshot(json), error: "" };
  } catch {
    return { snapshot: initialSnapshot, error: "Saved worker data could not be read. Changes are disabled to protect your saved data." };
  }
};

export const commitProposal = async (proposal: Proposal): Promise<Snapshot> =>
  navigator.locks.request(STORAGE_KEY, () => {
    const { snapshot, error } = readSnapshot();
    if (error) throw new Error(error);
    const next = applyProposal(snapshot, proposal, {
      id: `tx:${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
    });
    // Store rows and their receipt together, before reporting success to the UI.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
