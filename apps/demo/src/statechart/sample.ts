import type { Library, MachineDocument, StateData, StateKind } from "./machine";

type StateSpec = Readonly<{
  id: string;
  name: string;
  kind: StateKind;
  parentId?: string;
  machineId?: string;
}>;

const state = ({ id, name, kind, parentId, machineId }: StateSpec) => ({
  id,
  ...(parentId === undefined ? {} : { parentId }),
  data: {
    name,
    kind,
    ...(machineId === undefined ? {} : { machineId }),
  } satisfies StateData,
});

const on = (id: string, source: string, target: string, event: string, guard?: string) => ({
  id,
  source: { nodeId: source },
  target: { nodeId: target },
  data: { event, ...(guard === undefined ? {} : { guard }) },
});

const checkout: MachineDocument = {
  nodes: [
    state({ id: "start", name: "Start", kind: "initial" }),
    state({ id: "cart", name: "Cart", kind: "atomic" }),
    state({ id: "details", name: "Details", kind: "compound" }),
    state({ id: "details-start", name: "Start", kind: "initial", parentId: "details" }),
    state({ id: "shipping", name: "Shipping", kind: "atomic", parentId: "details" }),
    state({ id: "billing", name: "Billing", kind: "atomic", parentId: "details" }),
    state({ id: "payment", name: "Payment", kind: "submachine", machineId: "payment" }),
    state({ id: "fulfilment", name: "Fulfilment", kind: "parallel" }),
    state({ id: "packing", name: "Packing", kind: "compound", parentId: "fulfilment" }),
    state({ id: "packing-start", name: "Start", kind: "initial", parentId: "packing" }),
    state({ id: "picking", name: "Picking", kind: "atomic", parentId: "packing" }),
    state({ id: "packed", name: "Packed", kind: "final", parentId: "packing" }),
    state({ id: "notifying", name: "Notifying", kind: "compound", parentId: "fulfilment" }),
    state({ id: "notifying-start", name: "Start", kind: "initial", parentId: "notifying" }),
    state({ id: "emailing", name: "Emailing", kind: "atomic", parentId: "notifying" }),
    state({ id: "notified", name: "Notified", kind: "final", parentId: "notifying" }),
    state({ id: "complete", name: "Complete", kind: "final" }),
    state({ id: "cancelled", name: "Cancelled", kind: "final" }),
  ],
  edges: [
    on("t-start", "start", "cart", ""),
    on("t-add", "cart", "cart", "ADD_ITEM"),
    on("t-checkout", "cart", "details", "CHECKOUT", "cart.items > 0"),
    on("t-cancel", "cart", "cancelled", "CANCEL"),
    on("t-details-start", "details-start", "shipping", ""),
    on("t-next", "shipping", "billing", "NEXT"),
    on("t-back", "billing", "shipping", "BACK"),
    on("t-edit-cart", "details", "cart", "EDIT_CART"),
    on("t-pay", "billing", "payment", "PAY"),
    on("t-paid", "payment", "fulfilment", "PAID"),
    on("t-failed", "payment", "billing", "FAILED"),
    on("t-packing-start", "packing-start", "picking", ""),
    on("t-packed", "picking", "packed", "PACKED"),
    on("t-notifying-start", "notifying-start", "emailing", ""),
    on("t-retry-email", "emailing", "emailing", "BOUNCED"),
    on("t-sent", "emailing", "notified", "SENT"),
    on("t-done", "fulfilment", "complete", "SHIPPED"),
  ],
  annotations: [
    {
      id: "note-payment",
      attachedTo: ["payment"],
      data: { text: "Payment is its own machine. Select it and choose Open to edit its states." },
    },
    {
      id: "note-details",
      parentId: "details",
      attachedTo: ["t-back"],
      data: { text: "BACK keeps billing input, so this cycle is lossless." },
    },
  ],
};

const payment: MachineDocument = {
  nodes: [
    state({ id: "start", name: "Start", kind: "initial" }),
    state({ id: "card", name: "Enter card", kind: "atomic" }),
    state({ id: "authorizing", name: "Authorizing", kind: "atomic" }),
    state({ id: "challenge", name: "3-D Secure", kind: "compound" }),
    state({ id: "challenge-start", name: "Start", kind: "initial", parentId: "challenge" }),
    state({ id: "prompting", name: "Prompting", kind: "atomic", parentId: "challenge" }),
    state({ id: "verifying", name: "Verifying", kind: "atomic", parentId: "challenge" }),
    state({ id: "approved", name: "Approved", kind: "final" }),
  ],
  edges: [
    on("t-start", "start", "card", ""),
    on("t-submit", "card", "authorizing", "SUBMIT"),
    on("t-poll", "authorizing", "authorizing", "POLL"),
    on("t-challenge", "authorizing", "challenge", "CHALLENGE"),
    on("t-challenge-start", "challenge-start", "prompting", ""),
    on("t-code", "prompting", "verifying", "CODE_ENTERED"),
    on("t-wrong", "verifying", "prompting", "INCORRECT"),
    on("t-verified", "challenge", "authorizing", "VERIFIED"),
    on("t-declined", "authorizing", "card", "DECLINED"),
    on("t-approved", "authorizing", "approved", "APPROVED"),
  ],
  annotations: [
    {
      id: "note-poll",
      attachedTo: ["authorizing"],
      data: {
        text: "POLL is a self-transition: it re-enters Authorizing until the issuer answers.",
      },
    },
  ],
};

export const sampleLibrary: Library = {
  rootMachineId: "checkout",
  machines: [
    { id: "checkout", name: "Checkout", document: checkout },
    { id: "payment", name: "Payment", document: payment },
  ],
};
