import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { Diagram } from "@foldworks/diagram";

import { StateKind } from "./machine";
import { Direction, Mode } from "./model";

export const Message = defineMessageUnion({
  GotCanvasMessage: { message: Diagram.Message },
  ClickedAddState: { kind: StateKind },
  ClickedAddNote: {},
  ChangedStateName: { value: S.String },
  ChangedStateKind: { value: S.String },
  ChangedSubmachine: { value: S.String },
  ChangedTransitionEvent: { value: S.String },
  ChangedTransitionGuard: { value: S.String },
  ChangedNoteText: { value: S.String },
  ClickedDeleteSelection: {},
  ClickedOpenSubmachine: { stateId: S.String },
  ClickedOpenMachine: { machineId: S.String },
  ClickedBreadcrumb: { index: S.Number },
  SelectedMode: { mode: Mode },
  SelectedDirection: { direction: Direction },
  ClickedAutoLayout: {},
  ClickedFit: {},
  CompletedMeasureCanvas: { width: S.Number, height: S.Number },
  ClickedFireTransition: { edgeId: S.String },
  ClickedRestartSimulation: {},
  ClickedSelectElement: { id: S.String },
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedReset: {},
});
export type Message = typeof Message.Type;
