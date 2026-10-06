import { Subscription } from "foldkit";
import { createRegistry, type BlockDefinition } from "./document";
import { Model, Message, OutMessage, init, updateWith, type InitConfig } from "./model";
import type { TextIntelligence } from "./intelligence";
import { viewWith } from "./view";

export type { TextIntelligence } from "./intelligence";
export * from "./document";
export * from "./editing";
export * from "./markdown";
export { contentView } from "./browser";
export { toolbarView } from "./view";
export { Model, Message, OutMessage } from "./model";
export const define = (
  config: Readonly<{
    blocks?: ReadonlyArray<BlockDefinition>;
    textIntelligence?: TextIntelligence;
  }> = {},
) => {
  const registry = createRegistry(config.blocks);
  return {
    Model,
    Message,
    OutMessage,
    registry,
    init: (config: InitConfig) => init(config, registry),
    update: updateWith(registry, config.textIntelligence),
    view: viewWith(registry, config.textIntelligence),
    subscriptions: Subscription.make<Model, Message>()(() => ({})),
  };
};
export const Editor = { ...define(), define };
