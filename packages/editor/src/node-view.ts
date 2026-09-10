import { Effect } from "effect";
import { Command, Port, Runtime, Subscription, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { defineView } from "foldkit/submodel";
import { Block, type BlockDefinition } from "./document";
import { Message } from "./model";

let mountId = 0;

/** A custom block's chrome is a real, lifecycle-scoped Foldkit element. */
export const mountBlockView = (
  container: HTMLElement,
  node: Block,
  definition: BlockDefinition,
  send: (message: Message) => void,
) => {
  // Runtime.makeElement replaces its container and requires a unique DOM id.
  // Keep a stable non-editable wrapper around that replaceable mount point.
  const mount = document.createElement("div");
  mount.id = `foldworks-block-view-${++mountId}`;
  container.append(mount);
  const Event = defineMessageUnion({
    Changed: { node: Block },
    Action: { message: Message },
    Completed: {},
  });
  type Event = typeof Event.Type;
  const ports = { inbound: { node: Port.inbound(Block) } };
  const Forward = Command.define("EditorBlockAction", {
    args: { message: Message },
    messages: [Event.Completed],
    execute: ({ message }) =>
      Effect.sync(() => {
        send(message);
        return Event.Completed();
      }),
  });
  const childView = defineView<Block, Message>(
    (model, h) => definition.view?.(model, h) ?? h.empty,
  );
  const handle = Runtime.embed(
    Runtime.makeElement({
      Model: Block,
      init: () => ({ model: node }),
      container: mount,
      ports,
      update: (model: Block, event: Event): Update.Return<Block, Event> =>
        event._tag === "Changed"
          ? { model: event.node }
          : event._tag === "Action"
            ? { model, commands: [Forward({ message: event.message })] }
            : { model },
      view: (model, h) =>
        h.submodel({
          slotId: "block",
          model,
          view: childView,
          toParentMessage: (message) => Event.Action({ message }),
        }),
      subscriptions: Subscription.make<Block, Event>()(() => ({
        node: Port.subscription(ports.inbound.node, (node) =>
          Event.Changed({ node }),
        ),
      })),
    }),
  );
  return {
    sync: (node: Block) => {
      handle.ports.node.send(node);
    },
    destroy: () => handle.dispose(),
  };
};
