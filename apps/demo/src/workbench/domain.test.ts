import { describe, expect, it } from "vitest";
import { applyProposal, consequences, eligible, initialSnapshot, requirements } from "./domain";

const bob = initialSnapshot.workers.find((worker) => worker.id === "worker:bob")!;
const proposal = { workerId: bob.id, before: "NY" as const, after: "CA" as const, basis: 0 };
const receipt = { id: "tx:test", timestamp: "2026-09-05T10:00:00.000Z" };

describe("worker reference adapter", () => {
  it("previews task changes without repairing unrelated eligibility evidence", () => {
    expect(consequences(bob, "CA")).toEqual({ added: ["CA Wage Notice", "CA Sick Leave Policy"], removed: ["NY Wage Notice"], taskCount: 3 });
    expect(eligible({ ...bob, state: "CA" })).toBe(false);
    expect(requirements(bob)).toEqual(["Complete I-9", "NY Wage Notice"]);
  });

  it("records an attributed transaction and updates only the intended worker", () => {
    const next = applyProposal(initialSnapshot, proposal, receipt);
    expect(next.revision).toBe(1);
    expect(next.workers.find((worker) => worker.id === bob.id)?.state).toBe("CA");
    expect(initialSnapshot.workers.find((worker) => worker.id === bob.id)?.state).toBe("NY");
    expect(next.workers.filter((worker) => worker.id !== bob.id)).toEqual(initialSnapshot.workers.filter((worker) => worker.id !== bob.id));
    expect(next.transactions[0]).toMatchObject({ ...receipt, actor: "You · Demo operator", basis: 0, before: "NY", after: "CA" });
  });

  it("rejects a stale or duplicate application and a no-op", () => {
    const next = applyProposal(initialSnapshot, proposal, receipt);
    expect(() => applyProposal(next, proposal, receipt)).toThrow("data changed");
    expect(() => applyProposal(initialSnapshot, { ...proposal, before: "TX" }, receipt)).toThrow("data changed");
    expect(() => applyProposal(initialSnapshot, { ...proposal, after: "NY" }, receipt)).toThrow("different state");
  });
});
