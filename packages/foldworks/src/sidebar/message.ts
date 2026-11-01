import { defineMessageUnion } from "foldkit/message";

export const Message = defineMessageUnion({
  ToggledCollapsed: {},
  ToggledMobile: {},
  ClosedMobile: {},
});
export type Message = typeof Message.Type;
