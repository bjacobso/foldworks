import { Schema as S } from "effect";

import { Diagram } from "@foldworks/diagram";
import { History } from "@foldworks/history";

import { initialConfiguration, Library } from "./machine";
import { sampleLibrary } from "./sample";

export const Mode = S.Literals(["Edit", "Simulate"]);
export type Mode = typeof Mode.Type;

export const Direction = S.Literals(["Down", "Right"]);
export type Direction = typeof Direction.Type;

export const CANVAS_ID = "statechart-canvas";

export const Model = S.Struct({
  library: Library,
  history: History.Schema(Library),
  /** Machine ids from the root machine to the one being edited. */
  path: S.Array(S.String),
  canvas: Diagram.Model,
  mode: Mode,
  direction: Direction,
  configuration: S.Array(S.String),
  log: S.Array(S.String),
  nextId: S.Number,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export const initialViewport = { x: 56, y: 64, zoom: 0.9 };

export const init = (library: Library = sampleLibrary): Model => ({
  library,
  history: History.init<Library>(),
  path: [library.rootMachineId],
  canvas: Diagram.init({ id: CANVAS_ID, viewport: initialViewport }),
  mode: "Edit",
  direction: "Down",
  configuration: initialConfiguration(
    library.machines.find((machine) => machine.id === library.rootMachineId)?.document ?? {
      nodes: [],
      edges: [],
      annotations: [],
    },
  ),
  log: [],
  nextId: 1,
  announcement: "Statechart editor ready.",
});

export const initialModel: Model = init();
