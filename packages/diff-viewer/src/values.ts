import type { Diagnostic } from "@foldworks/text-intelligence";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { DiffAnnotation } from "./view";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type ValuePath = readonly (string | number)[];
export type ValueChange = Readonly<{
  path: ValuePath;
  kind: "added" | "removed" | "changed";
  before?: JsonValue;
  after?: JsonValue;
}>;
export type DiffValuesOptions = Readonly<{
  key?: (value: JsonValue, path: ValuePath) => string | number | undefined;
}>;
const object = (value: JsonValue): value is { [key: string]: JsonValue } =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const assertJson = (value: JsonValue, active = new Set<object>()): void => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return;
  if (
    typeof value !== "object" ||
    value === null ||
    (!Array.isArray(value) &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    throw new TypeError("diffValues requires JSON-like values");
  if (active.has(value)) throw new TypeError("diffValues does not support cycles");
  active.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value)) assertJson(item, active);
  active.delete(value);
};
/** Identity-matched arrays ignore pure reorder; other arrays compare by index. */
export const diffValues = (
  before: JsonValue,
  after: JsonValue,
  options: DiffValuesOptions = {},
): readonly ValueChange[] => {
  assertJson(before);
  assertJson(after);
  const changes: ValueChange[] = [];
  const visit = (old: JsonValue, next: JsonValue, path: ValuePath): void => {
    if (old === next) return;
    if (Array.isArray(old) && Array.isArray(next)) {
      const key =
        options.key ??
        ((value: JsonValue) =>
          object(value) && (typeof value.id === "string" || typeof value.id === "number")
            ? value.id
            : undefined);
      const oldKeys = old.map((value) => key(value, path)),
        nextKeys = next.map((value) => key(value, path));
      const unique = (keys: readonly (string | number | undefined)[]) =>
        keys.every((k) => k !== undefined) && new Set(keys).size === keys.length;
      if (unique(oldKeys) && unique(nextKeys)) {
        const oldByKey = new Map(oldKeys.map((key, index) => [key, index]));
        const newByKey = new Set(nextKeys);
        old.forEach((value, index) => {
          if (!newByKey.has(oldKeys[index]))
            changes.push({ path: [...path, index], kind: "removed", before: value });
        });
        next.forEach((value, index) => {
          const oldIndex = oldByKey.get(nextKeys[index]);
          if (oldIndex === undefined)
            changes.push({ path: [...path, index], kind: "added", after: value });
          else visit(old[oldIndex]!, value, [...path, index]);
        });
      } else
        for (let index = 0; index < Math.max(old.length, next.length); index++) {
          if (index >= old.length)
            changes.push({ path: [...path, index], kind: "added", after: next[index]! });
          else if (index >= next.length)
            changes.push({ path: [...path, index], kind: "removed", before: old[index]! });
          else visit(old[index]!, next[index]!, [...path, index]);
        }
    } else if (object(old) && object(next)) {
      for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
        if (!Object.hasOwn(old, key))
          changes.push({ path: [...path, key], kind: "added", after: next[key]! });
        else if (!Object.hasOwn(next, key))
          changes.push({ path: [...path, key], kind: "removed", before: old[key]! });
        else visit(old[key]!, next[key]!, [...path, key]);
      }
    } else changes.push({ path, kind: "changed", before: old, after: next });
  };
  visit(before, after, []);
  return changes;
};
export const valuePathLabel = (path: ValuePath): string =>
  "$" +
  path.map((key) => (typeof key === "number" ? `[${key}]` : `[${JSON.stringify(key)}]`)).join("");
export const ValueDiff = {
  view: <Message>(
    config: Readonly<{
      changes: readonly ValueChange[];
      label?: string;
      onSelectPath?: (change: ValueChange) => Message;
    }>,
    h: HtmlBuilder<Message>,
  ): Html => {
    const groups = new Map<string, ValueChange[]>();
    for (const change of config.changes) {
      const group = valuePathLabel(change.path.slice(0, -1));
      groups.set(group, [...(groups.get(group) ?? []), change]);
    }
    return h.section(
      [h.Class("fk-value-diff"), h.AriaLabel(config.label ?? "Value changes")],
      [
        ...[...groups].map(([label, changes]) =>
          h.div(
            [],
            [
              h.h3([], [label]),
              h.ul(
                [],
                changes.map((change) =>
                  h.li(
                    [h.DataAttribute("change-kind", change.kind)],
                    [
                      config.onSelectPath
                        ? h.button(
                            [h.Type("button"), h.OnClick(config.onSelectPath(change))],
                            [valuePathLabel(change.path)],
                          )
                        : h.strong([], [valuePathLabel(change.path)]),
                      h.span([], [` · ${change.kind}`]),
                      ...(change.kind !== "added"
                        ? [h.pre([], [h.del([], [JSON.stringify(change.before, null, 2)])])]
                        : []),
                      ...(change.kind !== "removed"
                        ? [h.pre([], [h.ins([], [JSON.stringify(change.after, null, 2)])])]
                        : []),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        ...(config.changes.length ? [] : [h.p([], ["No value changes."])]),
      ],
    );
  },
};
/** Diagnostic offsets address the original UTF-16 text; to is exclusive. */
export const diagnosticsToAnnotations = (
  path: string,
  text: string,
  diagnostics: readonly Diagnostic[],
): readonly DiffAnnotation[] => {
  const starts = [0];
  for (let offset = 0; offset < text.length; offset++)
    if (text[offset] === "\n") starts.push(offset + 1);
  const count = Math.max(1, starts.length - (text.endsWith("\n") ? 1 : 0));
  const lineAt = (offset: number) => {
    let low = 0,
      high = starts.length;
    while (low + 1 < high) {
      const mid = (low + high) >>> 1;
      if (starts[mid]! <= offset) low = mid;
      else high = mid;
    }
    return Math.min(count, low + 1);
  };
  return diagnostics
    .filter((d) => Number.isFinite(d.from) && Number.isFinite(d.to))
    .map((d) => {
      const from = Math.max(0, Math.min(text.length, Math.floor(d.from))),
        to = Math.max(from, Math.min(text.length, Math.floor(d.to)));
      return {
        path,
        side: "new",
        startLine: lineAt(from),
        endLine: lineAt(to > from ? to - 1 : from),
        tone: d.severity === "error" ? "danger" : d.severity === "warning" ? "warning" : "info",
        label: d.code ?? d.severity,
        message: d.message,
      };
    });
};
