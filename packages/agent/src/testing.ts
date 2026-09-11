import { Effect, Stream } from "effect";

import type { EventEnvelope, Segment, StreamEvent } from "./protocol";

export type ScenarioTextOptions = Readonly<{
  id?: string;
  chunks?: ReadonlyArray<string>;
}>;

export type ScenarioToolOptions = Readonly<{
  id: string;
  name: string;
  input: string | ReadonlyArray<string>;
  output?: string;
}>;

export type ScenarioWriter = Readonly<{
  text: (text: string, options?: ScenarioTextOptions) => void;
  reasoning: (text: string, options?: ScenarioTextOptions) => void;
  tool: (options: ScenarioToolOptions) => void;
  requestPermission: (options: ScenarioToolOptions & Readonly<{ reason: string }>) => void;
  completeTool: (id: string, output: string) => void;
}>;

export type ScenarioConfig = Readonly<{
  initial: (writer: ScenarioWriter) => void;
  approved?: (writer: ScenarioWriter) => void;
  denied?: (writer: ScenarioWriter) => void;
  delayFor?: (event: StreamEvent) => number;
  sequenceStarts?: Partial<Record<Segment, number>>;
}>;

export type Scenario = Readonly<{
  events: (segment: Segment, runId: string, modelId: string) => ReadonlyArray<EventEnvelope>;
  stream: (segment: Segment, runId: string, modelId: string) => Stream.Stream<EventEnvelope>;
}>;

type EventFactory = (runId: string, modelId: string) => StreamEvent;

export const defaultDelayFor = (event: StreamEvent): number =>
  event._tag === "TextDelta" || event._tag === "ReasoningDelta" ? 85
    : event._tag === "ToolStarted" || event._tag === "ToolResult" ? 240
      : event._tag === "PermissionRequested" ? 160
        : 45;

const partFactories = (
  tag: "Text" | "Reasoning",
  text: string,
  options: ScenarioTextOptions | undefined,
  nextId: () => string,
): ReadonlyArray<EventFactory> => {
  const id = options?.id ?? nextId();
  const chunks = options?.chunks ?? [text];
  return [
    (runId) => ({ _tag: `${tag}Started`, runId, partId: `${runId}-${id}` } as StreamEvent),
    ...chunks.map((delta): EventFactory => (runId) => ({
      _tag: `${tag}Delta`,
      runId,
      partId: `${runId}-${id}`,
      delta,
    } as StreamEvent)),
    (runId) => ({ _tag: `${tag}Finished`, runId, partId: `${runId}-${id}` } as StreamEvent),
  ];
};

const inputChunks = (input: string | ReadonlyArray<string>): ReadonlyArray<string> =>
  typeof input === "string" ? [input] : input;

const factoriesFor = (write: (writer: ScenarioWriter) => void): ReadonlyArray<EventFactory> => {
  const factories: Array<EventFactory> = [];
  let nextPartNumber = 1;
  const nextId = () => `part-${nextPartNumber++}`;
  const addToolInput = (options: ScenarioToolOptions) => {
    factories.push(
      (runId) => ({
        _tag: "ToolInputStarted",
        runId,
        callId: `${runId}-${options.id}`,
        name: options.name,
      }),
      ...inputChunks(options.input).map((delta): EventFactory => (runId) => ({
        _tag: "ToolInputDelta",
        runId,
        callId: `${runId}-${options.id}`,
        delta,
      })),
      (runId) => ({ _tag: "ToolCallReady", runId, callId: `${runId}-${options.id}` }),
    );
  };
  write({
    text: (text, options) => factories.push(...partFactories("Text", text, options, nextId)),
    reasoning: (text, options) => factories.push(...partFactories("Reasoning", text, options, nextId)),
    tool: (options) => {
      addToolInput(options);
      factories.push((runId) => ({
        _tag: "ToolStarted",
        runId,
        callId: `${runId}-${options.id}`,
      }));
      if (options.output !== undefined) {
        factories.push((runId) => ({
          _tag: "ToolResult",
          runId,
          callId: `${runId}-${options.id}`,
          output: options.output ?? "",
        }));
      }
    },
    requestPermission: (options) => {
      addToolInput(options);
      factories.push((runId) => ({
        _tag: "PermissionRequested",
        runId,
        callId: `${runId}-${options.id}`,
        reason: options.reason,
      }));
    },
    completeTool: (id, output) => factories.push(
      (runId) => ({ _tag: "ToolStarted", runId, callId: `${runId}-${id}` }),
      (runId) => ({ _tag: "ToolResult", runId, callId: `${runId}-${id}`, output }),
    ),
  });
  return factories;
};

export const createScenario = (config: ScenarioConfig): Scenario => {
  const segments: Record<Segment, ReadonlyArray<EventFactory>> = {
    Initial: factoriesFor(config.initial),
    Approved: factoriesFor(config.approved ?? (() => undefined)),
    Denied: factoriesFor(config.denied ?? (() => undefined)),
  };
  const events = (
    segment: Segment,
    runId: string,
    modelId: string,
  ): ReadonlyArray<EventEnvelope> => {
    const body = segments[segment].map((factory) => factory(runId, modelId));
    const withLifecycle: ReadonlyArray<StreamEvent> = segment === "Initial"
      ? [
          { _tag: "Started", runId, modelId },
          ...body,
          ...(body.at(-1)?._tag === "PermissionRequested" ? [] : [{ _tag: "Finished" as const, runId }]),
        ]
      : [...body, { _tag: "Finished", runId }];
    const start = config.sequenceStarts?.[segment] ??
      (segment === "Initial" ? 1 : segment === "Approved" ? 100 : 200);
    return withLifecycle.map((event, index) => ({ sequence: start + index, event }));
  };
  return {
    events,
    stream: (segment, runId, modelId) => Stream.fromIterable(
      events(segment, runId, modelId),
    ).pipe(
      Stream.mapEffect((envelope) => Effect.sleep(
        `${config.delayFor?.(envelope.event) ?? defaultDelayFor(envelope.event)} millis`,
      ).pipe(Effect.as(envelope))),
    ),
  };
};
