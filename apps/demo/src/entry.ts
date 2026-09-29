import { Runtime } from "foldkit";

import { Message, Model, init, subscriptions, update, view } from "./main";

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  subscriptions,
  container: document.getElementById("root"),
  routing: {
    onUrlRequest: (request) => Message.ClickedLink({ request }),
    onUrlChange: (url) => Message.ChangedUrl({ url }),
  },
  devTools: {
    Message,
    show: "Development",
    position: "BottomRight",
    // The editor owns large document snapshots; recording each keystroke stalls the demo in development.
    excludeFromHistory: ["GotCodeEditorMessage"],
  },
  // Keep slow-phase warnings useful without sending the whole editor model through Vite's console bridge.
  slow: {
    onSlow: ({ _tag, durationMs }) =>
      console.warn(`[foldkit] Slow ${_tag}: ${durationMs.toFixed(1)}ms`),
  },
  viewTransition: ({ previousModel, model }) => previousModel.revision !== model.revision,
});

Runtime.run(application);
