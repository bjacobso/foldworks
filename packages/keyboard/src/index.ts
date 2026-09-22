import { Effect, Queue, Schema as S, Stream } from "effect";

export const Platform = S.Literals(["mac", "other"]);
export type Platform = typeof Platform.Type;
export const Shortcut = S.Struct({
  key: S.String,
  modifiers: S.Array(S.Literals(["Mod", "Control", "Alt", "Shift", "Meta"])),
});
export type Shortcut = typeof Shortcut.Type;
export const Binding = S.Struct({
  id: S.String,
  label: S.String,
  shortcut: Shortcut,
  scope: S.optionalKey(S.String),
  priority: S.optionalKey(S.Number),
  isDisabled: S.optionalKey(S.Boolean),
  allowEditable: S.optionalKey(S.Boolean),
  preventDefault: S.optionalKey(S.Boolean),
  repeat: S.optionalKey(S.Boolean),
});
export type Binding<Id extends string = string> = Omit<
  typeof Binding.Type,
  "id"
> & { readonly id: Id };
const aliases: Record<string, string> = {
  esc: "Escape",
  space: "Space",
  " ": "Space",
  return: "Enter",
  enter: "Enter",
  escape: "Escape",
  tab: "Tab",
  home: "Home",
  end: "End",
  backspace: "Backspace",
  delete: "Delete",
  pageup: "PageUp",
  pagedown: "PageDown",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  plus: "+",
  del: "Delete",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};
export const normalizeKey = (key: string): string =>
  aliases[key.toLowerCase()] ??
  (key.length === 1
    ? key.toLowerCase()
    : /^f\d{1,2}$/i.test(key)
      ? key.toUpperCase()
      : key);
export const shortcut = (
  key: string,
  ...modifiers: Shortcut["modifiers"]
): Shortcut => ({ key: normalizeKey(key), modifiers: [...new Set(modifiers)] });
export const modifiers = (
  value: Shortcut,
  platform: Platform,
): ReadonlyArray<string> => {
  const values = new Set(
    value.modifiers.map((mod) =>
      mod === "Mod" ? (platform === "mac" ? "Meta" : "Control") : mod,
    ),
  );
  return ["Control", "Alt", "Shift", "Meta"].filter((mod) =>
    values.has(mod as "Control"),
  );
};
export const aria = (value: Shortcut, platform: Platform): string =>
  [
    ...modifiers(value, platform),
    normalizeKey(value.key) === "+" ? "plus" : normalizeKey(value.key),
  ].join("+");
export const display = (value: Shortcut, platform: Platform): string => {
  const labels: Record<string, string> =
    platform === "mac"
      ? { Control: "⌃", Alt: "⌥", Shift: "⇧", Meta: "⌘" }
      : { Control: "Ctrl", Meta: "Win", Alt: "Alt", Shift: "Shift" };
  const key = normalizeKey(value.key);
  return [
    ...modifiers(value, platform).map((mod) => labels[mod]),
    key.length === 1 ? key.toUpperCase() : key,
  ].join(platform === "mac" ? "" : "+");
};
export type KeyEvent = Readonly<{
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
}>;
/** Scopes are ordered nearest-first. Ties use declaration order, never listener order. */
export const resolve = <Id extends string>(
  bindings: ReadonlyArray<Binding<Id>>,
  event: KeyEvent,
  platform: Platform,
  scopes: ReadonlyArray<string> = [],
  editable = false,
): Binding<Id> | undefined => {
  if (event.isComposing || event.defaultPrevented) return;
  return bindings
    .map((binding, index) => ({
      binding,
      index,
      depth:
        binding.scope === undefined
          ? scopes.length
          : scopes.indexOf(binding.scope),
    }))
    .filter(
      ({ binding: b, depth }) =>
        depth >= 0 &&
        !b.isDisabled &&
        (!editable || b.allowEditable) &&
        (!event.repeat || b.repeat) &&
        normalizeKey(event.key) === normalizeKey(b.shortcut.key) &&
        [event.ctrlKey, event.altKey, event.shiftKey, event.metaKey].every(
          (pressed, i) =>
            pressed ===
            modifiers(b.shortcut, platform).includes(
              ["Control", "Alt", "Shift", "Meta"][i]!,
            ),
        ),
    )
    .sort(
      (a, b) =>
        a.depth - b.depth ||
        (b.binding.priority ?? 0) - (a.binding.priority ?? 0) ||
        a.index - b.index,
    )[0]?.binding;
};
export const conflicts = (
  bindings: ReadonlyArray<Binding>,
  platform: Platform,
): ReadonlyArray<readonly [string, string]> =>
  bindings.flatMap((a, i) =>
    bindings
      .slice(i + 1)
      .filter(
        (b) =>
          !a.isDisabled &&
          !b.isDisabled &&
          a.scope === b.scope &&
          aria(a.shortcut, platform) === aria(b.shortcut, platform),
      )
      .map((b) => [a.id, b.id] as const),
  );
/** One registry per application. Use in a Subscription or Mount stream; interruption removes the listener. */
export const events = <Id extends string>(
  bindings: ReadonlyArray<Binding<Id>> | (() => ReadonlyArray<Binding<Id>>),
  platform: Platform,
  target?: Document,
): Stream.Stream<Id> =>
  Stream.callback<Id>((queue) =>
    Effect.gen(function* () {
      const doc =
        target ?? (typeof document === "undefined" ? undefined : document);
      if (!doc) return;
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const listener = (event: KeyboardEvent) => {
            const path = event
              .composedPath()
              .filter(
                (node): node is HTMLElement =>
                  node instanceof doc.defaultView!.HTMLElement,
              );
            const scopes = path.map((node) => node.id).filter(Boolean);
            const editable = path.some(
              (node) =>
                node.matches("input,textarea,select") || node.isContentEditable,
            );
            const binding = resolve(
              typeof bindings === "function" ? bindings() : bindings,
              event,
              platform,
              scopes,
              editable,
            );
            if (!binding) return;
            if (binding.preventDefault !== false) event.preventDefault();
            Queue.offerUnsafe(queue, binding.id);
          };
          doc.addEventListener("keydown", listener);
          return () => doc.removeEventListener("keydown", listener);
        }),
        (dispose) => Effect.sync(dispose),
      );
      return yield* Effect.never;
    }),
  );
