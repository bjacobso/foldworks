import { Effect, Option, Schema as S } from "effect";
import { Command, Update } from "foldkit";
import * as Dom from "foldkit/dom";
import { defineMessageUnion } from "foldkit/message";
import { defineView } from "foldkit/submodel";

import { catalogStyles as styles } from "../catalog.styles";
import type { Children } from "../catalog.shared";
import { sxAttrs } from "../sx";
import { statefulStyles } from "../stateful.styles";

export const Model = S.Struct({ id: S.String, query: S.String, activeValue: S.Option(S.String) });
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  ChangedSearch: { query: S.String },
  Activated: { value: S.String, isKeyboard: S.Boolean },
  Selected: { value: S.String },
  IgnoredSelection: {},
  CompletedScroll: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  SearchChanged: { query: S.String },
  Selected: { value: S.String },
});
export type OutMessage = typeof OutMessage.Type;

export const init = (config: Readonly<{ id: string; query?: string }>): Model => ({
  id: config.id, query: config.query ?? "", activeValue: Option.none(),
});

export const ScrollActive = Command.define("ScrollCommandResult", {
  args: { id: S.String, value: S.String },
  messages: [Message.CompletedScroll],
  execute: ({ id, value }) => Dom.scrollIntoView(
    `[id="${itemId(id, value)}"]`, { block: "nearest" },
  ).pipe(Effect.ignore, Effect.as(Message.CompletedScroll())),
});

export const update = (model: Model, message: Message): Update.ReturnWithOutMessage<Model, Message, OutMessage> =>
  Message.match(message, {
    ChangedSearch: ({ query }) => ({
      model: { ...model, query, activeValue: Option.none() },
      outMessage: OutMessage.SearchChanged({ query }),
    }),
    Activated: ({ value, isKeyboard }) => ({
      model: { ...model, activeValue: Option.some(value) },
      commands: isKeyboard ? [ScrollActive({ id: model.id, value })] : [],
    }),
    Selected: ({ value }) => ({ model, outMessage: OutMessage.Selected({ value }) }),
    IgnoredSelection: () => ({ model }),
    CompletedScroll: () => ({ model }),
  });

export type Item = Readonly<{
  value: string;
  label: string;
  keywords?: ReadonlyArray<string>;
  group?: string;
  isDisabled?: boolean;
  media?: Children;
}>;
export type ViewInputs = Readonly<{
  items: ReadonlyArray<Item>;
  ariaLabel: string;
  placeholder?: string;
  emptyLabel?: string;
  loop?: boolean;
  /** Positive scores match; larger scores rank first. */
  filter?: (query: string, item: Item) => number;
  /** Use for server-filtered results. The parent supplies items when its request completes. */
  shouldFilter?: boolean;
}>;

/** Deterministic subsequence matching, with exact and prefix matches ranked first. */
export const score = (text: string, query: string): number => {
  const value = text.toLocaleLowerCase();
  const search = query.trim().toLocaleLowerCase();
  if (search === "") return 1;
  if (value === search) return 4;
  if (value.startsWith(search)) return 3;
  if (value.split(/\s+/).some((word) => word.startsWith(search))) return 2;
  const contiguous = value.indexOf(search);
  if (contiguous >= 0) return 1 + 1 / (contiguous + 2);
  let cursor = 0;
  let gaps = 0;
  for (const character of search) {
    const index = value.indexOf(character, cursor);
    if (index < 0) return 0;
    gaps += index - cursor;
    cursor = index + 1;
  }
  return 1 / (gaps + 2);
};

/** Group results by their best match; preserve declaration order for tied scores. */
export const getResults = (query: string, config: ViewInputs): ReadonlyArray<Item> => {
  const groups = new Map<string, Array<{ item: Item; score: number }>>();
  for (const item of config.items) {
    const rank = config.shouldFilter === false || query.trim() === "" ? 1
      : config.filter?.(query, item) ?? Math.max(score(item.label, query),
        ...(item.keywords ?? []).map((keyword) => score(keyword, query)));
    if (!Number.isFinite(rank) || rank <= 0) continue;
    const group = item.group ?? "Commands";
    const entries = groups.get(group) ?? [];
    entries.push({ item, score: rank });
    groups.set(group, entries);
  }
  return [...groups.values()]
    .map((entries) => entries.sort((a, b) => b.score - a.score))
    .sort((a, b) => (b[0]?.score ?? 0) - (a[0]?.score ?? 0))
    .flatMap((entries) => entries.map(({ item }) => item));
};

export const activeItem = (model: Model, items: ReadonlyArray<Item>): Item | undefined =>
  items.find((item) => !item.isDisabled && Option.contains(model.activeValue, item.value))
    ?? items.find((item) => !item.isDisabled);

// Encoding both parts keeps the DOM id stable and safe in attribute selectors.
const itemId = (id: string, value: string) => `${encodeURIComponent(id)}-item-${encodeURIComponent(value)}`;

export const view = defineView<Model, Message, ViewInputs>((model, inputs, h) => {
  const items = getResults(model.query, inputs);
  const active = activeItem(model, items);
  const enabled = items.filter((item) => !item.isDisabled);
  const activeIndex = enabled.findIndex((item) => item.value === active?.value);
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.group ?? "Commands";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const onKeyDown = (key: string): Option.Option<Message> => {
    // Consume Enter even without a match so an enclosing form is not submitted accidentally.
    if (key === "Enter") return Option.some(active === undefined
      ? Message.IgnoredSelection() : Message.Selected({ value: active.value }));
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(key) || enabled.length === 0) return Option.none();
    const next = key === "Home" ? 0 : key === "End" ? enabled.length - 1
      : activeIndex + (key === "ArrowDown" ? 1 : -1);
    const index = inputs.loop === true ? (next + enabled.length) % enabled.length
      : Math.max(0, Math.min(enabled.length - 1, next));
    const item = enabled[index];
    return item === undefined ? Option.none() : Option.some(Message.Activated({ value: item.value, isKeyboard: true }));
  };
  return h.div(sxAttrs(h, styles.surface, styles.command), [
    h.input([
      ...sxAttrs(h, styles.control, styles.focusable),
      h.Role("combobox"), h.AriaLabel(inputs.ariaLabel), h.AriaExpanded(true),
      h.AriaAutocomplete("list"), h.AriaControls(`${model.id}-results`),
      ...(active === undefined ? [] : [h.AriaActiveDescendant(itemId(model.id, active.value))]),
      h.Value(model.query), h.Placeholder(inputs.placeholder ?? "Type a command or search…"),
      h.OnInput((query) => Message.ChangedSearch({ query })), h.OnKeyDownPreventDefault(onKeyDown),
    ]),
    h.div([h.Id(`${model.id}-results`), h.Role("listbox"), h.AriaLabel(inputs.ariaLabel), ...sxAttrs(h, styles.commandList)],
      [...groups].map(([group, entries], index) => h.div([
        h.Role("group"), h.AriaLabelledBy(`${model.id}-group-${index}`),
      ], [
        h.div([h.Id(`${model.id}-group-${index}`), ...sxAttrs(h, styles.menuLabel)], [group]),
        ...entries.map((item) => h.div([
          h.Id(itemId(model.id, item.value)), h.Role("option"), h.AriaSelected(item.value === active?.value),
          h.AriaDisabled(item.isDisabled === true),
          ...sxAttrs(h, styles.menuItem, statefulStyles.selectItem,
            item.value === active?.value && statefulStyles.activeItem, item.isDisabled === true && statefulStyles.disabled),
          ...(item.isDisabled === true ? [] : [
            h.OnMouseEnter(Message.Activated({ value: item.value, isKeyboard: false })),
            h.OnClick(Message.Selected({ value: item.value })),
          ]),
        ], [...(item.media ?? []), item.label])),
      ]))),
    ...(items.length === 0 ? [h.p([h.Role("status"), ...sxAttrs(h, styles.description)], [inputs.emptyLabel ?? "No results found."])] : []),
  ]);
});
