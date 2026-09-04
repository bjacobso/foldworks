import { Message as MessageSchema, type Message as MessageValue } from "./message";
import { Model as ModelSchema, type Model as ModelValue } from "./model";

export const Message = MessageSchema;
export type Message = MessageValue;
export const Model = ModelSchema;
export type Model = ModelValue;
export { init, type InitConfig } from "./model";
export { update } from "./update";
export {
  view,
  type Brand,
  type Identity,
  type NavigationGroup,
  type NavigationItem,
  type NavigationSubItem,
  type ViewConfig,
} from "./view";
