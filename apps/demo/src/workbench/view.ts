import { Option } from "effect";
import { DataGrid } from "@foldworks/data-grid";
import { Alert, Badge, Button, ChangeSetPreview, ExplanationTree, Icon, Select, TransactionTimeline, ValueInspector, sxAttrs } from "@foldworks/ui";
import { ArrowRight, CircleHelp, History, Table2, Users } from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { consequences, eligible, requirements, RULE_VERSION, type Worker } from "./domain";
import { Message } from "./message";
import type { Model } from "./model";
import { styles as s } from "./styles";

const text = (value: string, h: HtmlBuilder<Message>): Html => h.p(sxAttrs(h, s.subtitle), [value]);
const action = (label: string, onClick: Message, h: HtmlBuilder<Message>, disabled = false): Html =>
  Button.view({ label, onClick, size: "sm", variant: "outline", isDisabled: disabled }, h);

const columns = (model: Model) => DataGrid.defineColumns<Worker, Message>()([
  { id: "name", header: "Worker", width: 205, accessor: (worker) => worker.name,
    renderCell: ({ row }, h) => h.button([
      ...sxAttrs(h, s.link, model.selectedId === row.id && s.selected), h.Type("button"),
      h.Disabled(model.applying || Option.isSome(model.proposal)),
      h.AriaLabel(`Inspect ${row.name}`),
      h.OnClick(Message.SelectedWorker({ id: row.id, panel: "Overview" })),
    ], [row.name]),
  },
  { id: "employer", header: "Employer", width: 100, accessor: (worker) => worker.employer },
  { id: "state", header: "State", width: 84, accessor: (worker) => worker.state,
    renderCell: ({ row }, h) => h.button([
      ...sxAttrs(h, s.link), h.Type("button"), h.AriaLabel(`Edit ${row.name} state, ${row.state}`),
      h.Disabled(model.applying || Option.isSome(model.proposal) || !!model.storageError),
      h.OnClick(Message.SelectedWorker({ id: row.id, panel: "Edit" })),
    ], [row.state]),
  },
  { id: "i9", header: "I-9", width: 105, accessor: (worker) => worker.i9Complete,
    renderCell: ({ row }, h) => Badge.view({ label: row.i9Complete ? "Complete" : "Missing", tone: row.i9Complete ? "neutral" : "warning" }, h),
  },
  { id: "eligible", header: "ƒ Eligible", width: 125, accessor: eligible,
    renderCell: ({ row }, h) => h.button([
      ...sxAttrs(h, s.link), h.Type("button"), h.AriaLabel(`Explain ${row.name} eligibility`),
      h.Disabled(model.applying || Option.isSome(model.proposal)),
      h.OnClick(Message.SelectedWorker({ id: row.id, panel: "Explain" })),
    ], [Badge.view({ label: eligible(row) ? "✓ Eligible" : "× Ineligible", tone: eligible(row) ? "success" : "danger" }, h)]),
  },
  { id: "tasks", header: "ƒ Open tasks", width: 100, accessor: (worker) => requirements(worker).length, align: "End" },
]);

const overview = (model: Model, worker: Worker, h: HtmlBuilder<Message>): Html => h.div(sxAttrs(h, s.stack), [
  h.dl([], [
    ...[["Employer", worker.employer], ["State", worker.state], ["Employment", worker.active ? "Active" : "Inactive"], ["I-9", worker.i9Complete ? "Complete" : "Missing"]].map(([label, value]) =>
      h.div(sxAttrs(h, s.property), [h.dt(sxAttrs(h, s.label), [label!]), h.dd([], [value!])])),
  ]),
  ValueInspector.view({
    label: "Eligibility", value: eligible(worker) ? "Eligible" : "Ineligible", origin: "Derived", freshness: "Current",
    context: `Evaluated from saved revision ${model.snapshot.revision}.`,
    children: [Button.view({ label: "Why this result?", icon: CircleHelp, variant: "outline", onClick: Message.OpenedPanel({ panel: "Explain" }) }, h)],
  }, h),
  h.div(sxAttrs(h, s.stack), [
    h.h3(sxAttrs(h, s.cardTitle), [`Open tasks · ${requirements(worker).length}`]),
    ...requirements(worker).map((item) => text(item, h)),
    ...(requirements(worker).length ? [] : [text("No open tasks.", h)]),
  ]),
  Button.view({ label: "Propose state change", trailingIcon: ArrowRight, onClick: Message.OpenedPanel({ panel: "Edit" }), isDisabled: !!model.storageError }, h),
]);

const explain = (model: Model, worker: Worker, h: HtmlBuilder<Message>): Html => h.div(sxAttrs(h, s.stack), [
  ValueInspector.view({ label: "Eligibility", value: eligible(worker) ? "Eligible" : "Ineligible", origin: "Derived", freshness: "Current", context: `Saved revision ${model.snapshot.revision} · ${RULE_VERSION}` }, h),
  ExplanationTree.view({ label: "Eligibility explanation", nodes: [
    { label: "Employment is active", outcome: worker.active ? "passed" : "failed", detail: `Current value: ${worker.active ? "active" : "inactive"}` },
    { label: "I-9 is complete", outcome: worker.i9Complete ? "passed" : "failed", detail: `Current value: ${worker.i9Complete ? "complete" : "missing"}` },
    { label: "No blocking violations", outcome: worker.blockingViolations === 0 ? "passed" : "failed", detail: `${worker.blockingViolations} blocking violations in this snapshot` },
  ] }, h),
  h.pre(sxAttrs(h, s.rule), ["eligible(worker) :=\n  employment = active\n  and i9 = complete\n  and blockingViolations = 0"]),
  h.details([], [
    h.summary(sxAttrs(h, s.link), ["Evidence · 3 evaluated inputs"]),
    h.ul(sxAttrs(h, s.evidence), [
      h.li([], [`${worker.id} / active = ${worker.active}`]),
      h.li([], [`${worker.id} / i9Complete = ${worker.i9Complete}`]),
      h.li([], [`${worker.id} / blockingViolations = ${worker.blockingViolations}`]),
    ]),
  ]),
  Button.view({ label: "Propose state change", trailingIcon: ArrowRight, onClick: Message.OpenedPanel({ panel: "Edit" }), isDisabled: !!model.storageError }, h),
]);

const edit = (model: Model, worker: Worker, h: HtmlBuilder<Message>): Html => h.div(sxAttrs(h, s.stack), [
  h.h3(sxAttrs(h, s.cardTitle), ["Propose a state change"]),
  text("Explore the consequences before changing this record.", h),
  h.div(sxAttrs(h, s.property), [h.span(sxAttrs(h, s.label), ["Saved state"]), h.strong([], [worker.state])]),
  Select.control({
    value: Option.getOrUndefined(model.proposal)?.after ?? worker.state,
    options: [{ value: "NY", label: "New York (NY)" }, { value: "CA", label: "California (CA)" }, { value: "TX", label: "Texas (TX)" }],
    ariaLabel: "Proposed state", onChange: (value) => Message.ChangedState({ value }), isDisabled: !!model.storageError,
  }, h),
  h.div(sxAttrs(h, s.hint), ["This is a draft. The table continues to show saved values until you apply the change."]),
  h.div(sxAttrs(h, s.row), [
    Button.view({ label: "Preview consequences", onClick: Message.Previewed(), isDisabled: Option.isNone(model.proposal) || !!model.storageError }, h),
    action("Cancel", Message.Discarded(), h),
  ]),
]);

const preview = (model: Model, worker: Worker, h: HtmlBuilder<Message>): Html => {
  const proposal = Option.getOrUndefined(model.proposal);
  if (!proposal) return h.empty;
  const diff = consequences(worker, proposal.after);
  return ChangeSetPreview.view({
    label: "Proposed change",
    basis: `Preview against saved revision ${proposal.basis} · ${RULE_VERSION}`,
    changes: [{ label: "State", before: proposal.before, after: proposal.after }],
    consequences: [
      ...diff.added.map((label) => ({ kind: "added" as const, label, detail: "An open task will be created." })),
      ...diff.removed.map((label) => ({ kind: "removed" as const, label, detail: "This open task will no longer be required." })),
      { kind: "changed", label: `Open tasks: ${requirements(worker).length} → ${diff.taskCount}` },
    ],
    notices: [
      `${diff.added.length} ${diff.added.length === 1 ? "task" : "tasks"} would be created · ${diff.removed.length} ${diff.removed.length === 1 ? "task" : "tasks"} would be removed.`,
      eligible(worker) ? "Eligibility remains eligible." : `Eligibility remains ineligible. ${!worker.i9Complete ? "The missing I-9 still needs attention." : "The eligibility conditions still need attention."}`,
      "Nothing has been applied. Apply saves the state change and its history together.",
    ],
    actions: [
      Button.view({ label: model.applying ? "Applying…" : "Apply change", onClick: Message.Applied(), isDisabled: model.applying || !!model.error }, h),
      action("Discard change", Message.Discarded(), h, model.applying),
    ],
  }, h);
};

const history = (model: Model, worker: Worker, h: HtmlBuilder<Message>): Html => TransactionTimeline.view({
  label: "Change history",
  entries: model.snapshot.transactions.filter((tx) => tx.workerId === worker.id).map((tx) => ({
    id: tx.id, title: "State change applied", actor: tx.actor,
    timestamp: new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(tx.timestamp)) + " UTC",
    context: `${tx.ruleVersion} · Revision ${tx.basis} → ${tx.basis + 1} · ${tx.added.length} tasks created, ${tx.removed.length} removed.`,
    changes: [{ label: "State", before: tx.before, after: tx.after },
      ...tx.added.map((label) => ({ label, before: "Not required", after: "Open task" })),
      ...tx.removed.map((label) => ({ label, before: "Open task", after: "No longer required" })),
    ],
  })),
}, h);

const inspector = (model: Model, h: HtmlBuilder<Message>): Html => {
  const worker = model.snapshot.workers.find((item) => item.id === model.selectedId);
  if (!worker) return h.div(sxAttrs(h, s.empty), [
    Badge.view({ label: "Object inspector" }, h),
    h.h2(sxAttrs(h, s.recordTitle), ["Every value has a story."]),
    text("Select a worker to inspect their record, understand a derived value, or explore a change.", h),
    Button.view({ label: "Inspect Bob Williams", icon: Users, variant: "outline", onClick: Message.SelectedWorker({ id: "worker:bob", panel: "Overview" }) }, h),
  ]);
  return h.div(sxAttrs(h, s.inspector), [
    h.div(sxAttrs(h, s.record), [
      h.span([...sxAttrs(h, s.avatar), h.AriaHidden(true)], [worker.name.split(" ").map((part) => part[0]).join("")]),
      h.div([], [h.h2([...sxAttrs(h, s.recordTitle), h.Id("worker-inspector-heading"), h.Tabindex(-1)], [worker.name]), text(`${worker.employer} · Worker`, h)]),
    ]),
    h.div([...sxAttrs(h, s.tabs), h.Role("group"), h.AriaLabel("Inspector views")], [
      ...(["Overview", "Explain", "History"] as const).map((panel) => Button.view({
        label: panel, ...(panel === "History" ? { icon: History } : panel === "Explain" ? { icon: CircleHelp } : {}),
        size: "sm", variant: model.panel === panel ? "secondary" : "ghost",
        attributes: [h.AriaPressed(String(model.panel === panel))],
        onClick: Message.OpenedPanel({ panel }), isDisabled: model.applying || Option.isSome(model.proposal),
      }, h)),
    ]),
    ...(model.error ? [Alert.view({ title: "Change not applied", description: model.error, tone: "danger" }, h)] : []),
    model.panel === "Explain" ? explain(model, worker, h)
      : model.panel === "Edit" ? edit(model, worker, h)
      : model.panel === "Preview" ? preview(model, worker, h)
      : model.panel === "History" ? history(model, worker, h)
      : overview(model, worker, h),
  ]);
};

export const view = defineView<Model, Message>((model, h) => {
  const eligibleCount = model.snapshot.workers.filter(eligible).length;
  return h.div([...sxAttrs(h, s.root), h.DataAttribute("workbench", "workers")], [
    h.div(sxAttrs(h, s.heading), [
      h.div([], [h.p(sxAttrs(h, s.eyebrow), ["Workforce / Operations"]), h.h1(sxAttrs(h, s.title), ["Workers"]), text("Understand your people. Explore a change. Know what happens next.", h)]),
      Badge.view({ label: Option.isSome(model.proposal) ? "Preview workspace" : "Saved view", tone: Option.isSome(model.proposal) ? "warning" : "neutral", dot: true }, h),
    ]),
    ...(model.storageError ? [Alert.view({ title: "Storage unavailable", description: model.storageError, tone: "danger" }, h)] : []),
    h.div(sxAttrs(h, s.stats), [
      ...[[String(model.snapshot.workers.length), "Total workers"], [String(eligibleCount), "Eligible to work"], [String(model.snapshot.workers.length - eligibleCount), "Need attention"]].map(([number, label]) => h.div(sxAttrs(h, s.stat), [h.p(sxAttrs(h, s.number), [number!]), h.p(sxAttrs(h, s.label), [label!])])),
    ]),
    h.div(sxAttrs(h, s.workspace), [
      h.section([...sxAttrs(h, s.card), h.AriaLabel("Worker directory")], [
        h.div(sxAttrs(h, s.cardHeader), [
          h.div(sxAttrs(h, s.row), [Icon.view({ icon: Table2, size: 16 }, h), h.h2(sxAttrs(h, s.cardTitle), ["All workers"]), Badge.view({ label: `${model.snapshot.workers.length} records` }, h)]),
          h.span(sxAttrs(h, s.label), [`Saved revision ${model.snapshot.revision}`]),
        ]),
        DataGrid.view({ model: model.grid, columns: columns(model), rows: model.snapshot.workers, getRowId: (worker) => worker.id,
          toParentMessage: (message) => Message.GotGridMessage({ message }), label: "Workers", appearance: "embedded", rowHeight: 56,
        }, h),
        h.footer(sxAttrs(h, s.footer), ["Select a name to inspect · Select a state to edit · ƒ marks a derived value"]),
      ]),
      h.aside([...sxAttrs(h, s.card), h.AriaLabel("Worker inspector")], [inspector(model, h)]),
    ]),
    h.p(sxAttrs(h, s.subtitle), ["Reference workspace · Illustrative workforce rules · Changes saved in this browser"]),
    h.div([h.Role("status"), h.AriaLive("polite"), ...sxAttrs(h, s.srOnly)], [model.announcement]),
  ]);
});
