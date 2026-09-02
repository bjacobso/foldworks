import { Runtime } from "foldkit";

import { Message } from "./workflow/message";
import { initialModelForRoute, Model } from "./workflow/model";
import { urlToAppRoute } from "./workflow/route";
import { subscriptions } from "./workflow/subscriptions";
import { update } from "./workflow/update";
import { view } from "./workflow/view";

export { Message, Model, subscriptions, update, view };

export const init: Runtime.RoutingApplicationInit<Model, Message> = (url) => ({
  model: initialModelForRoute(urlToAppRoute(url)),
});
