import { Runtime } from "foldkit";

import { Message } from "./workflow/message";
import { initialModel, Model } from "./workflow/model";
import { subscriptions } from "./workflow/subscriptions";
import { update } from "./workflow/update";
import { view } from "./workflow/view";

export { Message, Model, subscriptions, update, view };

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: initialModel,
});
