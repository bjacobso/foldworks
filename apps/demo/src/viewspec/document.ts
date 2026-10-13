import type { Element, Spec } from "@foldworks/generative-ui/core";

import { crew } from "./catalog";
import type { Model } from "./model";

/** Local presentation adapter: fixture data and Foldkit state become concrete props. */
export const document = (model: Model): Spec => {
  const matches = crew.filter((person) =>
    `${person.name} ${person.role}`.toLowerCase().includes(model.filter.trim().toLowerCase()),
  );
  const selected = crew.find((person) => person.id === model.selected)!;
  const elements: Record<string, Element> = {
    root: {
      type: "Grid",
      props: { columns: 2, minColumnWidth: "18rem", gap: "lg" },
      children: ["directory", "request"],
    },
    directory: {
      type: "Card",
      props: { title: "Crew directory", description: "Local fixtures · search and select" },
      children: ["directory-content"],
    },
    "directory-content": {
      type: "Stack",
      props: { gap: "md" },
      children: [
        "crew-filter",
        "match-count",
        ...matches.map((person) => `crew-${person.id}`),
        ...(matches.length === 0 ? ["empty"] : []),
      ],
    },
    "crew-filter": {
      type: "TextInput",
      props: { label: "Filter crew", value: model.filter, placeholder: "Name or role" },
      children: [],
      on: { change: { action: "edit_filter", params: {} } },
    },
    "match-count": {
      type: "Text",
      props: {
        text: `${matches.length} crew ${matches.length === 1 ? "member" : "members"}`,
        tone: "muted",
        size: "sm",
      },
      children: [],
    },
    request: {
      type: "Card",
      props: {
        title: "Assignment request",
        description: "The document emits an intent; the host decides.",
      },
      children: ["request-content"],
    },
    "request-content": {
      type: "Stack",
      props: { gap: "md" },
      children: ["selected-name", "selected-role", "availability", "request-note", "submit"],
    },
    "selected-name": { type: "Heading", props: { text: selected.name, level: 3 }, children: [] },
    "selected-role": { type: "Text", props: { text: selected.role, tone: "muted" }, children: [] },
    availability: {
      type: "Badge",
      props: {
        label: selected.available ? "Available" : "Off duty",
        tone: selected.available ? "success" : "warning",
      },
      children: [],
    },
    "request-note": {
      type: "TextInput",
      props: {
        label: "Assignment note",
        value: model.note,
        description: "Explain the assignment before sending a request.",
      },
      children: [],
      on: { change: { action: "edit_note", params: {} } },
    },
    submit: {
      type: "Button",
      props: { label: "Request assignment", disabled: model.note.trim().length === 0 },
      children: [],
      on: {
        press: {
          action: "request_assignment",
          params: { crewId: model.selected, note: model.note },
        },
      },
    },
  };
  for (const person of matches) {
    elements[`crew-${person.id}`] = {
      type: "Button",
      props: {
        label: `Select ${person.name}`,
        variant: person.id === model.selected ? "secondary" : "outline",
      },
      children: [],
      on: { press: { action: "select_crew", params: { crewId: person.id } } },
    };
  }
  if (matches.length === 0)
    elements.empty = {
      type: "Alert",
      props: { title: "No crew matches", description: "Try a different name or role." },
      children: [],
    };
  return { version: "1", root: "root", elements };
};
