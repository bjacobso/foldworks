import { Runtime } from "foldkit";

import { Message, Model, init, subscriptions, update, view } from "./main";
import { slowConfig } from "./mobile-form/performance";

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
  // Record every phase for the mobile form's live timings; warnings stay development-only
  // and never send the whole editor model through Vite's console bridge.
  slow: slowConfig(),
  viewTransition: ({ previousModel, model }) => previousModel.revision !== model.revision,
});

Runtime.run(application);
