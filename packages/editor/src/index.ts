import { Subscription } from "foldkit";
import { createRegistry, type BlockDefinition } from "./document";
import {
  Model,
  Message,
  OutMessage,
  init,
  updateWith,
  type InitConfig,
} from "./model";
import { viewWith } from "./view";

export * from "./document";
export * from "./editing";
export * from "./markdown";
export { contentView } from "./browser";
export { toolbarView } from "./view";
export { Model, Message, OutMessage } from "./model";
export const define = (
  config: Readonly<{ blocks?: ReadonlyArray<BlockDefinition> }> = {},
) => {
  const registry = createRegistry(config.blocks);
  return {
    Model,
    Message,
    OutMessage,
    registry,
    init: (config: InitConfig) => init(config, registry),
    update: updateWith(registry),
    view: viewWith(registry),
    subscriptions: Subscription.make<Model, Message>()(() => ({})),
  };
};
export const Editor = { ...define(), define };
