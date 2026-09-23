import { validateSpec, type Spec } from "@foldworks/generative-ui/core";
import { Result } from "effect";

import { releaseCatalog } from "./catalog";

const candidate = {
  version: "1",
  root: "release",
  elements: {
    release: {
      type: "Stack",
      props: { gap: "lg" },
      children: ["header", "summary", "checks", "actions"],
    },
    header: {
      type: "Row",
      props: { gap: "sm", align: "center", justify: "between", wrap: true },
      children: ["title", "status"],
    },
    title: {
      type: "Heading",
      props: { text: "September release", level: 3, size: "lg" },
      children: [],
    },
    status: {
      type: "Badge",
      props: { label: "On track", tone: "success", dot: true },
      children: [],
    },
    summary: {
      type: "Grid",
      props: { columns: 3, gap: "sm", minColumnWidth: "9rem" },
      children: ["ready", "review", "blocked"],
    },
    ready: {
      type: "Card",
      props: { title: "Ready", description: "Completed checks" },
      children: ["ready-value"],
    },
    "ready-value": {
      type: "Heading",
      props: { text: "14", level: 4, size: "xl" },
      children: [],
    },
    review: {
      type: "Card",
      props: { title: "In review", description: "Owners assigned" },
      children: ["review-value"],
    },
    "review-value": {
      type: "Heading",
      props: { text: "2", level: 4, size: "xl", tone: "warning" },
      children: [],
    },
    blocked: {
      type: "Card",
      props: { title: "Blocked", description: "Needs attention" },
      children: ["blocked-value"],
    },
    "blocked-value": {
      type: "Heading",
      props: { text: "1", level: 4, size: "xl", tone: "danger" },
      children: [],
    },
    checks: {
      type: "Table",
      props: {
        caption: "Release checks",
        columns: ["Owner", "Area", "Status"],
        rows: [
          ["Maya", "Product", "Ready"],
          ["Alex", "Legal", "Review"],
          ["Inez", "Operations", "Ready"],
        ],
      },
      children: [],
    },
    actions: {
      type: "Row",
      props: { gap: "sm", justify: "end", wrap: true },
      children: ["review-action", "approve-action"],
    },
    "review-action": {
      type: "Button",
      props: { label: "Review blockers", variant: "outline" },
      children: [],
      on: {
        press: {
          action: "review_release",
          params: { releaseId: "rel_2026_09", team: "Legal" },
        },
      },
    },
    "approve-action": {
      type: "Button",
      props: { label: "Approve release" },
      children: [],
      on: {
        press: {
          action: "approve_release",
          params: { releaseId: "rel_2026_09" },
        },
      },
    },
  },
} as const satisfies Spec;

const validated = validateSpec(releaseCatalog, candidate);
if (Result.isFailure(validated))
  throw new Error(`Invalid generative UI demo: ${JSON.stringify(validated.failure)}`);
export const releaseSpec = validated.success;

export const releaseSpecPreview = `{
  "version": "1",
  "root": "release",
  "elements": {
    "release": { "type": "Stack", "children": ["header", "summary", "checks", "actions"] },
    "summary": { "type": "Grid", "props": { "columns": 3 }, "children": ["ready", "review", "blocked"] },
    "approve-action": {
      "type": "Button",
      "props": { "label": "Approve release" },
      "on": { "press": { "action": "approve_release", "params": { "releaseId": "rel_2026_09" } } }
    }
  }
}`;
