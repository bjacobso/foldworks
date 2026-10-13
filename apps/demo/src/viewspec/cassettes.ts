import type { Spec } from "@foldworks/generative-ui/core";
import { Schema as S } from "effect";

import { crew } from "./catalog";

export const CassetteId = S.Literals([
  "crew-cards",
  "mission-brief",
  "off-duty",
  "invalid-component",
  "broken-reference",
  "malformed-json",
  "provider-error",
]);
export type CassetteId = typeof CassetteId.Type;

type Cassette = Readonly<{
  label: string;
  description: string;
  examplePrompt: string;
}> &
  ({ readonly response: string } | { readonly error: string });

const crewCards: Spec = {
  version: "1",
  root: "mock-crew",
  elements: {
    "mock-crew": { type: "Stack", props: { gap: "md" }, children: ["mock-title", "mock-cards"] },
    "mock-title": { type: "Heading", props: { text: "Meet the crew", level: 2 }, children: [] },
    "mock-cards": {
      type: "Grid",
      props: { columns: 2, minColumnWidth: "14rem", gap: "md" },
      children: crew.map((person) => `mock-card-${person.id}`),
    },
    ...Object.fromEntries(
      crew.flatMap((person) => [
        [
          `mock-card-${person.id}`,
          {
            type: "Card",
            props: { title: person.name, description: person.role },
            children: [`mock-content-${person.id}`],
          },
        ],
        [
          `mock-content-${person.id}`,
          {
            type: "Stack",
            props: { gap: "sm" },
            children: [`mock-status-${person.id}`, `mock-select-${person.id}`],
          },
        ],
        [
          `mock-status-${person.id}`,
          {
            type: "Badge",
            props: {
              label: person.available ? "Available" : "Off duty",
              tone: person.available ? "success" : "warning",
            },
            children: [],
          },
        ],
        [
          `mock-select-${person.id}`,
          {
            type: "Button",
            props: { label: `Choose ${person.name}`, variant: "outline" },
            children: [],
            on: { press: { action: "select_crew", params: { crewId: person.id } } },
          },
        ],
      ]),
    ),
  },
};

const missionBrief: Spec = {
  version: "1",
  root: "mock-brief",
  elements: {
    "mock-brief": {
      type: "Card",
      props: {
        title: "Landing party briefing",
        description: "A compact mission summary with a host-owned action.",
      },
      children: ["mock-brief-content"],
    },
    "mock-brief-content": {
      type: "Stack",
      props: { gap: "md" },
      children: ["mock-summary", "mock-table", "mock-request"],
    },
    "mock-summary": {
      type: "Text",
      props: { text: "Survey the landing site, plot a safe route, and report to the crew." },
      children: [],
    },
    "mock-table": {
      type: "Table",
      props: {
        caption: "Suggested assignments",
        columns: ["Crew member", "Assignment"],
        rows: [
          ["Ford Prefect", "Survey the landing site"],
          ["Trillian", "Plot the route"],
        ],
      },
      children: [],
    },
    "mock-request": {
      type: "Button",
      props: { label: "Assign Ford to the survey" },
      children: [],
      on: {
        press: {
          action: "request_assignment",
          params: { crewId: "ford", note: "Survey the landing site" },
        },
      },
    },
  },
};

const offDuty: Spec = {
  version: "1",
  root: "mock-off-duty",
  elements: {
    "mock-off-duty": {
      type: "Card",
      props: {
        title: "Systems review",
        description: "A valid UI request can still be refused by the host.",
      },
      children: ["mock-off-duty-content"],
    },
    "mock-off-duty-content": {
      type: "Stack",
      props: { gap: "md" },
      children: ["mock-warning", "mock-marvin-request"],
    },
    "mock-warning": {
      type: "Alert",
      props: {
        title: "Marvin is off duty",
        description:
          "Request a systems review to see the fixture host enforce its availability policy.",
      },
      children: [],
    },
    "mock-marvin-request": {
      type: "Button",
      props: { label: "Request Marvin's systems review" },
      children: [],
      on: {
        press: {
          action: "request_assignment",
          params: { crewId: "marvin", note: "Review systems" },
        },
      },
    },
  },
};

/** Fixed mock responses, not recordings from a live provider. */
export const cassettes: Readonly<Record<CassetteId, Cassette>> = {
  "crew-cards": {
    label: "Crew cards",
    description: "A card directory with actions that select records in the fixture host.",
    examplePrompt: "Show the crew as cards with their roles, availability, and a choose button.",
    response: JSON.stringify(crewCards),
  },
  "mission-brief": {
    label: "Mission brief",
    description: "A summary, a table, and a request the host can accept.",
    examplePrompt:
      "Create a landing party briefing and let me assign Ford to survey the landing site.",
    response: JSON.stringify(missionBrief),
  },
  "off-duty": {
    label: "Off-duty request",
    description: "A valid document whose action the host refuses.",
    examplePrompt: "Ask Marvin to review the ship's systems.",
    response: JSON.stringify(offDuty),
  },
  "invalid-component": {
    label: "Invalid component",
    description: "Catalog schema decoding rejects a component outside the allowlist.",
    examplePrompt: "Render a component that is not in the catalog.",
    response: JSON.stringify({
      version: "1",
      root: "mock-script",
      elements: { "mock-script": { type: "Script", props: {}, children: [] } },
    }),
  },
  "broken-reference": {
    label: "Broken reference",
    description: "Graph validation rejects a missing child after schema decoding succeeds.",
    examplePrompt: "Show a stack containing a missing component reference.",
    response: JSON.stringify({
      version: "1",
      root: "mock-broken",
      elements: { "mock-broken": { type: "Stack", props: {}, children: ["missing-child"] } },
    }),
  },
  "malformed-json": {
    label: "Malformed JSON",
    description: "Structured output decoding rejects incomplete JSON.",
    examplePrompt: "Simulate an incomplete model response.",
    response: '{"version":"1","root":',
  },
  "provider-error": {
    label: "Provider error",
    description: "Simulate a provider failure, then choose another cassette to retry.",
    examplePrompt: "Simulate a provider error while generating the interface.",
    error: "Simulated provider failure. Choose another cassette and retry.",
  },
};
