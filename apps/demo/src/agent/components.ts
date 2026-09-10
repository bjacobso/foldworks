import type { Agent } from "@foldworks/agent";

export const modelFixtures: ReadonlyArray<Agent.ModelOption> = [
  { id: "atlas-fast", label: "Atlas Fast", provider: "Local fixture", description: "Quick responses with compact tool summaries" },
  { id: "atlas-balanced", label: "Atlas Balanced", provider: "Local fixture", description: "Balanced planning and implementation detail" },
  { id: "atlas-reasoning", label: "Atlas Reasoning", provider: "Local fixture", description: "Deeper analysis with deliberate tool use" },
];

export const selectedModelFixture = (model: Agent.Model): Agent.ModelOption =>
  modelFixtures.find((fixture) => fixture.id === model.selectedModel) ?? modelFixtures[1]!;
