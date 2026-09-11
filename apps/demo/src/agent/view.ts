import * as Markdown from "@foldkit/markdown";
import { parseMarkdown } from "@foldkit/markdown/vite";
import { Agent } from "@foldworks/agent";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { className, styles as s } from "./styles";

const Message = Agent.Message;
type Message = Agent.Message;
type Model = Agent.Model;

const SUGGESTION = "Inspect the release setup and update the launch checklist.";

const models: ReadonlyArray<Agent.ModelOption> = [
  { id: "atlas-fast", label: "Atlas Fast", provider: "Local fixture", description: "Quick responses with compact tool summaries" },
  { id: "atlas-balanced", label: "Atlas Balanced", provider: "Local fixture", description: "Balanced planning and implementation detail" },
  { id: "atlas-reasoning", label: "Atlas Reasoning", provider: "Local fixture", description: "Deeper analysis with deliberate tool use" },
];

const renderMarkdown = (part: Agent.TextPart, h: HtmlBuilder<Message>): Html => {
  try {
    return h.div([h.Class(className(s.markdown))], [Markdown.view(parseMarkdown(part.text), {
      views: {
        Paragraph: (_paragraph, content) => h.p([h.Class(className(s.paragraph))], content),
        Heading: ({ level }, content) => level === 1
          ? h.h2([h.Class(className(s.heading))], content)
          : h.h3([h.Class(className(s.heading))], content),
        InlineCode: ({ value }) => h.code([h.Class(className(s.code))], [value]),
        CodeBlock: ({ value }) => h.pre([h.Class(className(s.pre))], [h.code([], [value])]),
        List: ({ isOrdered }, items) => isOrdered
          ? h.ol([h.Class(className(s.list))], items)
          : h.ul([h.Class(className(s.list))], items),
        ListItem: (_item, blocks) => h.li([h.Class(className(s.listItem))], blocks),
      },
    })]);
  } catch {
    return h.p([h.Class(className(s.paragraph))], [part.text]);
  }
};

export const view = defineView<Model, Message>((model, h) => Agent.Chat.view({
  model,
  models,
  toParentMessage: (message) => message,
  renderText: renderMarkdown,
  empty: {
    title: "See an agent run, one event at a time.",
    description: "Watch streamed text, tool inputs, results, and a human permission checkpoint. Everything is deterministic and stays in this browser.",
    suggestion: {
      label: "Run the release checklist example",
      prompt: SUGGESTION,
    },
  },
  composer: {
    placeholder: "Ask the simulated agent to inspect the project…",
  },
  failureTitle: "The simulated stream failed",
  permission: {
    note: "Simulation only — no real action will run.",
    renderDetails: (_part, builder) => [
      builder.p([builder.Class(className(s.permissionDetail))], [
        "Target: ", builder.code([builder.Class(className(s.code))], ["docs/launch-checklist.md"]),
      ]),
    ],
    resolutionText: (part) => part.status === "Denied"
      ? "Permission denied. No file was changed."
      : part.status === "Cancelled"
        ? "Request cancelled before execution."
        : "Permission allowed once for this simulated call.",
  },
}, h));
