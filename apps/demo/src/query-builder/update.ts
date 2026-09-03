import { Option } from "effect";
import { Update } from "foldkit";
import { evo } from "foldkit/struct";

import { QueryBuilder, validate } from "@foldworks/query-builder";

import { attributes, validateValue } from "./configuration";
import { Message } from "./message";
import type { Model } from "./model";

const foldQueryBuilder = Update.foldChild({
  update: QueryBuilder.update,
  read: (model: Model) => Option.some(model.builder),
  write: (model, builder) => {
    const validation = validate(builder.query, { attributes, validateValue });
    return evo(model, {
      builder: () => builder,
      announcement: () => validation.isValid
        ? "Query updated and valid."
        : `Query updated with ${validation.issues.length} validation ${validation.issues.length === 1 ? "issue" : "issues"}.`,
    });
  },
  toParentMessage: (message) => Message.GotQueryBuilderMessage({ message }),
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    GotQueryBuilderMessage: ({ message: childMessage }) =>
      foldQueryBuilder(model, childMessage),
  });
