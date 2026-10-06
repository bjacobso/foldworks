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
export const REPLAY_ID = "statechart-replay";
export const REPLAY_BUTTON_ID = "statechart-replay-button";

/** One step of a run: the transition taken, or null for entering the
 *  machine, and the active leaf states it left behind. */
export const TraceStep = S.Struct({
  edgeId: S.NullOr(S.String),
  configuration: S.Array(S.String),
});
export type TraceStep = typeof TraceStep.Type;

/** Stepping back through a finished or sample run without touching the live
 *  simulation, which resumes where it was when the replay ends. */
export const Replay = S.Struct({
  source: S.Literals(["Run", "Sample"]),
  steps: S.Array(TraceStep),
  index: S.Number,
});
export type Replay = typeof Replay.Type;

export const Model = S.Struct({
  library: Library,
  history: History.Schema(Library),
  /** Machine ids from the root machine to the one being edited. */
  path: S.Array(S.String),
  canvas: Diagram.Model,
  mode: Mode,
  direction: Direction,
  configuration: S.Array(S.String),
  /** Transitions fired since the simulation last started. */
  run: S.Array(TraceStep),
  replay: S.NullOr(Replay),
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
  run: [],
  replay: null,
  nextId: 1,
  announcement: "Statechart editor ready.",
});

export const initialModel: Model = init();
