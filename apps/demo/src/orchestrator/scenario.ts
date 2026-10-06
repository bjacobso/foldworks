import { createScenario } from "@foldworks/agent/testing";
import type { Agent } from "@foldworks/agent";
import type { Thread } from "./model";

/** Local, prompt-aware fixture. The transcript and lifecycle use the real agent runtime. */
export const scenarioFor = (thread: Thread) => {
  const prompt = thread.prompt || "Explore this task";
  const context = thread.context.map((source) => source.text).join("\n");
  const recommendation = /keyboard|navigation|tab\b/i.test(prompt)
    ? "Keep Tab and Shift+Tab for nesting, Enter for the next bullet, and Escape for row selection. Preserve the caret when agent status changes."
    : /onboard|setup|welcome/i.test(prompt)
      ? "Open directly into a useful outline. Offer one sample task and a small inline hint; let people attach an agent when they are ready."
      : `Start with a small, reviewable step for “${prompt}”. Use the attached context as constraints, preserve the surrounding notes, and bring back the result before expanding scope.`;
  return createScenario({
    initial: (writer) => {
      writer.text(`I’m working on: ${prompt}`, { chunks: ["I’m working on: ", prompt] });
      writer.tool({
        id: "context",
        name: "read_outline_context",
        input: JSON.stringify({ sources: thread.context.map((source) => source.id) }),
        output: context || "No inherited context. Working from the task brief.",
      });
      writer.text(`Recommendation: ${recommendation}`, {
        chunks: ["Recommendation: ", recommendation],
      });
      writer.requestPermission({
        id: "review",
        name: "review_result",
        input: JSON.stringify({ recommendation }),
        reason:
          "Review this recommendation. Accepting keeps it as this thread’s result; promote it when you want it in the outline.",
      });
    },
    approved: (writer) => {
      writer.completeTool("review", "Recommendation accepted.");
      writer.text(recommendation);
    },
    denied: (writer) => {
      writer.text("Recommendation discarded. Send another direction to try a different approach.");
    },
  });
};

export const nextEvent = (thread: Thread): Agent.EventEnvelope | undefined => {
  const state = thread.agent.runState;
  if (state._tag !== "Streaming") return undefined;
  return scenarioFor(thread)
    .events(state.segment, state.runId, thread.agent.selectedModel)
    .find((envelope) => envelope.sequence > state.lastSequence);
};
