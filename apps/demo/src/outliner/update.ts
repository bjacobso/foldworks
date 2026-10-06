import { Option } from "effect";
import { Update } from "foldkit";
import { evo } from "foldkit/struct";
import { Outliner, find, updateItem } from "@foldworks/outliner";

import { suggestionsAt } from "./mentions";
import { Message } from "./message";
import type { Model } from "./model";
import { outlinePolicy } from "./policy";

const foldOutliner = Update.foldChild({
  update: (outline: Outliner.Model, message: Outliner.Message) =>
    Outliner.update(outline, message, outlinePolicy(outline.items)),
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
    message._tag === "RequestedCompletion" || message._tag === "EditedText"
      ? { id: message.id, caret: message.end }
      : undefined;
  const node = at === undefined ? undefined : find(outline.items, at.id);
  if (
    node === undefined ||
    outline.focus?.start !== outline.focus?.end ||
    outlinePolicy(outline.items).isReadOnly?.(node)
  )
    return result;
  const text = node.text;
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

/**
 * Marks an item done or not from a folded checklist's summary. It goes through
 * `Replace`, so it is one undoable step like any edit in the rows.
 */
const toggleDone = (model: Model, id: string): UpdateReturn => {
  const items = model.outline.items;
  const node = find(items, id);
  if (node === undefined || outlinePolicy(items).isReadOnly?.(node) === true) return { model };
  return foldOutliner(
    model,
    Outliner.Message.Replace({
      items: updateItem(items, id, (current) => ({ ...current, checked: !current.checked })),
      announcement: `Marked ${node.checked ? "not done" : "done"}.`,
    }),
  );
};

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match(message, {
    GotOutlinerMessage: ({ message: childMessage }) =>
      suggest(foldOutliner(model, childMessage), childMessage),
    ToggledCheckboxes: () => ({ model: evo(model, { showCheckboxes: (value) => !value }) }),
    ToggledDone: ({ id }) => toggleDone(model, id),
  });
