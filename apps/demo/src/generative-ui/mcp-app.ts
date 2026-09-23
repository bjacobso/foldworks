import { ActionIntent, Spec, render } from "@foldworks/generative-ui/core";
import { connectMcpApp, sendActionIntent } from "@foldworks/generative-ui/mcp-app";
import { foldworksRegistry } from "@foldworks/generative-ui/foldworks";
import { Schema as S } from "effect";
import { Port, Runtime, Subscription } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";

import { releaseCatalog } from "./catalog";

const Surface = S.Union([
  S.Struct({ _tag: S.Literal("Waiting") }),
  S.Struct({ _tag: S.Literal("Ready"), spec: Spec }),
  S.Struct({ _tag: S.Literal("Error"), message: S.String }),
]);
type Surface = typeof Surface.Type;

const Message = defineMessageUnion({
  ReceivedSurface: { surface: Surface },
  TriggeredAction: { intent: ActionIntent },
});
type Message = typeof Message.Type;

const Model = S.Struct({ surface: Surface });
type Model = typeof Model.Type;

const ports = {
  inbound: { surface: Port.inbound(Surface) },
  outbound: { action: Port.outbound(ActionIntent) },
};

const subscriptions = Subscription.make<Model, Message>()(() => ({
  surface: Port.subscription(ports.inbound.surface, (surface) =>
    Message.ReceivedSurface({ surface }),
  ),
}));

const stateView = (message: string, isError: boolean, h: HtmlBuilder<Message>): Html =>
  h.div([h.Class("mcp-app-state"), ...(isError ? [h.Role("alert")] : [])], [message]);

const view = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (model.surface._tag === "Waiting")
    return stateView("Waiting for a validated render_ui result…", false, h);
  if (model.surface._tag === "Error") return stateView(model.surface.message, true, h);
  return render(
    {
      spec: model.surface.spec,
      registry: foldworksRegistry<Message>(),
      toMessage: (intent) => Message.TriggeredAction({ intent }),
      renderError: (message, builder) => stateView(message, true, builder),
    },
    h,
  );
};

const root = document.getElementById("mcp-app-root");
if (root === null) throw new Error("Missing #mcp-app-root.");

const program = Runtime.makeElement({
  Model,
  container: root,
  ports,
  init: () => ({ model: { surface: { _tag: "Waiting" as const } } }),
  update: (model: Model, message: Message) =>
    Message.match(message, {
      ReceivedSurface: ({ surface }) => ({ model: { surface } }),
      TriggeredAction: ({ intent }) => ({
        model,
        commands: [Port.emit(ports.outbound.action, intent)],
      }),
    }),
  view,
  subscriptions,
});

const handle = Runtime.embed(program);
let app: Awaited<ReturnType<typeof connectMcpApp>> | undefined;
const unsubscribe = handle.ports.action.subscribe((intent) => {
  if (app === undefined) return;
  void sendActionIntent(app, intent).catch((error: unknown) => {
    handle.ports.surface.send({
      _tag: "Error",
      message: error instanceof Error ? error.message : "Could not send action intent.",
    });
  });
});

void connectMcpApp({
  catalog: releaseCatalog,
  name: "Foldworks generative UI",
  version: "0.1.0",
  onSpec: (spec) => {
    handle.ports.surface.send({ _tag: "Ready", spec });
  },
  onError: (message) => {
    handle.ports.surface.send({ _tag: "Error", message });
  },
  onTeardown: () => {
    unsubscribe();
    handle.dispose();
  },
})
  .then((connected) => {
    app = connected;
  })
  .catch((error: unknown) => {
    handle.ports.surface.send({
      _tag: "Error",
      message: error instanceof Error ? error.message : "Could not connect to the MCP host.",
    });
  });
