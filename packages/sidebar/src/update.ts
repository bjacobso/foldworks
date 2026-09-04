import { Update } from "foldkit";
import { evo } from "foldkit/struct";

import { Message } from "./message";
import type { Model } from "./model";

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    ToggledCollapsed: () => ({
      model: evo(model, {
        isCollapsed: (value) => !value,
        announcement: () => model.isCollapsed ? "Navigation expanded." : "Navigation collapsed.",
      }),
    }),
    ToggledMobile: () => ({
      model: evo(model, {
        isMobileOpen: (value) => !value,
        announcement: () => model.isMobileOpen ? "Navigation closed." : "Navigation opened.",
      }),
    }),
    ClosedMobile: () => ({
      model: model.isMobileOpen
        ? evo(model, {
            isMobileOpen: () => false,
            announcement: () => "Navigation closed.",
          })
        : model,
    }),
  });
