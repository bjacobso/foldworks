export { defineColumns } from "./core";
import { Message as MessageSchema, type Message as MessageValue } from "./message";
import { Model as ModelSchema, type Model as ModelValue } from "./model";

export const Message = MessageSchema;
export type Message = MessageValue;
export const Model = ModelSchema;
export type Model = ModelValue;
export { init, type InitConfig } from "./model";
export { subscriptions } from "./subscriptions";
export { update } from "./update";
export { view, type ViewConfig } from "./view";
