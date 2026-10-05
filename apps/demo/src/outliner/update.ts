import { Option } from "effect";
import { Update } from "foldkit";
import { evo } from "foldkit/struct";
import { Outliner, find } from "@foldworks/outliner";

import { suggestionsAt } from "./mentions";
import { Message } from "./message";
import type { Model } from "./model";

const foldOutliner = Update.foldChild({
  update: Outliner.update,
  read: (model: Model) => Option.some(model.outline),
  write: (model, outline) => evo(model, { outline: () => outline }),
  toParentMessage: (message) => Message.GotOutlinerMessage({ message }),
});

type UpdateReturn = Update.Return<Model, Message>;

/**
 * Offers people after `@` and tags after `#`, when asked with Ctrl+Space or as
 * soon as one is being typed. The lookup is local, so the answer is part of the
 * same update.
 */
const suggest = (result: UpdateReturn, message: Outliner.Message): UpdateReturn => {
  const outline = result.model.outline;
  const at =
    message._tag === "RequestedCompletion" ||
    (message._tag === "EditedText" && outline.completion === null)
      ? { id: message.id, caret: message.end }
      : undefined;
  const text = at === undefined ? undefined : find(outline.items, at.id)?.text;
  const offer =
    at === undefined || text === undefined
      ? undefined
      : suggestionsAt(outline.items, text, at.caret);
  if (at === undefined || offer === undefined) return result;
  const next = foldOutliner(
    result.model,
    Outliner.Message.ShowCompletions({ id: at.id, ...offer }),
  );
  return { model: next.model, commands: [...(result.commands ?? []), ...(next.commands ?? [])] };
};

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match(message, {
    GotOutlinerMessage: ({ message: childMessage }) =>
      suggest(foldOutliner(model, childMessage), childMessage),
    ToggledCheckboxes: () => ({ model: evo(model, { showCheckboxes: (value) => !value }) }),
  });
