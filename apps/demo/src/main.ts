import { Runtime } from "foldkit";

import { readThemeState } from "./theme";
import { readPersistedWorkspace } from "./document-storage";
import { Message } from "./app/message";
import { init as initModel, Model } from "./app/model";
import { subscriptions } from "./app/subscriptions";
import { update } from "./app/update";
import { view } from "./app/view";
import { urlToAppRoute } from "./app/route";

export { Message, Model, subscriptions, update, view };

export const init: Runtime.RoutingApplicationInit<Model, Message> = (url) => ({
  model: initModel(
    urlToAppRoute(url),
    readThemeState(),
    readPersistedWorkspace(),
  ),
});
