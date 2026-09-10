import { Message as MessageSchema, type Message as MessageValue } from "./message";
import {
  ConversationPart as ConversationPartSchema,
  Model as ModelSchema,
  RunState as RunStateSchema,
  TextPart as TextPartSchema,
  ToolPart as ToolPartSchema,
  Turn as TurnSchema,
  type ConversationPart as ConversationPartValue,
  type Model as ModelValue,
  type RunState as RunStateValue,
  type TextPart as TextPartValue,
  type ToolPart as ToolPartValue,
  type Turn as TurnValue,
} from "./model";
import {
  EventEnvelope as EventEnvelopeSchema,
  Segment as SegmentSchema,
  StreamEvent as StreamEventSchema,
  type EventEnvelope as EventEnvelopeValue,
  type Segment as SegmentValue,
  type StreamEvent as StreamEventValue,
} from "./protocol";

export const Message = MessageSchema;
export type Message = MessageValue;
export const Model = ModelSchema;
export type Model = ModelValue;
export const ConversationPart = ConversationPartSchema;
export type ConversationPart = ConversationPartValue;
export const RunState = RunStateSchema;
export type RunState = RunStateValue;
export const TextPart = TextPartSchema;
export type TextPart = TextPartValue;
export const ToolPart = ToolPartSchema;
export type ToolPart = ToolPartValue;
export const Turn = TurnSchema;
export type Turn = TurnValue;
export const EventEnvelope = EventEnvelopeSchema;
export type EventEnvelope = EventEnvelopeValue;
export const Segment = SegmentSchema;
export type Segment = SegmentValue;
export const StreamEvent = StreamEventSchema;
export type StreamEvent = StreamEventValue;

export { ModelSelect } from "./components";
export {
  init,
  isActive,
  latestUserPrompt,
  transcriptId,
  type InitConfig,
  type ModelOption,
} from "./model";
export { update } from "./update";
