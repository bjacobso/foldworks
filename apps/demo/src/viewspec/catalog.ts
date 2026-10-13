import { createFoldworksCatalog } from "@foldworks/generative-ui/foldworks";
import { Schema as S } from "effect";

export const CrewId = S.Literals(["arthur", "ford", "trillian", "marvin"]);
export type CrewId = typeof CrewId.Type;

export const catalog = createFoldworksCatalog({
  edit_filter: {
    description: "Update the local crew filter.",
    params: S.Struct({}),
    data: S.Struct({ value: S.String }),
  },
  select_crew: {
    description: "Select a fixture crew record.",
    params: S.Struct({ crewId: CrewId }),
  },
  edit_note: {
    description: "Update the local request note.",
    params: S.Struct({}),
    data: S.Struct({ value: S.String }),
  },
  request_assignment: {
    description: "Ask the fixture host to assign a crew member. The host may refuse.",
    params: S.Struct({ crewId: CrewId, note: S.String }),
  },
});

export const crew = [
  { id: "arthur", name: "Arthur Dent", role: "Observer", available: true },
  { id: "ford", name: "Ford Prefect", role: "Field researcher", available: true },
  { id: "trillian", name: "Trillian", role: "Navigator", available: true },
  { id: "marvin", name: "Marvin", role: "Systems analyst", available: false },
] as const;
