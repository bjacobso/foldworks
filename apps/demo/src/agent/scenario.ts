import type { Agent } from "@foldworks/agent";
import { createScenario } from "@foldworks/agent/testing";

const scenario = createScenario({
  initial: (writer) => {
    writer.reasoning(
      "I should inspect the project scripts, verify the existing gates, and only then propose the smallest checklist change.",
      {
        id: "reasoning-1",
        chunks: [
          "I should inspect the project scripts, ",
          "verify the existing gates, and only then propose the smallest checklist change.",
        ],
      },
    );
    writer.text("I’ll inspect the release setup first, then I’ll prepare the smallest safe checklist update.", {
      id: "text-1",
      chunks: [
        "I’ll inspect the release setup first, ",
        "then I’ll prepare the smallest ",
        "safe checklist update.",
      ],
    });
    writer.tool({
      id: "read",
      name: "read_file",
      input: ["{\n  \"path\": ", "\"package.json\"\n}"],
      output: "{\n  \"scripts\": [\"build\", \"test\", \"typecheck\"],\n  \"packageManager\": \"pnpm\"\n}",
    });
    writer.text("The project already has build, test, and typecheck gates. I’m ready to add them to the launch checklist.", {
      id: "text-2",
      chunks: [
        "The project already has build, test, and typecheck gates. ",
        "I’m ready to add them to the launch checklist.",
      ],
    });
    writer.requestPermission({
      id: "write",
      name: "write_file",
      input: [
        "{\n  \"path\": \"docs/launch-checklist.md\",\n",
        "  \"change\": \"Add release verification gates\"\n}",
      ],
      reason: "Writing a project file changes the workspace and requires your approval.",
    });
  },
  approved: (writer) => {
    writer.completeTool("write", "{\n  \"updated\": \"docs/launch-checklist.md\",\n  \"linesAdded\": 4,\n  \"simulated\": true\n}");
    writer.text("Done — the simulated checklist now includes:\n\n- `pnpm test`\n- `pnpm typecheck`\n- `pnpm build`\n\nNo real file was changed.", {
      id: "text-3",
      chunks: [
        "Done — the simulated checklist now includes:\n\n",
        "- `pnpm test`\n- `pnpm typecheck`\n",
        "- `pnpm build`\n\nNo real file was changed.",
      ],
    });
  },
  denied: (writer) => writer.text(
    "Understood — I didn’t apply the checklist update. The inspection result is still available above, and no file was changed.",
    {
      id: "text-3",
      chunks: [
        "Understood — I didn’t apply the checklist update. ",
        "The inspection result is still available above, and no file was changed.",
      ],
    },
  ),
});

export const scenarioEvents = (
  segment: Agent.Segment,
  runId: string,
  modelId: string,
) => scenario.events(segment, runId, modelId);

export const scenarioStream = (
  segment: Agent.Segment,
  runId: string,
  modelId: string,
) => scenario.stream(segment, runId, modelId);
